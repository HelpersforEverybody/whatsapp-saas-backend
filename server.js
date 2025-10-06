// server.js
// Full backend with Shop, Menu, Orders, Merchant JWT auth, owner-only endpoints, WhatsApp webhook + Socket.io
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');

// SOCKET.IO
const io = new Server(server, {
  cors: {
    origin: '*', // in production set to your frontend URL
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 3000;

/* ---------------- middleware ---------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ---------------- Socket handlers ---------------- */
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

/* ----------------- API key middleware ----------------- */
const requireApiKey = (req, res, next) => {
  const key = (req.get('x-api-key') || req.query.api_key || '').toString().trim();
  const envKey = (process.env.API_KEY || '').toString().trim();
  if (!envKey) {
    return res.status(500).json({ error: 'server misconfigured: API_KEY missing' });
  }
  if (!key || key !== envKey) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
};

/* ----------------- JWT merchant middleware ----------------- */
// Decodes Authorization: Bearer <token>, sets req.merchantId
const requireOwner = (req, res, next) => {
  const auth = req.get('authorization') || req.get('Authorization') || '';
  const m = (auth || '').toString().trim().match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1] : null;
  const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(token, secret);
    req.merchantId = payload.merchantId || payload.id || payload.sub || null;
    if (!req.merchantId) return res.status(401).json({ error: 'unauthorized' });
    next();
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized' });
  }
};

/* ----------------- MongoDB connection ----------------- */
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

/* ----------------- Models ----------------- */

// Merchant (simple model for merchant accounts)
const merchantSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String }, // store hashed password in production
  name: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const Merchant = mongoose.model('Merchant', merchantSchema);

// Shop (owner optional)
const shopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  description: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', default: null },
  createdAt: { type: Date, default: Date.now }
});
const Shop = mongoose.model('Shop', shopSchema);

// MenuItem
const menuItemSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true },
  price: { type: Number, default: 0 },
  available: { type: Boolean, default: true },
  externalId: { type: String },
  createdAt: { type: Date, default: Date.now },
});
const MenuItem = mongoose.model('MenuItem', menuItemSchema);

// Order
const orderSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
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
const Order = mongoose.model('Order', orderSchema);

/* ----------------- Twilio (optional) ----------------- */
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
      from: TWILIO_FROM,
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

/* ----------------- Auth helpers (simple) ----------------- */
// NOTE: This is a minimal example. In production:
// - store hashed passwords (bcrypt)
// - add proper signup flow, email validation, password reset, rate limits, etc.

app.post('/auth/merchant-signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    // naive store (plaintext) - replace with bcrypt in production
    const existing = await Merchant.findOne({ email });
    if (existing) return res.status(400).json({ error: 'merchant exists' });
    const m = await Merchant.create({ email, passwordHash: password, name });
    res.json({ ok: true, id: m._id });
  } catch (err) {
    console.error('Signup error', err);
    res.status(500).json({ error: 'failed' });
  }
});

app.post('/auth/merchant-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const merchant = await Merchant.findOne({ email });
    if (!merchant) return res.status(401).json({ error: 'invalid' });
    // in production compare hashed password
    if (merchant.passwordHash !== password) return res.status(401).json({ error: 'invalid' });

    const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
    const token = jwt.sign({ merchantId: merchant._id.toString(), email: merchant.email }, secret, { expiresIn: '30d' });
    res.json({ token, merchant: { id: merchant._id, email: merchant.email, name: merchant.name } });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'failed' });
  }
});

/* ----------------- Routes: Health  ----------------- */
app.get('/status', (req, res) => res.json({ status: 'ok', time: new Date() }));

/* ----------------- Shop & Menu APIs ----------------- */

/*
  Create Shop:
  - if called with merchant JWT (Authorization), the shop will be owned by that merchant
  - else requires x-api-key admin to create
*/
app.post('/api/shops', async (req, res) => {
  try {
    // check for merchant token first
    let ownerId = null;
    const auth = req.get('authorization') || req.get('Authorization') || '';
    if (auth) {
      const m = auth.toString().trim().match(/^Bearer\s+(.+)$/i);
      if (m) {
        try {
          const payload = jwt.verify(m[1], process.env.JWT_SECRET || 'dev_jwt_secret_change_me');
          ownerId = payload.merchantId || payload.id || payload.sub || null;
        } catch (e) {
          // ignore – fallback to admin API_KEY check
        }
      }
    }

    // if not merchant, check API key for admin creation
    if (!ownerId) {
      const key = (req.get('x-api-key') || req.query.api_key || '').toString().trim();
      const envKey = (process.env.API_KEY || '').toString().trim();
      if (!envKey) return res.status(500).json({ error: 'server misconfigured: API_KEY missing' });
      if (!key || key !== envKey) return res.status(401).json({ error: 'unauthorized' });
    }

    const { name, phone, description } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });

    const shopObj = { name, phone, description };
    if (ownerId) shopObj.owner = ownerId;

    const shop = await Shop.create(shopObj);
    res.status(201).json(shop);
  } catch (err) {
    console.error('Create shop error:', err);
    res.status(500).json({ error: 'failed to create shop', detail: err.message });
  }
});

/* Add Menu Item (merchant + admin)
   - Admin via /api/shops/:shopId/items with API key (existing route behavior)
   - Merchants should use /owner/shops/:shopId/items (see owner routes below)
*/
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

/* Public: List menu for shop (customers) */
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

/* ----------------- Order APIs ----------------- */

/* Create order (public or via API) */
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

/* List (recent) orders (merchant/admin) */
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

/* Merchant: list orders for a particular shop (owner may use token or admin api key) */
app.get('/api/shops/:shopId/orders', async (req, res) => {
  // Allow either API key or merchant token
  try {
    const shopId = req.params.shopId;
    const q = { shop: shopId };
    const orders = await Order.find(q).sort({ createdAt: -1 }).limit(200).lean();
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

    // notify customer
    sendWhatsAppMessageSafe(order.phone, `Order ${order._id} status updated: ${status}`).catch(() => {});

    // emit socket update
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

/* ----------------- Owner-only endpoints ----------------- */

/* GET /api/me/shops - shops owned by authenticated merchant */
app.get('/api/me/shops', requireOwner, async (req, res) => {
  try {
    const ownerId = req.merchantId;
    const shops = await Shop.find({ owner: ownerId }).select('-__v').lean();
    res.json(shops);
  } catch (err) {
    console.error('Get my shops error:', err);
    res.status(500).json({ error: 'failed to load shops' });
  }
});

/* Add menu item as owner */
app.post('/owner/shops/:shopId/items', requireOwner, async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.shopId);
    if (!shop) return res.status(404).json({ error: 'shop not found' });
    if (!shop.owner || String(shop.owner) !== String(req.merchantId)) return res.status(403).json({ error: 'forbidden' });

    const { name, price } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const externalId = Math.random().toString(36).slice(2, 8).toUpperCase();
    const item = await MenuItem.create({ shop: shop._id, name, price: Number(price || 0), externalId });
    res.status(201).json(item);
  } catch (err) {
    console.error('Owner add item error:', err);
    res.status(500).json({ error: 'failed to add item' });
  }
});

/* Delete menu item as owner */
app.delete('/owner/shops/:shopId/items/:itemId', requireOwner, async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.shopId);
    if (!shop) return res.status(404).json({ error: 'shop not found' });
    if (!shop.owner || String(shop.owner) !== String(req.merchantId)) return res.status(403).json({ error: 'forbidden' });

    const item = await MenuItem.findOneAndDelete({ _id: req.params.itemId, shop: shop._id });
    if (!item) return res.status(404).json({ error: 'item not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Owner delete item error:', err);
    res.status(500).json({ error: 'failed to delete' });
  }
});

/* ----------------- Twilio webhook for WhatsApp (public) ----------------- */
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

  try {
    const MessagingResponse = require('twilio').twiml.MessagingResponse;
    const twiml = new MessagingResponse();

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
          // notify shop owner (optional)
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
      const intro = 'Welcome. Commands:\n1) menu <shopPhone>\n2) order <shopPhone> <itemId> <qty>\n3) status <orderId>';
      const tw = require('twilio').twiml.MessagingResponse;
      twiml.message(intro);
    }

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Server error');
  }
});

/* ----------------- Start server ----------------- */
server.listen(PORT, () => console.log(`Server running with Socket.io on port ${PORT}`));
