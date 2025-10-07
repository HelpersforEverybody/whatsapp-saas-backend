// ✅ server.js — Complete Backend with Admin + Merchant + Twilio + Sockets + /api/me/shops

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] },
});

const PORT = process.env.PORT || 3000;

/* ---------------- Middleware ---------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ---------------- Socket.IO ---------------- */
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  socket.on('joinOrder', ({ orderId }) => {
    if (orderId) {
      socket.join(`order:${orderId}`);
      console.log(`Socket ${socket.id} joined order room ${orderId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

function emitOrderUpdate(orderId, payload) {
  io.to(`order:${orderId}`).emit('orderStatusUpdate', payload);
}

/* ---------------- Config & Helpers ---------------- */
const API_KEY_ENV = process.env.API_KEY?.trim() || '';
const JWT_SECRET = process.env.JWT_SECRET?.trim() || 'secret';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || '';

function verifyJwtToken(authHeader) {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  try {
    return jwt.verify(parts[1], JWT_SECRET);
  } catch {
    return null;
  }
}

const requireApiKeyOrJwt = (req, res, next) => {
  const key = (req.get('x-api-key') || '').trim();
  const authHeader = (req.get('authorization') || '').trim();

  if (authHeader) {
    const decoded = verifyJwtToken(authHeader);
    if (decoded && (decoded.role === 'admin' || decoded.role === 'merchant')) {
      req.auth = decoded;
      return next();
    }
  }

  if (key && key === API_KEY_ENV) return next();
  res.status(401).json({ error: 'unauthorized' });
};

/* ---------------- MongoDB ---------------- */
mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

/* ---------------- Schemas ---------------- */
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  createdAt: { type: Date, default: Date.now },
});
userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compareSync(String(plain), this.passwordHash);
};
const User = mongoose.model('User', userSchema);

const shopSchema = new mongoose.Schema({
  name: String,
  phone: String,
  description: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
});
const Shop = mongoose.model('Shop', shopSchema);

const menuItemSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  name: String,
  price: Number,
  available: { type: Boolean, default: true },
  externalId: String,
});
const MenuItem = mongoose.model('MenuItem', menuItemSchema);

const orderSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' },
  customerName: String,
  phone: String,
  items: [{ name: String, qty: Number, price: Number }],
  total: Number,
  status: { type: String, default: 'received' },
  createdAt: { type: Date, default: Date.now },
});
const Order = mongoose.model('Order', orderSchema);

/* ---------------- Twilio ---------------- */
let twClient = null;
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_NUMBER;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && TWILIO_FROM) {
  const Twilio = require('twilio');
  twClient = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log('✅ Twilio client active');
} else {
  console.log('⚠️ Twilio not configured — skipping sends');
}

async function sendWhatsAppMessageSafe(toPhone, text) {
  if (!twClient) return console.log('Skipped WhatsApp send:', text);
  try {
    const msg = await twClient.messages.create({
      from: TWILIO_FROM,
      to: `whatsapp:${toPhone}`,
      body: text,
    });
    console.log('📩 WhatsApp sent:', msg.sid);
  } catch (err) {
    console.error('Twilio send error:', err.message);
  }
}

/* ---------------- Auth ---------------- */

// Admin Login
app.post('/auth/login', (req, res) => {
  const { password } = req.body || {};
  if (!ADMIN_PASSWORD) return res.status(500).json({ error: 'ADMIN_PASSWORD missing' });
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'invalid credentials' });

  const token = jwt.sign({ role: 'admin', issuedAt: Date.now() }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// Merchant Signup
app.post('/auth/signup', async (req, res) => {
  try {
    const { name, email, password, createShop } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'missing fields' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'email already exists' });

    const hash = bcrypt.hashSync(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), passwordHash: hash });

    let shop = null;
    if (createShop && createShop.name && createShop.phone) {
      shop = await Shop.create({
        name: createShop.name,
        phone: createShop.phone,
        description: createShop.description || '',
        owner: user._id,
      });
    }

    res.status(201).json({ userId: user._id, shopId: shop ? shop._id : null });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'server error' });
  }
});

// Merchant Login
app.post('/auth/merchant-login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !user.verifyPassword(password)) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ role: 'merchant', userId: user._id }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, userId: user._id });
});

/* ---------------- Middleware ---------------- */
const requireOwner = async (req, res, next) => {
  const decoded = verifyJwtToken(req.get('authorization'));
  if (!decoded || decoded.role !== 'merchant') return res.status(401).json({ error: 'unauthorized' });
  req.merchantId = decoded.userId;

  const shopId = req.params.shopId || req.body.shopId;
  if (shopId) {
    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ error: 'shop not found' });
    if (String(shop.owner) !== String(req.merchantId)) return res.status(403).json({ error: 'not your shop' });
  }
  next();
};

/* ---------------- API Routes ---------------- */

// ✅ /api/me/shops — get shops owned by current merchant
app.get('/api/me/shops', requireOwner, async (req, res) => {
  const shops = await Shop.find({ owner: req.merchantId });
  res.json(shops);
});

// Create shop
app.post('/api/shops', requireOwner, async (req, res) => {
  const { name, phone, description } = req.body;
  const shop = await Shop.create({ name, phone, description, owner: req.merchantId });
  res.status(201).json(shop);
});

// Get public shops
app.get('/api/shops', async (req, res) => {
  const shops = await Shop.find().select('-__v');
  res.json(shops);
});

// Add menu item
app.post('/api/shops/:shopId/items', requireOwner, async (req, res) => {
  const { name, price } = req.body;
  const item = await MenuItem.create({
    shop: req.params.shopId,
    name,
    price,
    externalId: Math.random().toString(36).slice(2, 8).toUpperCase(),
  });
  res.status(201).json(item);
});

// Edit menu item
app.patch('/api/shops/:shopId/items/:itemId', requireOwner, async (req, res) => {
  const item = await MenuItem.findOneAndUpdate(
    { _id: req.params.itemId, shop: req.params.shopId },
    req.body,
    { new: true }
  );
  res.json(item);
});

// Delete menu item
app.delete('/api/shops/:shopId/items/:itemId', requireOwner, async (req, res) => {
  await MenuItem.deleteOne({ _id: req.params.itemId, shop: req.params.shopId });
  res.json({ success: true });
});

// Get menu
app.get('/api/shops/:shopId/menu', async (req, res) => {
  const items = await MenuItem.find({ shop: req.params.shopId });
  res.json(items);
});

// Create order (customer)
app.post('/api/orders', async (req, res) => {
  const { shop, customerName, phone, items } = req.body;
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  const order = await Order.create({ shop, customerName, phone, items, total });
  sendWhatsAppMessageSafe(phone, `Hi ${customerName}, your order ${order._id} was received!`);
  res.status(201).json(order);
});

// Get shop orders
app.get('/api/shops/:shopId/orders', requireOwner, async (req, res) => {
  const orders = await Order.find({ shop: req.params.shopId }).sort({ createdAt: -1 });
  res.json(orders);
});

// Update order status
app.patch('/api/orders/:id/status', requireApiKeyOrJwt, async (req, res) => {
  const { status } = req.body;
  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (order) {
    sendWhatsAppMessageSafe(order.phone, `Your order ${order._id} status updated: ${status}`);
    emitOrderUpdate(order._id.toString(), { orderId: order._id, status });
  }
  res.json(order);
});

/* ---------------- WhatsApp Webhook ---------------- */
app.post('/webhook/whatsapp', async (req, res) => {
  const from = req.body.From || req.body.from || '';
  const msg = (req.body.Body || '').trim().toLowerCase();
  console.log('📩 WhatsApp:', from, msg);

  const MessagingResponse = require('twilio').twiml.MessagingResponse;
  const twiml = new MessagingResponse();

  const [cmd, arg1, arg2, arg3] = msg.split(/\s+/);

  try {
    if (cmd === 'menu') {
      const shop = await Shop.findOne({ phone: arg1 });
      if (!shop) twiml.message('Shop not found');
      else {
        const items = await MenuItem.find({ shop: shop._id, available: true });
        if (!items.length) twiml.message('No items yet.');
        else {
          let text = `Menu for ${shop.name}:\n`;
          items.forEach(i => (text += `${i.externalId}: ${i.name} ₹${i.price}\n`));
          twiml.message(text);
        }
      }
    } else if (cmd === 'order') {
      const shop = await Shop.findOne({ phone: arg1 });
      if (!shop) twiml.message('Shop not found');
      else {
        const item = await MenuItem.findOne({ shop: shop._id, externalId: arg2 });
        if (!item) twiml.message('Item not found');
        else {
          const qty = parseInt(arg3) || 1;
          const total = item.price * qty;
          const order = await Order.create({
            shop: shop._id,
            customerName: `WhatsApp:${from}`,
            phone: from.replace(/^whatsapp:/, ''),
            items: [{ name: item.name, qty, price: item.price }],
            total,
          });
          sendWhatsAppMessageSafe(shop.phone, `📦 New order ${order._id} — ${item.name} x${qty}`);
          twiml.message(`✅ Order placed: ${order._id} (₹${total})`);
        }
      }
    } else if (cmd === 'status') {
      const order = await Order.findById(arg1);
      if (!order) twiml.message('Order not found');
      else twiml.message(`Status of ${order._id}: ${order.status}`);
    } else {
      twiml.message('Commands:\nmenu <shopPhone>\norder <shopPhone> <itemId> <qty>\nstatus <orderId>');
    }
  } catch (err) {
    console.error('Webhook error:', err);
    twiml.message('Server error.');
  }

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

/* ---------------- Start ---------------- */
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
