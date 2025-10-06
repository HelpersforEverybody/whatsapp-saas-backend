// server.js — Full backend with Shop & Menu support + WhatsApp commands + Socket.io + Auth (JWT)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');

const io = new Server(server, {
  cors: {
    origin: '*', // TODO: change to your frontend URL in production
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 3000;
const API_KEY_ENV = (process.env.API_KEY || '').toString().trim();
const JWT_SECRET = process.env.JWT_SECRET || 'please-change-me-to-strong-secret';

// ----------------- middleware -----------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ---------------- SOCKET.IO ----------------
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('joinOrder', ({ orderId }) => {
    if (!orderId) return;
    socket.join(`order:${orderId}`);
    console.log(`Socket ${socket.id} joined order room ${orderId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

function emitOrderUpdate(orderId, payload) {
  io.to(`order:${orderId}`).emit('orderStatusUpdate', payload);
}

// ---------------- MongoDB ----------------
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ---------------- Models ----------------
// Merchant (owner)
const merchantSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const Merchant = mongoose.models.Merchant || mongoose.model('Merchant', merchantSchema);

// Shop
const shopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true }, // e.g. +9198...
  description: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', default: null }, // owner reference
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
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }, // optional if created via API
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

// ---------------- Twilio (optional)
let twClient = null;
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_NUMBER || null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && TWILIO_FROM) {
  const Twilio = require('twilio');
  twClient = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log('✅ Twilio client configured');
} else {
  console.log('ℹ️ Twilio not configured (TWILIO_* env vars missing) — outgoing WhatsApp will be skipped');
}

async function sendWhatsAppMessageSafe(toPhone, text) {
  if (!twClient || !TWILIO_FROM) {
    console.log('Twilio not configured, skipping send:', text);
    return null;
  }
  try {
    const msg = await twClient.messages.create({
      from: TWILIO_FROM, // 'whatsapp:+1415...'
      to: `whatsapp:${toPhone}`,
      body: text,
    });
    console.log('Twilio message sent SID:', msg.sid);
    return msg;
  } catch (err) {
    console.error('Twilio send error:', err && err.message ? err.message : err);
    return null;
  }
}

// ---------------- middleware helpers ----------------
const requireApiKey = (req, res, next) => {
  const key = (req.get('x-api-key') || req.query.api_key || '').toString().trim();
  const envKey = API_KEY_ENV;
  if (!envKey) {
    return res.status(500).json({ error: 'server misconfigured: API_KEY missing' });
  }
  if (!key || key !== envKey) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
};

function requireAuth(req, res, next) {
  try {
    const auth = req.get('authorization') || '';
    if (!auth) return res.status(401).json({ error: 'missing auth' });
    const parts = auth.split(' ');
    if (parts[0] !== 'Bearer' || !parts[1]) return res.status(401).json({ error: 'invalid auth' });
    const token = parts[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, role, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid' });
  }
}

// ---------------- Auth routes ----------------
app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const existing = await Merchant.findOne({ email });
    if (existing) return res.status(409).json({ error: 'exists' });
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const merchant = await Merchant.create({ email, passwordHash, name });
    const token = jwt.sign({ id: merchant._id, role: 'merchant' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, merchant: { id: merchant._id, email: merchant.email, name: merchant.name }});
  } catch (err) {
    console.error('signup error', err);
    res.status(500).json({ error: 'server' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const merchant = await Merchant.findOne({ email });
    if (!merchant) return res.status(401).json({ error: 'invalid' });
    const ok = await bcrypt.compare(password, merchant.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid' });
    const token = jwt.sign({ id: merchant._id, role: 'merchant' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, merchant: { id: merchant._id, email: merchant.email, name: merchant.name }});
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'server' });
  }
});

// ---------------- Public & Admin routes ----------------
app.get('/status', (req, res) => res.json({ status: 'ok', time: new Date() }));

/* Create Shop (admin) */
app.post('/api/shops', requireApiKey, async (req, res) => {
  try {
    const { name, phone, description, owner } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });
    const shop = await Shop.create({ name, phone, description, owner: owner || null });
    res.status(201).json(shop);
  } catch (err) {
    console.error('Create shop error:', err);
    res.status(500).json({ error: 'failed to create shop', detail: err.message });
  }
});

/* Add Menu Item (admin) */
app.post('/api/shops/:shopId/items', requireApiKey, async (req, res) => {
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

/* Edit menu item (admin) */
app.patch('/api/shops/:shopId/items/:itemId', requireApiKey, async (req, res) => {
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

/* List menu (public) */
app.get('/api/shops/:shopId/menu', async (req, res) => {
  try {
    const items = await MenuItem.find({ shop: req.params.shopId, available: true }).select('-__v').lean();
    res.json(items);
  } catch (err) {
    console.error('List menu error:', err);
    res.status(500).json({ error: 'failed to load menu' });
  }
});

/* List all shops (public) */
app.get('/api/shops', async (req, res) => {
  try {
    const shops = await Shop.find().select('-__v').lean();
    res.json(shops);
  } catch (err) {
    res.status(500).json({ error: 'failed' });
  }
});

// ---------------- Owner routes (require JWT) ----------------
// Return shops owned by logged-in merchant
app.get('/api/me/shops', requireAuth, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const shops = await Shop.find({ owner: merchantId }).select('-__v').lean();
    res.json(shops);
  } catch (err) {
    console.error('me shops error', err);
    res.status(500).json({ error: 'server' });
  }
});

// Create a shop for authenticated merchant
app.post('/api/me/shops', requireAuth, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const { name, phone, description } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });
    const shop = await Shop.create({ name, phone, description, owner: merchantId });
    res.status(201).json(shop);
  } catch (err) {
    console.error('create my shop error', err);
    res.status(500).json({ error: 'server' });
  }
});

// Add item to shop owned by merchant
app.post('/api/me/shops/:shopId/items', requireAuth, async (req, res) => {
  try {
    const merchantId = req.user.id;
    const shop = await Shop.findById(req.params.shopId);
    if (!shop) return res.status(404).json({ error: 'not found' });
    if (!shop.owner || String(shop.owner) !== String(merchantId)) return res.status(403).json({ error: 'forbidden' });
    const { name, price } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const externalId = Math.random().toString(36).slice(2, 8).toUpperCase();
    const item = await MenuItem.create({ shop: shop._id, name, price: Number(price||0), externalId });
    res.status(201).json(item);
  } catch (err) {
    console.error('add item owner error', err);
    res.status(500).json({ error: 'server' });
  }
});

// ---------------- Orders (public/admin mixture) ----------------
app.post('/api/orders', requireApiKey, async (req, res) => {
  try {
    const { shop: shopId, customerName, phone, items = [] } = req.body;
    if (!customerName || !phone) return res.status(400).json({ error: 'customerName and phone required' });
    const total = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);
    const order = await Order.create({ shop: shopId || null, customerName, phone, items, total });
    // notify customer
    sendWhatsAppMessageSafe(phone, `Hi ${customerName}, we received your order ${order._id}. Total: ₹${total}`).catch(() => {});
    res.status(201).json(order);
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'failed to create order' });
  }
});

/* List orders (admin) - optionally filter by shop */
app.get('/api/orders', requireApiKey, async (req, res) => {
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

/* Merchant: list orders for a particular shop (admin) */
app.get('/api/shops/:shopId/orders', requireApiKey, async (req, res) => {
  try {
    const orders = await Order.find({ shop: req.params.shopId }).sort({ createdAt: -1 }).limit(200);
    res.json(orders);
  } catch (err) {
    console.error('Shop orders error:', err);
    res.status(500).json({ error: 'failed' });
  }
});

/* Update order status (merchant/admin) */
app.patch('/api/orders/:id/status', requireApiKey, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ error: 'not found' });

    // notify customer (non-blocking)
    sendWhatsAppMessageSafe(order.phone, `Order ${order._id} status updated: ${status}`).catch(() => {});

    // Emit Socket.io update
    try {
      const payload = {
        orderId: order._id.toString(),
        status,
        at: new Date().toISOString(),
        meta: { note: 'updated via merchant dashboard', shop: order.shop ? order.shop.toString() : null }
      };
      emitOrderUpdate(order._id.toString(), payload);
      console.log('Emitted orderStatusUpdate for', order._id.toString(), payload);
    } catch (e) {
      console.error('Socket emit error:', e);
    }

    res.json(order);
  } catch (err) {
    console.error('Update status error:', err);
    res.status(400).json({ error: 'invalid request' });
  }
});

// ---------------- Twilio webhook for WhatsApp (public) ----------------
/* Supports:
   - menu <shopPhone>
   - order <shopPhone> <itemExternalId> <qty>
   - status <orderId>
*/
app.post('/webhook/whatsapp', async (req, res) => {
  const from = (req.body.From || req.body.from || '').toString();
  const rawBody = (req.body.Body || req.body.body || '').toString().trim();
  console.log('Incoming WhatsApp:', from, rawBody);

  const parts = rawBody.split(/\s+/).filter(Boolean);
  const cmd = (parts[0] || '').toLowerCase();

  const MessagingResponse = (() => {
    try { return require('twilio').twiml.MessagingResponse; } catch(e) { return null; }
  })();

  const twiml = MessagingResponse ? new MessagingResponse() : null;

  try {
    if (cmd === 'menu' && parts[1]) {
      const shopPhone = parts[1];
      const shop = await Shop.findOne({ phone: shopPhone });
      if (!shop) {
        if (twiml) twiml.message(`Shop ${shopPhone} not found.`);
      } else {
        const items = await MenuItem.find({ shop: shop._id, available: true });
        if (!items.length) {
          if (twiml) twiml.message(`No items found for ${shop.name}.`);
        } else {
          let msg = `Menu for ${shop.name}:\n`;
          items.forEach(it => (msg += `${it.externalId}. ${it.name} — ₹${it.price}\n`));
          msg += `\nTo order: order ${shop.phone} <itemId> <qty>\nExample: order ${shop.phone} ${items[0].externalId} 2`;
          if (twiml) twiml.message(msg);
        }
      }

    } else if (cmd === 'order' && parts[1] && parts[2] && parts[3]) {
      const shopPhone = parts[1];
      const itemExt = parts[2];
      const qty = Math.max(1, parseInt(parts[3], 10) || 1);
      const shop = await Shop.findOne({ phone: shopPhone });
      if (!shop) {
        if (twiml) twiml.message(`Shop ${shopPhone} not found.`);
      } else {
        const item = await MenuItem.findOne({ shop: shop._id, externalId: itemExt });
        if (!item) {
          if (twiml) twiml.message(`Item ${itemExt} not found.`);
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
          if (twiml) twiml.message(`✅ Order placed: ${order._id}\nTotal: ₹${total}\nYou will receive updates here.`);
        }
      }

    } else if (cmd === 'status' && parts[1]) {
      try {
        const order = await Order.findById(parts[1]);
        if (!order) if (twiml) twiml.message(`Order ${parts[1]} not found.`);
        else if (twiml) twiml.message(`Order ${order._id} status: ${order.status}`);
      } catch (e) {
        if (twiml) twiml.message('Invalid order id.');
      }
    } else {
      if (twiml) {
        twiml.message(
          'Welcome. Commands:\n1) menu <shopPhone>\n2) order <shopPhone> <itemId> <qty>\n3) status <orderId>'
        );
      }
    }
  } catch (err) {
    console.error('Webhook error:', err);
    if (twiml) twiml.message('Server error.');
  }

  if (twiml) {
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
  } else {
    // If Twilio SDK isn't available, respond 200 OK
    res.json({ ok: true });
  }
});

// ---------------- Start server ----------------
server.listen(PORT, () => console.log(`Server running with Socket.io on port ${PORT}`));
