// server.js
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
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] },
});

const PORT = process.env.PORT || 3000;

/* middleware */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* Socket.IO */
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

/* env helpers */
const API_KEY_ENV = (process.env.API_KEY || '').toString().trim();
const JWT_SECRET = (process.env.JWT_SECRET || '').toString().trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').toString().trim();

/* DB connect */
mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

/* Models */
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

// Customer (new)
const customerAddressSchema = new mongoose.Schema({
  label: { type: String, default: '' }, // Home/Work/Other
  address: { type: String, required: true },
  phone: { type: String, default: '' }, // optional phone for this address
  pincode: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const customerSchema = new mongoose.Schema({
  name: { type: String, default: 'Customer' },
  phone: { type: String, required: true, unique: true }, // normalized +91xxxx...
  addresses: [customerAddressSchema],
  createdAt: { type: Date, default: Date.now },
});
const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);

// Shop - includes address, online, pincode required
const shopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  description: String,
  address: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastOrderNumber: { type: Number, default: 0 },
  pincode: { type: String, required: true },
  online: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});
shopSchema.index({ pincode: 1 });
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

// Order (extended: store customer reference optional)
const orderSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  orderNumber: { type: Number, default: null },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null }, // new
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  address: { // optional address snapshot
    label: String,
    address: String,
    phone: String,
    pincode: String,
  },
  items: [
    {
      name: String,
      qty: { type: Number, default: 1 },
      price: { type: Number, default: 0 },
    },
  ],
  total: { type: Number, default: 0 },
  status: { type: String, default: 'received' },
  createdAt: { type: Date, default: Date.now },
});
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

/* Twilio (optional) */
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

/* Auth helpers */
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

// require either valid API key or JWT (admin/merchant)
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

// requireOwner - ensure merchant JWT and shop ownership if shopId provided
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

// requireCustomer - verify JWT with role 'customer'
const requireCustomer = (req, res, next) => {
  const authHeader = (req.get('authorization') || '').toString().trim();
  if (!authHeader) return res.status(401).json({ error: 'unauthorized' });
  const decoded = verifyJwtToken(authHeader);
  if (!decoded || decoded.role !== 'customer') return res.status(401).json({ error: 'unauthorized' });
  req.customerId = decoded.userId;
  next();
};

/* Auth endpoints */
// Admin login
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

// Merchant signup (create shop required now)
app.post('/auth/signup', async (req, res) => {
  try {
    const { name, email, password, createShop } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'name,email,password required' });
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'email already registered' });
    const saltRounds = Number(process.env.SALT_ROUNDS || 10);
    const hash = bcrypt.hashSync(String(password), saltRounds);
    const user = await User.create({ name, email: email.toLowerCase(), passwordHash: hash });

    // require createShop with required fields
    let shop = null;
    if (!createShop || !createShop.name || !createShop.phone || !createShop.address || !createShop.pincode) {
      return res.status(400).json({ error: 'createShop with name, phone, address and pincode is required' });
    } else {
      shop = await Shop.create({
        name: createShop.name,
        phone: createShop.phone,
        description: createShop.description || '',
        address: createShop.address,
        pincode: (createShop.pincode || '').toString(),
        online: true,
        owner: user._id,
      });
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

/* Fake OTP login (test only)
   Now: create or return persistent Customer doc and return customer-id in JWT.
*/
const otpStore = new Map();
function genOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
app.post('/auth/send-otp', async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const normalized = String(phone).replace(/[^\d+]/g, '');
    if (!/^\+?\d{10,15}$/.test(normalized)) return res.status(400).json({ error: 'invalid phone format' });
    const otp = genOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore.set(normalized, { otp, expiresAt });
    console.log(`[OTP] send-otp to ${normalized}: ${otp} (expires in 5m)`);
    return res.json({ ok: true, message: 'OTP generated and (pretend) sent' });
  } catch (e) {
    console.error('send-otp error', e);
    return res.status(500).json({ error: 'server error' });
  }
});
app.post('/auth/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body || {};
    if (!phone || !otp) return res.status(400).json({ error: 'phone and otp required' });
    const normalized = String(phone).replace(/[^\d+]/g, '');
    const rec = otpStore.get(normalized);
    if (!rec) return res.status(400).json({ error: 'no otp found (request send-otp first)' });
    if (Date.now() > rec.expiresAt) {
      otpStore.delete(normalized);
      return res.status(400).json({ error: 'otp expired' });
    }
    if (String(otp).trim() !== String(rec.otp)) return res.status(401).json({ error: 'invalid otp' });
    otpStore.delete(normalized);

    // Normalize phone to E.164-like with + if digits present
    const digits = normalized.replace(/\D/g, '');
    let normalizedPhone = normalized;
    if (!normalized.startsWith('+') && digits.length === 10) {
      normalizedPhone = `+91${digits}`;
    } else if (!normalized.startsWith('+')) {
      normalizedPhone = `+${digits}`;
    }

    // Find or create Customer
    let customer = await Customer.findOne({ phone: normalizedPhone }).lean();
    if (!customer) {
      // create lightweight customer with phone; name left empty for user to edit later
      const created = await Customer.create({ phone: normalizedPhone, name: 'Customer' });
      customer = created.toObject();
    }

    if (!JWT_SECRET) return res.status(500).json({ error: 'server misconfigured: JWT_SECRET missing' });
    // token contains customer id for server-side authorization
    const token = jwt.sign({ role: 'customer', userId: String(customer._id) }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({ token, userId: customer._id, phone: normalizedPhone, name: customer.name || 'Customer' });
  } catch (e) {
    console.error('verify-otp error', e);
    return res.status(500).json({ error: 'server error' });
  }
});

/* API routes */
// Health
app.get('/status', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Create shop (owner-only)
app.post('/api/shops', requireOwner, async (req, res) => {
  try {
    const { name, phone, description, pincode, address } = req.body;
    if (!name || !phone || !address || !pincode) return res.status(400).json({ error: 'name, phone, address and pincode required' });
    const shop = await Shop.create({ name, phone, description, address, owner: req.merchantId, pincode: (pincode || '').toString() });
    res.status(201).json(shop);
  } catch (err) {
    console.error('Create shop error:', err);
    res.status(500).json({ error: 'failed to create shop', detail: err.message });
  }
});

// Public list: only online shops, optional pincode
app.get('/api/shops', async (req, res) => {
  try {
    const { pincode } = req.query;
    let q = { online: true };
    if (pincode) q.pincode = String(pincode).trim();
    const shops = await Shop.find(q).select('-__v').lean();
    res.json(shops);
  } catch (err) {
    console.error('List shops error:', err);
    res.status(500).json({ error: 'failed' });
  }
});

// Owner: get my shops
app.get('/api/me/shops', async (req, res) => {
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

// Toggle shop online/offline (owner only)
app.put('/api/shops/:shopId/status', requireOwner, async (req, res) => {
  try {
    const { online } = req.body;
    const shop = await Shop.findById(req.params.shopId);
    if (!shop) return res.status(404).json({ error: 'shop not found' });
    shop.online = Boolean(online);
    await shop.save();
    res.json({ ok: true, shop });
  } catch (err) {
    console.error('Toggle shop status error:', err);
    res.status(500).json({ error: 'failed to toggle status' });
  }
});
// Edit shop details (owner only)
app.patch('/api/shops/:shopId', requireOwner, async (req, res) => {
  try {
    const update = {};
    const allowed = ['name', 'phone', 'address', 'pincode', 'description', 'online'];
    for (const k of allowed) {
      if (typeof req.body[k] !== 'undefined') update[k] = req.body[k];
    }
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'nothing to update' });

    const shop = await Shop.findOneAndUpdate({ _id: req.params.shopId, owner: req.merchantId }, update, { new: true });
    if (!shop) return res.status(404).json({ error: 'not found or not owner' });
    res.json(shop);
  } catch (err) {
    console.error('Edit shop error:', err);
    res.status(500).json({ error: 'failed to edit shop' });
  }
});

// Add menu item
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

// Edit menu item
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

// Delete item
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

/* Create order
   - Validate phone, normalize
   - If Authorization contains customer token, attach customerId
   - Accept address snapshot in body; if shop provided, validate address.pincode === shop.pincode
*/
app.post('/api/orders', async (req, res) => {
  try {
    const { shop: shopId, customerName, phone: rawPhone, items = [], address } = req.body;
    if (!customerName || !rawPhone) return res.status(400).json({ error: 'customerName and phone required' });

    // Normalize phone
    const digits = String(rawPhone || "").replace(/\D/g, "");
    let normalizedPhone = null;
    if (digits.length === 10) normalizedPhone = `+91${digits}`;
    else if (digits.length === 11 && digits.startsWith('0')) normalizedPhone = `+91${digits.slice(1)}`;
    else if (digits.length === 12 && digits.startsWith('91')) normalizedPhone = `+${digits}`;
    else if (String(rawPhone || "").trim().startsWith('+') && digits.length >= 7) normalizedPhone = `+${digits}`;
    else return res.status(400).json({ error: 'invalid phone format; provide 10 digit local phone or full international number' });

    // compute total
    const total = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);

    // If shopId provided, validate shop exists & pincode match if address present
    let shop = null;
    if (shopId) {
      shop = await Shop.findById(shopId).lean();
      if (!shop) {
        // still allow order without shop (guest), but if shopId invalid, respond error
        return res.status(400).json({ error: 'invalid shop id' });
      }
      if (address && address.pincode && String(address.pincode).trim() !== String(shop.pincode).trim()) {
        return res.status(400).json({ error: `Shop does not deliver to pincode ${address.pincode}. Shop pincode is ${shop.pincode}` });
      }
    }

    // determine customer if token provided
    let customerId = null;
    try {
      const authHeader = (req.get('authorization') || '').toString().trim();
      if (authHeader) {
        const decoded = verifyJwtToken(authHeader);
        if (decoded && decoded.role === 'customer') {
          customerId = decoded.userId;
        }
      }
    } catch (e) {
      // ignore invalid token; treat as guest
      customerId = null;
    }

    // If shopId provided, generate per-shop numeric orderNumber atomically
    let orderNumber = null;
    if (shopId) {
      const seq = await Shop.findByIdAndUpdate(shopId, { $inc: { lastOrderNumber: 1 } }, { new: true });
      if (seq) orderNumber = seq.lastOrderNumber;
    }

    const orderPayload = {
      shop: shopId || null,
      orderNumber,
      customer: customerId || null,
      customerName,
      phone: normalizedPhone,
      address: address && typeof address === 'object' ? {
        label: address.label || '',
        address: address.address || '',
        phone: address.phone || '',
        pincode: address.pincode || '',
      } : undefined,
      items,
      total,
      status: 'received',
    };

    const order = await Order.create(orderPayload);

    // notify customer via Twilio (non-blocking)
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

// List orders (admin or API key or merchant)
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

// Get single order (public)
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ error: 'not found' });
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: 'invalid id' });
  }
});

// Owner: list shop orders (owner only)
app.get('/api/shops/:shopId/orders', requireOwner, async (req, res) => {
  try {
    const orders = await Order.find({ shop: req.params.shopId }).sort({ createdAt: -1 }).limit(200).lean();
    res.json(orders);
  } catch (err) {
    console.error('Shop orders error:', err);
    res.status(500).json({ error: 'failed' });
  }
});

// Update order status
app.patch('/api/orders/:id/status', requireApiKeyOrJwt, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ error: 'not found' });
    sendWhatsAppMessageSafe(order.phone, `Order ${order.orderNumber ? `#${String(order.orderNumber).padStart(6,'0')}` : order._id} status updated: ${status}`).catch(() => {});
    try {
      const payload = { orderId: order._id.toString(), status, at: new Date().toISOString() };
      emitOrderUpdate(order._id.toString(), payload);
    } catch (e) { console.error('Socket emit error:', e); }
    res.json(order);
  } catch (err) {
    console.error('Update status error:', err);
    res.status(400).json({ error: 'invalid request' });
  }
});

/* Customer endpoints */

// Get current customer profile
app.get('/api/customers/me', requireCustomer, async (req, res) => {
  try {
    const cust = await Customer.findById(req.customerId).select('-__v').lean();
    if (!cust) return res.status(404).json({ error: 'not found' });
    res.json(cust);
  } catch (e) {
    console.error('customers/me error', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Update current customer profile (name, phone)
app.patch('/api/customers/me', requireCustomer, async (req, res) => {
  try {
    const update = {};
    if (typeof req.body.name !== 'undefined') update.name = req.body.name;
    if (typeof req.body.phone !== 'undefined') {
      // normalize phone
      const digits = String(req.body.phone).replace(/\D/g, '');
      if (digits.length === 10) update.phone = `+91${digits}`;
      else if (digits.length >= 7) update.phone = `+${digits}`;
      else return res.status(400).json({ error: 'invalid phone' });
    }
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'nothing to update' });
    const cust = await Customer.findByIdAndUpdate(req.customerId, update, { new: true }).lean();
    if (!cust) return res.status(404).json({ error: 'not found' });
    res.json(cust);
  } catch (e) {
    console.error('customers/me patch error', e);
    res.status(500).json({ error: 'failed' });
  }
});

// List addresses
app.get('/api/customers/addresses', requireCustomer, async (req, res) => {
  try {
    const cust = await Customer.findById(req.customerId).select('addresses').lean();
    if (!cust) return res.status(404).json({ error: 'not found' });
    res.json(cust.addresses || []);
  } catch (e) {
    console.error('addresses list error', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Add address
app.post('/api/customers/addresses', requireCustomer, async (req, res) => {
  try {
    const { label, address, phone, pincode } = req.body || {};
    if (!address || !pincode) return res.status(400).json({ error: 'address and pincode required' });
    // normalize phone if provided
    let phoneNorm = '';
    if (phone) {
      const digits = String(phone).replace(/\D/g, '');
      phoneNorm = digits.length === 10 ? `+91${digits}` : (digits.length >= 7 ? `+${digits}` : '');
    }
    const addr = { label: label || '', address, phone: phoneNorm, pincode: String(pincode).trim() };
    const cust = await Customer.findById(req.customerId);
    if (!cust) return res.status(404).json({ error: 'not found' });
    cust.addresses.push(addr);
    await cust.save();
    res.status(201).json(cust.addresses[cust.addresses.length - 1]);
  } catch (e) {
    console.error('add address error', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Edit address
app.patch('/api/customers/addresses/:addrId', requireCustomer, async (req, res) => {
  try {
    const { label, address, phone, pincode } = req.body || {};
    const cust = await Customer.findById(req.customerId);
    if (!cust) return res.status(404).json({ error: 'not found' });
    const addr = cust.addresses.id(req.params.addrId);
    if (!addr) return res.status(404).json({ error: 'address not found' });
    if (typeof label !== 'undefined') addr.label = label;
    if (typeof address !== 'undefined') addr.address = address;
    if (typeof pincode !== 'undefined') addr.pincode = String(pincode);
    if (typeof phone !== 'undefined') {
      const digits = String(phone).replace(/\D/g, '');
      addr.phone = digits.length === 10 ? `+91${digits}` : (digits.length >= 7 ? `+${digits}` : '');
    }
    await cust.save();
    res.json(addr);
  } catch (e) {
    console.error('edit address error', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Delete address
app.delete('/api/customers/addresses/:addrId', requireCustomer, async (req, res) => {
  try {
    const cust = await Customer.findById(req.customerId);
    if (!cust) return res.status(404).json({ error: 'not found' });
    const addr = cust.addresses.id(req.params.addrId);
    if (!addr) return res.status(404).json({ error: 'address not found' });
    addr.remove();
    await cust.save();
    res.json({ ok: true });
  } catch (e) {
    console.error('delete address error', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Customer: list own orders
app.get('/api/customers/orders', requireCustomer, async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.customerId }).sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (e) {
    console.error('customer orders error', e);
    res.status(500).json({ error: 'failed' });
  }
});

// Customer: get single order (owned)
app.get('/api/customers/orders/:id', requireCustomer, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ error: 'not found' });
    if (!order.customer || String(order.customer) !== String(req.customerId)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    res.json(order);
  } catch (e) {
    console.error('customer order detail error', e);
    res.status(400).json({ error: 'invalid id' });
  }
});

/* Twilio webhook (unchanged) */
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
      if (!shop) twiml.message(`Shop ${shopPhone} not found.`);
      else {
        const items = await MenuItem.find({ shop: shop._id, available: true });
        if (!items.length) twiml.message(`No items found for ${shop.name}.`);
        else {
          let msg = `Menu for ${shop.name}:\n`;
          items.forEach(it => (msg += `${it.externalId}. ${it.name} — ₹${it.price}\n`));
          msg += `\nTo order: order ${shop.phone} <itemId> <qty>`;
          twiml.message(msg);
        }
      }
    } else if (cmd === 'order' && parts[1] && parts[2] && parts[3]) {
      const shopPhone = parts[1];
      const itemExt = parts[2];
      const qty = Math.max(1, parseInt(parts[3], 10) || 1);
      const shop = await Shop.findOne({ phone: shopPhone });
      if (!shop) twiml.message(`Shop ${shopPhone} not found.`);
      else {
        const item = await MenuItem.findOne({ shop: shop._id, externalId: itemExt });
        if (!item) twiml.message(`Item ${itemExt} not found.`);
        else {
          const orderPayload = { shop: shop._id, customerName: `WhatsApp:${from}`, phone: from.replace(/^whatsapp:/, ''), items: [{ name: item.name, qty, price: item.price }] };
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

/* Start server */
server.listen(PORT, () => console.log(`Server running with Socket.io on port ${PORT}`));
