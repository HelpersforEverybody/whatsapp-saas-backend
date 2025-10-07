// server.js — Backend with Shop/Menu + WhatsApp + Socket.io + JWT (admin + merchant)
// Includes compatibility for /auth/login (admin OR merchant), /auth/merchant-login,
// /api/me/shops for merchant-owned shops, and more robust token parsing.

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
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 3000;

/* ----------------- middleware ----------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ----------------- Socket.IO ----------------- */
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
  try {
    io.to(`order:${orderId}`).emit('orderStatusUpdate', payload);
  } catch (e) {
    console.error('emitOrderUpdate error', e);
  }
}

/* ----------------- Auth & env helpers ----------------- */
const API_KEY_ENV = (process.env.API_KEY || '').toString().trim();
const JWT_SECRET = (process.env.JWT_SECRET || '').toString().trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').toString().trim();

function extractTokenFromRequest(req) {
  // Look in Authorization header (Bearer token or raw token), x-access-token, x-api-key (not for JWT), token query param
  const auth = (req.get('authorization') || req.get('Authorization') || '').toString().trim();
  if (auth) {
    const parts = auth.split(/\s+/);
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') return parts[1];
    // fallback: header might contain raw token
    if (parts.length === 1) return parts[0];
  }
  const xat = (req.get('x-access-token') || req.get('x-access_token') || '').toString().trim();
  if (xat) return xat;
  const tokenQuery = (req.query && req.query.token) || '';
  if (tokenQuery) return tokenQuery;
  return null;
}

function verifyJwtTokenFromString(token) {
  if (!token) return null;
  if (!JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function verifyJwtTokenFromRequest(req) {
  const token = extractTokenFromRequest(req);
  if (!token) return null;
  return verifyJwtTokenFromString(token);
}

// allow either admin API_KEY OR valid Bearer JWT (admin or merchant)
const requireApiKeyOrJwt = (req, res, next) => {
  const key = (req.get('x-api-key') || req.query.api_key || '').toString().trim();

  // prefer JWT if present
  const decoded = verifyJwtTokenFromRequest(req);
  if (decoded && (decoded.role === 'admin' || decoded.role === 'merchant')) {
    req.auth = decoded;
    return next();
  }

  // fallback to API key
  if (API_KEY_ENV && key && key === API_KEY_ENV) {
    return next();
  }

  return res.status(401).json({ error: 'unauthorized' });
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

// User (merchant)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compareSync(String(plain), this.passwordHash);
};
const User = mongoose.model('User', userSchema);

// Shop (owner optional)
const shopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  description: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
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

// ----- Order schema (DROP-IN REPLACEMENT) -----
const orderSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
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
  // numeric 6-digit order number (unique per shop)
  orderNumber: { type: Number, required: true },
  status: { type: String, default: 'received' },
  createdAt: { type: Date, default: Date.now },
});

// Unique index to enforce orderNumber uniqueness within the same shop
orderSchema.index({ shop: 1, orderNumber: 1 }, { unique: true });

const Order = mongoose.model('Order', orderSchema);

// Optional: ensure indexes are created (safe to call)
Order.createIndexes().catch(err => console.error('Order index create error:', err));


// Ensure uniqueness of orderNumber per shop
orderSchema.index({ shop: 1, orderNumber: 1 }, { unique: true });

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

/* ----------------- Owner middleware (merchant) ----------------- */
// requireOwner: validates merchant JWT and ensures ownership when shopId provided
const requireOwner = async (req, res, next) => {
  const decoded = verifyJwtTokenFromRequest(req);
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

/* ----------------- Auth endpoints ----------------- */

/*
  POST /auth/login  (compat)
    - if body contains { email, password } => merchant login (returns merchant token)
    - else if body contains { password } and no email => admin password flow (returns admin token)
*/
app.post('/auth/login', async (req, res) => {
  try {
    const body = req.body || {};

    // merchant login (email + password)
    if (body.email && body.password) {
      const email = String(body.email).toLowerCase();
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ error: 'invalid credentials' });
      const ok = user.verifyPassword(body.password);
      if (!ok) return res.status(401).json({ error: 'invalid credentials' });
      if (!JWT_SECRET) return res.status(500).json({ error: 'server misconfigured: JWT_SECRET missing' });
      const token = jwt.sign({ role: 'merchant', userId: String(user._id) }, JWT_SECRET, { expiresIn: '12h' });
      return res.json({ token, userId: user._id });
    }

    // admin login (password only)
    if (body.password && !body.email) {
      if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'server misconfigured: ADMIN_PASSWORD missing' });
      if (!JWT_SECRET) return res.status(500).json({ error: 'server misconfigured: JWT_SECRET missing' });
      if (!body.password || body.password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'invalid credentials' });
      }
      const token = jwt.sign({ role: 'admin', issuedAt: Date.now() }, JWT_SECRET, { expiresIn: '12h' });
      return res.json({ token, expiresIn: 12 * 3600 });
    }

    return res.status(400).json({ error: 'invalid request' });
  } catch (e) {
    console.error('Login error', e);
    return res.status(500).json({ error: 'server error' });
  }
});

// keep the old merchant-login endpoint too (compat)
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

/* ----------------- Routes ----------------- */

/* Health check */
app.get('/status', (req, res) => res.json({ status: 'ok', time: new Date() }));

/* Create Shop (owner creates) */
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

/* Add Menu Item (owner only) */
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

/* Edit menu item (owner only) */
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

/* Delete menu item (owner only) */
app.delete('/api/shops/:shopId/items/:itemId', requireOwner, async (req, res) => {
  try {
    const item = await MenuItem.findOneAndDelete({ _id: req.params.itemId, shop: req.params.shopId });
    if (!item) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete item error:', err);
    res.status(500).json({ error: 'failed' });
  }
});

/* List menu (public) */
app.get('/api/shops/:shopId/menu', async (req, res) => {
  try {
    const items = await MenuItem.find({ shop: req.params.shopId }).select('-__v').lean();
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

/* ----------------- merchant-only: list shops owned by logged-in merchant ----------------- */
app.get('/api/me/shops', async (req, res) => {
  try {
    const decoded = verifyJwtTokenFromRequest(req);
    if (!decoded || decoded.role !== 'merchant') return res.status(401).json({ error: 'unauthorized' });
    const shops = await Shop.find({ owner: decoded.userId }).lean();
    res.json(shops);
  } catch (err) {
    console.error('me/shops error', err);
    res.status(500).json({ error: 'failed' });
  }
});

/* Create order (public — guest or authenticated) */
/* Drop-in replacement: allows guest orders, still supports shop association and 6-digit per-shop orderNumber */
app.post('/api/orders', async (req, res) => {
  try {
    const { shop: shopId, customerName, phone, items = [] } = req.body || {};

    // Basic validation
    if (!customerName || !phone) {
      return res.status(400).json({ error: 'customerName and phone required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }

    // sanitize items and compute total
    const sanitizedItems = items.map(it => ({
      name: String(it.name || '').slice(0, 200),
      qty: Math.max(1, parseInt(it.qty, 10) || 1),
      price: Number(it.price || 0)
    }));
    const total = sanitizedItems.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);

    // helper to generate 6-digit number
    function random6() {
      return Math.floor(100000 + Math.random() * 900000); // 100000..999999
    }

    // Attempt to create order with unique orderNumber per shop (retries on duplicate)
    const MAX_ATTEMPTS = 12;
    let createdOrder = null;
    let lastErr = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const orderNumber = random6();
      try {
        createdOrder = await Order.create({
          shop: shopId || null,
          customerName: String(customerName).slice(0, 200),
          phone: String(phone).slice(0, 40),
          items: sanitizedItems,
          total,
          orderNumber,
        });
        lastErr = null;
        break; // success
      } catch (err) {
        lastErr = err;
        // Duplicate key (11000) => collision, try again
        if (err && err.code === 11000) {
          continue;
        } else {
          // other error — break and return server error
          console.error('Order create error (non-duplicate):', err);
          break;
        }
      }
    }

    if (!createdOrder) {
      console.error('Failed to create order after retries:', lastErr);
      return res.status(500).json({ error: 'failed to create order' });
    }

    // Non-blocking notification (same as before)
    sendWhatsAppMessageSafe(phone, `Hi ${customerName}, we received your order ${String(createdOrder.orderNumber).padStart(6,'0')}. Total: ₹${total}`).catch(() => {});

    // Return the created order (includes orderNumber)
    return res.status(201).json(createdOrder);
  } catch (err) {
    console.error('Create order unexpected error:', err);
    return res.status(500).json({ error: 'failed to create order' });
  }
});

    // Optional: send WhatsApp notification (non-blocking)
    sendWhatsAppMessageSafe(phone, `Hi ${customerName}, we received your order ${String(createdOrder.orderNumber).padStart(6,'0')}. Total: ₹${total}`).catch(()=>{});

    // return created order (including numeric orderNumber)
    res.status(201).json(createdOrder);
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'failed to create order' });
  }
});


/* List orders (merchant/admin) */
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

/* Merchant: list shop orders (owner only) */
app.get('/api/shops/:shopId/orders', requireOwner, async (req, res) => {
  try {
    const orders = await Order.find({ shop: req.params.shopId }).sort({ createdAt: -1 }).limit(200);
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

    // notify customer (non-blocking)
    sendWhatsAppMessageSafe(order.phone, `Order ${order._id} status updated: ${status}`).catch(() => {});

    // emit socket update
    try {
      const payload = {
        orderId: order._id.toString(),
        status,
        at: new Date().toISOString(),
        meta: { note: 'updated via merchant/dashboard', shop: order.shop ? order.shop.toString() : null }
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

/* ----------------- Twilio webhook for WhatsApp ----------------- */
/* Supports: menu, order, status */
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
      twiml.message(
        'Welcome. Commands:\n1) menu <shopPhone>\n2) order <shopPhone> <itemId> <qty>\n3) status <orderId>'
      );
    }
  } catch (err) {
    console.error('Webhook error:', err);
    twiml.message('Server error.');
  }

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

/* ----------------- Start server ----------------- */
server.listen(PORT, () => console.log(`Server running with Socket.io on port ${PORT}`));
