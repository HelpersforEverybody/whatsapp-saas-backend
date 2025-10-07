// server.js — backend with per-shop numeric orderNumber, JWT, Socket.io, Twilio
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');

const io = new Server(server, {
  cors: {
    origin: '*', // in prod, lock to your frontend origin
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  },
});

const PORT = process.env.PORT || 3000;

/* ------------- middleware ------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ------------- Socket.IO ------------- */
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('joinOrder', ({ orderId }) => {
    if (!orderId) return;
    socket.join(`order:${orderId}`);
    console.log(`Socket ${socket.id} joined order:${orderId}`);
  });
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});
function emitOrderUpdate(orderId, payload) {
  io.to(`order:${orderId}`).emit('orderStatusUpdate', payload);
}

/* ------------- env helpers ------------- */
const API_KEY_ENV = (process.env.API_KEY || '').toString().trim();
const JWT_SECRET = (process.env.JWT_SECRET || '').toString().trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').toString().trim();

/* ------------- DB connect ------------- */
mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

/* ------------- Models ------------- */
// User (merchant)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compareSync(String(plain), this.passwordHash);
};
const User = mongoose.models.User || mongoose.model('User', userSchema);

// Shop - includes lastOrderNumber for per-shop numeric orders
const shopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  description: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastOrderNumber: { type: Number, default: 0 }, // for per-shop incremental order numbers
  createdAt: { type: Date, default: Date.now },
});
const Shop = mongoose.models.Shop || mongoose.model('Shop', shopSchema);

// MenuItem
const menuItemSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true },
  price: { type: Number, default: 0 },
  available: { type: Boolean, default: true },
  externalId: { type: String },
  createdAt: { type: Date, default: Date.now },
});
const MenuItem = mongoose.models.MenuItem || mongoose.model('MenuItem', menuItemSchema);

// Order
const orderSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  orderNumber: { type: Number, default: null }, // numeric per-shop order number
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  items: [
    {
      name: String,
      qty: { type: Number, default: 1 },
      price: { type: Number, default: 0 },
    },
  ],
  total: { type: Number, default: 0 },
  status: { type: String, default: 'received' }, // received, accepted, packed, out-for-delivery, delivered
  createdAt: { type: Date, default: Date.now },
});
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

/* ------------- Twilio (optional) ------------- */
let twClient = null;
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_NUMBER || null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && TWILIO_FROM) {
  const Twilio = require('twilio');
  twClient = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log('✅ Twilio configured');
} else {
  console.log('ℹ️ Twilio not configured');
}
async function sendWhatsAppMessageSafe(toPhone, text) {
  if (!twClient || !TWILIO_FROM) {
    console.log('Twilio not configured, skipping send:', text);
    return null;
  }
  try {
    const msg = await twClient.messages.create({ from: TWILIO_FROM, to: `whatsapp:${toPhone}`, body: text });
    console.log('Twilio message SID:', msg.sid);
    return msg;
  } catch (err) {
    console.error('Twilio send error:', err && err.message ? err.message : err);
    return null;
  }
}

/* ------------- Auth helpers/middleware ------------- */
function verifyJwtToken(authHeader) {
  if (!authHeader) return null;
  const parts = authHeader.split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  const token = parts[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (e) {
    return null;
  }
}

// allow admin API key OR valid bearer (admin or merchant)
const requireApiKeyOrJwt = (req, res, next) => {
  const key = (req.get('x-api-key') || req.query.api_key || '').toString().trim();
  if (!API_KEY_ENV) {
    return res.status(500).json({ error: 'server misconfigured: API_KEY missing' });
  }

  const authHeader = (req.get('authorization') || '').toString().trim();
  if (authHeader) {
    const decoded = verifyJwtToken(authHeader);
    if (decoded && (decoded.role === 'admin' || decoded.role === 'merchant')) {
      req.auth = decoded;
      return next();
    }
  }

  if (key && key === API_KEY_ENV) return next();
  return res.status(401).json({ error: 'unauthorized' });
};

// requireOwner - ensure merchant JWT and ownership when a shopId is provided
const requireOwner = async (req, res, next) => {
  const authHeader = (req.get('authorization') || '').toString().trim();
  const decoded = verifyJwtToken(authHeader);
  if (!decoded || decoded.role !== 'merchant') {
    return res.status(401).json({ error: 'unauthorized' });
  }
  req.merchantId = decoded.userId;

  const shopId = req.params.shopId || req.body.shopId || req.body.shop;
  if (shopId) {
    try {
      const shop = await Shop.findById(shopId).lean();
      if (!shop) return res.status(404).json({ error: 'shop not found' });
      if (!shop.owner || String(shop.owner) !== String(req.merchantId)) {
        return res.status(403).json({ error: 'forbidden: not owner of shop' });
      }
    } catch (e) {
      return res.status(400).json({ error: 'invalid shop id' });
    }
  }
  next();
};

/* ------------- Auth endpoints ------------- */

// Admin login (admin password method)
app.post('/auth/login', (req, res) => {
  try {
    const { password } = req.body || {};
    if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'server misconfigured: ADMIN_PASSWORD missing' });
    if (!JWT_SECRET) return res.status(500).json({ error: 'server misconfigured: JWT_SECRET missing' });
    if (!password || password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'invalid credentials' });
    const token = jwt.sign({ role: 'admin', issuedAt: Date.now() }, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token, expiresIn: 12 * 3600 });
  } catch (e) {
    console.error('Login error', e);
    return res.status(500).json({ error: 'server error' });
  }
});

// Merchant signup
app.post('/auth/signup', async (req, res) => {
  try {
    const { name, email, password, createShop } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'name,email,password required' });
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'email already registered' });
    const saltRounds = Number(process.env.SALT_ROUNDS || 10);
    const hash = bcrypt.hashSync(String(password), saltRounds);
    const user = await User.create({ name, email: email.toLowerCase(), passwordHash: hash });
    let shop = null;
    if (createShop && createShop.name && createShop.phone) {
      shop = await Shop.create({ name: createShop.name, phone: createShop.phone, description: createShop.description || '', owner: user._id });
    }
    return res.status(201).json({ userId: user._id, shopId: shop ? shop._id : null });
  } catch (e) {
    console.error('Signup error', e);
    return res.status(500).json({ error: 'server error' });
  }
});

// Merchant login
app.post('/auth/merchant-login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const ok = user.verifyPassword(password);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    if (!JWT_SECRET) return res.status(500).json({ error: 'server misconfigured: JWT_SECRET missing' });
    const token = jwt.sign({ role: 'merchant', userId: String(user._id) }, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token, userId: user._id });
  } catch (e) {
    console.error('Merchant login error', e);
    return res.status(500).json({ error: 'server error' });
  }
});

/* ------------- API routes ------------- */

// Health
app.get('/status', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Create shop (owner-only)
app.post('/api/shops', requireOwner, async (req, res) => {
  try {
    const { name, phone, description } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });
    const shop = await Shop.create({ name, phone, description, owner: req.merchantId });
    res.status(201).json(shop);
  } catch (err) {
    console.error('Create shop error:', err);
    res.status(500).json({ error: 'failed to create shop', detail: err.message });
  }
});

// List all shops (public)
app.get('/api/shops', async (req, res) => {
  try {
    const shops = await Shop.find().select('-__v').lean();
    res.json(shops);
  } catch (err) {
    console.error('List shops error:', err);
    res.status(500).json({ error: 'failed' });
  }
});

// Owner: get my shops (merchant-only)
app.get('/api/me/shops', async (req, res) => {
  // Expect Authorization: Bearer <merchant-token>
  try {
    const authHeader = (req.get('authorization') || '').toString().trim();
    const decoded = verifyJwtToken(authHeader);
    if (!decoded || decoded.role !== 'merchant') return res.status(401).json({ error: 'unauthorized' });
    const shops = await Shop.find({ owner: decoded.userId }).lean();
    res.json(shops);
  } catch (e) {
    console.error('me/shops error', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Add menu item (owner only)
app.post('/api/shops/:shopId/items', requireOwner, async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const externalId = Math.random().toString(36).slice(2, 8).toUpperCase();
    const item = await MenuItem.create({ shop: req.params.shopId, name, price: Number(price || 0), externalId });
    res.status(201).json(item);
  } catch (err) {
    console.error('Add menu item error:', err);
    res.status(500).json({ error: 'failed to add item' });
  }
});

// Edit menu item (owner)
app.patch('/api/shops/:shopId/items/:itemId', requireOwner, async (req, res) => {
  try {
    const update = req.body;
    const item = await MenuItem.findOneAndUpdate({ _id: req.params.itemId, shop: req.params.shopId }, update, { new: true });
    if (!item) return res.status(404).json({ error: 'not found' });
    res.json(item);
  } catch (err) {
    console.error('Edit item error:', err);
    res.status(500).json({ error: 'failed' });
  }
});

// Delete item (owner)
app.delete('/api/shops/:shopId/items/:itemId', requireOwner, async (req, res) => {
  try {
    const del = await MenuItem.findOneAndDelete({ _id: req.params.itemId, shop: req.params.shopId });
    if (!del) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete item error', e);
    res.status(500).json({ error: 'failed' });
  }
});

// List menu (public)
app.get('/api/shops/:shopId/menu', async (req, res) => {
  try {
    const items = await MenuItem.find({ shop: req.params.shopId }).select('-__v').lean();
    res.json(items);
  } catch (err) {
    console.error('List menu error:', err);
    res.status(500).json({ error: 'failed to load menu' });
  }
});

/* Create order (public) — allow guest POSTs */
app.post('/api/orders', async (req, res) => {
  try {
    // Accept guest orders (no auth required)
    const { shop: shopId, customerName, phone: rawPhone, items = [] } = req.body;
    if (!customerName || !rawPhone) return res.status(400).json({ error: 'customerName and phone required' });

    // ---- Validate & normalize phone ----
    // Accept:
    // - 10 digit local numbers (e.g. "9876543210") -> normalize to "+91XXXXXXXXXX"
    // - international numbers already in E.164 (starting with '+') or digits including country code (like "919876543210")
    // Basic approach: remove non-digits, then decide:
    const digits = String(rawPhone || "").replace(/\D/g, "");
    let normalizedPhone = null;
    if (digits.length === 10) {
      // local Indian number: prefix +91
      normalizedPhone = `+91${digits}`;
    } else if (digits.length === 11 && digits.startsWith('0')) {
      // leading zero e.g. 09876543210 -> strip leading 0, prefix +91
      normalizedPhone = `+91${digits.slice(1)}`;
    } else if (digits.length === 12 && digits.startsWith('91')) {
      // already has country code without + (e.g. 919876543210)
      normalizedPhone = `+${digits}`;
    } else if (String(rawPhone || "").trim().startsWith('+') && digits.length >= 7) {
      // user supplied E.164 (or similar) with +: accept as +<digits>
      normalizedPhone = `+${digits}`;
    } else {
      return res.status(400).json({ error: 'invalid phone format; provide 10 digit local phone or full international number' });
    }

    // compute total
    const total = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);

    // If shopId provided, generate per-shop numeric orderNumber atomically
    let orderNumber = null;
    if (shopId) {
      // increment lastOrderNumber on shop
      const seq = await Shop.findByIdAndUpdate(shopId, { $inc: { lastOrderNumber: 1 } }, { new: true });
      if (!seq) {
        // shop not found — still allow order but without orderNumber
        orderNumber = null;
      } else {
        orderNumber = seq.lastOrderNumber; // numeric incremental per-shop
      }
    }

    const orderPayload = {
      shop: shopId || null,
      orderNumber,
      customerName,
      phone: normalizedPhone,
      items,
      total,
      status: 'received',
    };
    const order = await Order.create(orderPayload);

    // notify shop owner via Twilio (non-blocking)
    sendWhatsAppMessageSafe(normalizedPhone, `Hi ${customerName}, we received your order ${order.orderNumber ? `#${String(order.orderNumber).padStart(6,'0')}` : order._id}. Total: ₹${total}`).catch(() => {});

    // emit socket (use order._id)
    try {
      emitOrderUpdate(order._id.toString(), {
        orderId: order._id.toString(),
        status: order.status,
        orderNumber: orderNumber,
        at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Socket emit error:', e);
    }

    res.status(201).json(order);
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'failed to create order' });
  }
});

/* List orders (admin or with API key) */
app.get('/api/orders', requireApiKeyOrJwt, async (req, res) => {
  try {
    const { shopId } = req.query;
    const q = shopId ? { shop: shopId } : {};
    const orders = await Order.find(q).sort({ createdAt: -1 }).limit(200).lean();
    res.json(orders);
  } catch (err) {
    console.error('List orders error:', err);
    res.status(500).json({ error: 'failed to list orders' });
  }
});

/* Get single order (public) */
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ error: 'not found' });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: 'invalid id' });
  }
});

/* Owner: list shop orders (owner only) */
app.get('/api/shops/:shopId/orders', requireOwner, async (req, res) => {
  try {
    const orders = await Order.find({ shop: req.params.shopId }).sort({ createdAt: -1 }).limit(200).lean();
    res.json(orders);
  } catch (err) {
    console.error('Shop orders error:', err);
    res.status(500).json({ error: 'failed' });
  }
});

/* Update order status (merchant/admin) */
app.patch('/api/orders/:id/status', requireApiKeyOrJwt, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });

    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ error: 'not found' });

    // notify customer
    sendWhatsAppMessageSafe(order.phone, `Order ${order.orderNumber ? `#${String(order.orderNumber).padStart(6,'0')}` : order._id} status updated: ${status}`).catch(() => {});

    // emit socket update
    try {
      const payload = {
        orderId: order._id.toString(),
        status,
        at: new Date().toISOString(),
      };
      emitOrderUpdate(order._id.toString(), payload);
    } catch (e) {
      console.error('Socket emit error:', e);
    }

    res.json(order);
  } catch (err) {
    console.error('Update status error:', err);
    res.status(400).json({ error: 'invalid request' });
  }
});

/* Twilio webhook for WhatsApp */
app.post('/webhook/whatsapp', async (req, res) => {
  const from = (req.body.From || req.body.from || '').toString();
  const rawBody = (req.body.Body || req.body.body || '').toString().trim();
  console.log('Incoming WhatsApp:', from, rawBody);

  const parts = rawBody.split(/\s+/).filter(Boolean);
  const cmd = (parts[0] || '').toLowerCase();

  const MessagingResponse = require('twilio').twiml.MessagingResponse;
  const twiml = new MessagingResponse();

  try {
    if (cmd === 'menu' && parts[1]) {
      const shopPhone = parts[1];
      const shop = await Shop.findOne({ phone: shopPhone });
      if (!shop) {
        twiml.message(`Shop ${shopPhone} not found.`);
      } else {
        const items = await MenuItem.find({ shop: shop._id, available: true });
        if (!items.length) twiml.message(`No items found for ${shop.name}.`);
        else {
          let msg = `Menu for ${shop.name}:\n`;
          items.forEach(it => (msg += `${it.externalId}. ${it.name} — ₹${it.price}\n`));
          msg += `\nTo order: order ${shop.phone} <itemId> <qty>\nExample: order ${shop.phone} ${items[0].externalId} 2`;
          twiml.message(msg);
        }
      }

    } else if (cmd === 'order' && parts[1] && parts[2] && parts[3]) {
      const shopPhone = parts[1];
      const itemExt = parts[2];
      const qty = Math.max(1, parseInt(parts[3], 10) || 1);
      const shop = await Shop.findOne({ phone: shopPhone });
      if (!shop) {
        twiml.message(`Shop ${shopPhone} not found.`);
      } else {
        const item = await MenuItem.findOne({ shop: shop._id, externalId: itemExt });
        if (!item) {
          twiml.message(`Item ${itemExt} not found.`);
        } else {
          const orderPayload = {
            shop: shop._id,
            customerName: `WhatsApp:${from}`,
            phone: from.replace(/^whatsapp:/, ''),
            items: [{ name: item.name, qty, price: item.price }],
          };
          const total = item.price * qty;
          const order = await Order.create({ ...orderPayload, total });
          sendWhatsAppMessageSafe(shop.phone, `📥 New order ${order._id} from ${order.phone} — ${item.name} x${qty} — ₹${total}`).catch(() => {});
          twiml.message(`✅ Order placed: ${order._id}\nTotal: ₹${total}\nYou will receive updates here.`);
        }
      }

    } else if (cmd === 'status' && parts[1]) {
      try {
        const order = await Order.findById(parts[1]);
        if (!order) twiml.message(`Order ${parts[1]} not found.`);
        else twiml.message(`Order ${order._id} status: ${order.status}`);
      } catch (e) {
        twiml.message('Invalid order id.');
      }
    } else {
      twiml.message('Welcome. Commands:\n1) menu <shopPhone>\n2) order <shopPhone> <itemId> <qty>\n3) status <orderId>');
    }
  } catch (err) {
    console.error('Webhook error:', err);
    twiml.message('Server error.');
  }

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

/* ------------- Start server ------------- */
server.listen(PORT, () => console.log(`Server running with Socket.io on port ${PORT}`));
