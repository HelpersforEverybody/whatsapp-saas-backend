// server.js — complete WhatsApp SaaS backend (ready to paste)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Middleware — must run BEFORE routes
 */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/**
 * Simple API-key middleware
 * Accepts header: x-api-key or query param: api_key
 */
const requireApiKey = (req, res, next) => {
  const headerKey = req.get("x-api-key") || req.headers["x-api-key"] || null;
  const queryKey =
    req.query && (req.query.api_key || req.query["api_key"])
      ? String(req.query.api_key || req.query["api_key"])
      : null;
  const seenKey = (headerKey || queryKey || "").toString().trim();
  const envKey = (process.env.API_KEY || "").toString().trim();

  // debug (comment out in production)
  // console.log('API auth check:', { seenKey, envKey, route: req.method + ' ' + req.originalUrl });

  if (!envKey) {
    // If you intentionally want to disable API key checks in dev, change this behavior.
    return res
      .status(500)
      .json({ error: "server misconfigured: API_KEY missing" });
  }

  if (!seenKey || seenKey !== envKey) {
    return res.status(401).json({ error: "unauthorized" });
  }

  return next();
};

/**
 * MongoDB connection
 */
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

/**
 * Order model
 */
const orderSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  phone: { type: String, required: true }, // E.164 like +919xxxxxxxxx (store without 'whatsapp:' prefix)
  items: [
    {
      name: String,
      qty: { type: Number, default: 1 },
      price: { type: Number, default: 0 },
    },
  ],
  total: { type: Number, default: 0 },
  status: { type: String, default: "received" },
  createdAt: { type: Date, default: Date.now },
});
const Order = mongoose.model("Order", orderSchema);

/**
 * Optional Twilio client — only initialised if env vars present
 */
let twClient = null;
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_NUMBER || null; // e.g. 'whatsapp:+1415...'
if (
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  TWILIO_FROM
) {
  const Twilio = require("twilio");
  twClient = Twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );
  console.log("✅ Twilio client configured");
} else {
  console.log(
    "ℹ️ Twilio not configured (TWILIO_* env vars missing) — outgoing messages will be skipped",
  );
}

/**
 * Helper to send WhatsApp messages via Twilio (safe).
 */
async function sendWhatsAppMessageSafe(toPhone, text) {
  if (!twClient || !TWILIO_FROM) {
    console.log("Twilio not configured, skipping send:", text);
    return null;
  }
  try {
    const msg = await twClient.messages.create({
      from: TWILIO_FROM, // must include 'whatsapp:' prefix
      to: `whatsapp:${toPhone}`, // toPhone should be +<countrycode><number> without 'whatsapp:' prefix
      body: text,
    });
    console.log("Twilio message sent, SID:", msg.sid);
    return msg;
  } catch (err) {
    console.error("Twilio send error:", err && err.message ? err.message : err);
    throw err;
  }
}

/**
 * Routes
 */

// public health check
app.get("/", (req, res) => {
  res.send("✅ WhatsApp SaaS backend is running!");
});

/**
 * Create order (merchant) — protected by API key
 */
app.post("/api/orders", requireApiKey, async (req, res) => {
  try {
    const { customerName, phone, items = [] } = req.body;
    if (!customerName || !phone)
      return res
        .status(400)
        .json({ error: "customerName and phone are required" });

    const total = items.reduce(
      (s, it) => s + Number(it.price || 0) * Number(it.qty || 0),
      0,
    );
    const order = await Order.create({ customerName, phone, items, total });

    // send confirmation (non-blocking if you prefer)
    sendWhatsAppMessageSafe(
      phone,
      `Hi ${customerName}, we received your order ${order._id}. Total: ${total}`,
    ).catch((e) =>
      console.error(
        "sendWhatsAppMessageSafe error (non-fatal):",
        e && e.message ? e.message : e,
      ),
    );

    res.status(201).json(order);
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "failed to create order" });
  }
});

/**
 * List recent orders — protected
 */
app.get("/api/orders", requireApiKey, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(50);
    res.json(orders);
  } catch (err) {
    console.error("List orders error:", err);
    res.status(500).json({ error: "failed to list orders" });
  }
});

/**
 * Get single order (public read) — optional: you can also protect this if desired
 */
app.get("/api/orders/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "not found" });
    res.json(order);
  } catch (err) {
    console.error("Get order error:", err);
    res.status(400).json({ error: "invalid id" });
  }
});

/**
 * Update status — protected by API key
 */
app.patch("/api/orders/:id/status", requireApiKey, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status required" });

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );
    if (!order) return res.status(404).json({ error: "not found" });

    // send update to customer
    sendWhatsAppMessageSafe(
      order.phone,
      `Order ${order._id} status updated: ${status}`,
    ).catch((e) =>
      console.error(
        "sendWhatsAppMessageSafe error (non-fatal):",
        e && e.message ? e.message : e,
      ),
    );

    res.json(order);
  } catch (err) {
    console.error("Update status error:", err);
    res.status(400).json({ error: "invalid request" });
  }
});

/**
 * Twilio incoming webhook for WhatsApp — keep this UNPROTECTED
 * Twilio sends urlencoded POSTs with fields like From and Body
 */
app.post("/webhook/whatsapp", async (req, res) => {
  const from = req.body.From || req.body.from || "";
  const body = req.body.Body || req.body.body || "";
  console.log("Incoming WhatsApp:", from, body);

  const parts = (body || "").trim().split(/\s+/);
  const MessagingResponse = require("twilio").twiml.MessagingResponse;
  const twiml = new MessagingResponse();

  if (parts[0] && parts[0].toLowerCase() === "status" && parts[1]) {
    try {
      const order = await Order.findById(parts[1]);
      if (!order) twiml.message(`Order ${parts[1]} not found.`);
      else twiml.message(`Order ${parts[1]} status: ${order.status}`);
    } catch (e) {
      console.error("Webhook error:", e);
      twiml.message("Invalid order id.");
    }
  } else {
    twiml.message('Welcome. Commands: "status <orderId>" to check status.');
  }

  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end(twiml.toString());
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
