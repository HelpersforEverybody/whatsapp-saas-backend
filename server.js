// server.js — Full backend with Shop & Menu support + WhatsApp commands
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
const http = require('http');
const server = http.createServer(app); // Create HTTP server for Socket.io
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: '*', // 🔸 Change to your frontend URL later
    methods: ['GET', 'POST']
  }
});
const PORT = process.env.PORT || 3000;

/* ----------------- middleware ----------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ---------------- SOCKET.IO SETUP ----------------
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('joinOrder', ({ orderId }) => {
    if (!orderId) return;
    socket.join(`order:${orderId}`);
    console.log(`Socket ${socket.id} joined order room ${orderId}`);
  });

  socket.on('joinRestaurant', ({ restaurantId }) => {
    if (!restaurantId) return;
    socket.join(`restaurant:${restaurantId}`);
    console.log(`Socket ${socket.id} joined restaurant room ${restaurantId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Helper function to emit status updates
function emitOrderUpdate(orderId, payload) {
  // Emit to order-specific room
  io.to(`order:${orderId}`).emit('orderStatusUpdate', payload);

  // Also emit to restaurant room if restaurantId present
  if (payload && payload.meta && payload.meta.restaurantId) {
    io.to(`restaurant:${payload.meta.restaurantId}`).emit('restaurantOrderUpdate', payload);
  }

  // Optionally emit to user room keyed by phone (if you use user rooms)
  if (payload && payload.meta && payload.meta.userPhone) {
    io.to(`user:${payload.meta.userPhone}`).emit('personalOrderUpdate', payload);
  }
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

/* ----------------- MongoDB connection ----------------- */
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

/* ----------------- Models ----------------- */

// Shop
const shopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true }, // e.g. +9198...
  description: String,
  createdAt: { type: Date, default: Date.now },
});
const Shop = mongoose.model('Shop', shopSchema);

// MenuItem
const menuItemSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true },
  price: { type: Number, default: 0 },
  available: { type: Boolean, default: true },
  externalId: { type: String }, // short id customers type on WhatsApp
  createdAt: { type: Date, default: Date.now },
});
const MenuItem = mongoose.model('MenuItem', menuItemSchema);

// Order (extended to include shop reference)
const orderSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop' }, // optional if created via API
  customerName: { type: String, required: true },
  phone: { type: String, required: true }, // e.g. +9198...
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

/* ----------------- Routes: Merchant / Public APIs ----------------- */

/* Health check */
app.get('/status', (req, res) => res.json({ status: 'ok', time: new Date() }));

/* Create Shop (merchant) */
app.post('/api/shops', requireApiKey, async (req, res) => {
  try {
    const { name, phone, description } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });
    const shop = await Shop.create({ name, phone, description });
    res.status(201).json(shop);
  } catch (err) {
    console.error('Create shop error:', err);
    res.status(500).json({ error: 'failed to create shop', detail: err.message });
  }
});

/* Add Menu Item (merchant) */
app.post('/api/shops/:shopId/items', requireApiKey, async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    // generate short externalId
    const externalId = Math.random().toString(36).slice(2, 8).toUpperCase();
    const item = await MenuItem.create({ shop: req.params.shopId, name, price: Number(price || 0), externalId });
    res.status(201).json(item);
  } catch (err) {
    console.error('Add menu item error:', err);
    res.status(500).json({ error: 'failed to add item' });
  }
});

/* Edit menu item (merchant) */
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

/* Create order (merchant or public via UI) */
app.post('/api/orders', requireApiKey, async (req, res) => {
  try {
    const { shop: shopId, customerName, phone, items = [] } = req.body;
    if (!customerName || !phone) return res.status(400).json({ error: 'customerName and phone required' });
    const total = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);
    const order = await Order.create({ shop: shopId || null, customerName, phone, items, total });

    // Send confirmation to customer (non-blocking)
    sendWhatsAppMessageSafe(phone, `Hi ${customerName}, we received your order ${order._id}. Total: ₹${total}`).catch(() => {});

    // Emit socket update for new order
    emitOrderUpdate(order._id.toString(), {
      orderId: order._id.toString(),
      status: order.status,
      at: new Date().toISOString(),
      meta: {
        note: 'Order created via API',
        restaurantId: order.shop ? order.shop.toString() : null,
        userPhone: order.phone
      }
    });

    res.status(201).json(order);
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'failed to create order' });
  }
});

/* List (recent) orders (merchant) - optionally filter by shop */
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

/* Merchant: list orders for a particular shop */
app.get('/api/shops/:shopId/orders', requireApiKey, async (req, res) => {
  try {
    const orders = await Order.find({ shop: req.params.shopId }).sort({ createdAt: -1 }).limit(200);
    res.json(orders);
  } catch (err) {
    console.error('Shop orders error:', err);
    res.status(500).json({ error: 'failed' });
  }
});

/* Update order status (merchant) */
app.patch('/api/orders/:id/status', requireApiKey, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ error: 'not found' });

    // notify customer
    sendWhatsAppMessageSafe(order.phone, `Order ${order._id} status updated: ${status}`).catch(() => {});

    // Emit socket update for status change
    emitOrderUpdate(order._id.toString(), {
      orderId: order._id.toString(),
      status,
      at: new Date().toISOString(),
      meta: {
        note: `Status updated via API: ${status}`,
        restaurantId: order.shop ? order.shop.toString() : null,
        userPhone: order.phone
      }
    });

    res.json(order);
  } catch (err) {
    console.error('Update status error:', err);
    res.status(400).json({ error: 'invalid request' });
  }
});

/* ----------------- Twilio webhook for WhatsApp (public) ----------------- */
/* Supports:
   - menu <shopPhone>
   - order <shopPhone> <itemExternalId> <qty>
   - status <orderId>
   - accept <orderId>   (shop can accept an order via WhatsApp)
*/
app.post('/webhook/whatsapp', async (req, res) => {
  const fromRaw = (req.body.From || req.body.from || '').toString();
  // normalize from: remove 'whatsapp:' prefix if present
  const from = fromRaw.replace(/^whatsapp:/i, '').trim();
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
      // order <shopPhone> <itemExternalId> <qty>
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
            phone: from,
            items: [{ name: item.name, qty, price: item.price }],
          };
          const total = item.price * qty;
          const order = await Order.create({ ...orderPayload, total });
          // notify shop owner (optional)
          sendWhatsAppMessageSafe(shop.phone, `📥 New order ${order._id} from ${order.phone} — ${item.name} x${qty} — ₹${total}`).catch(() => {});
          twiml.message(`✅ Order placed: ${order._id}\nTotal: ₹${total}\nYou will receive updates here.`);

          // Emit socket update for new order created via WhatsApp
          emitOrderUpdate(order._id.toString(), {
            orderId: order._id.toString(),
            status: order.status,
            at: new Date().toISOString(),
            meta: {
              note: 'Order created via WhatsApp',
              restaurantId: shop._id.toString(),
              userPhone: order.phone
            }
          });
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

    } else if (cmd === 'accept' && parts[1]) {
      // allow shop to accept an order via WhatsApp: accept <orderId>
      // We ensure the sender is the shop's phone by matching 'from' against shop.phone
      try {
        const orderId = parts[1];
        const order = await Order.findById(orderId);
        if (!order) {
          twiml.message(`Order ${orderId} not found.`);
        } else if (!order.shop) {
          twiml.message(`Order ${orderId} has no associated shop.`);
        } else {
          // load shop and compare sender
          const shop = await Shop.findById(order.shop);
          if (!shop) {
            twiml.message('Associated shop not found.');
          } else if (shop.phone.replace(/\D/g, '') !== from.replace(/\D/g, '')) {
            // Sender is not shop owner/phone
            // Note: phone formatting may differ; adjust comparisons as needed
            twiml.message('You are not authorized to accept this order (sender mismatch).');
          } else {
            // update status
            order.status = 'accepted';
            await order.save();

            // notify customer
            sendWhatsAppMessageSafe(order.phone, `Your order ${order._id} has been accepted by ${shop.name}`).catch(() => {});
            twiml.message(`Order ${order._id} accepted ✅`);

            // Emit socket update for accepted status
            emitOrderUpdate(order._id.toString(), {
              orderId: order._id.toString(),
              status: order.status,
              at: new Date().toISOString(),
              meta: {
                note: 'Order accepted via WhatsApp',
                restaurantId: shop._id.toString(),
                userPhone: order.phone
              }
            });
          }
        }
      } catch (e) {
        console.error('Accept command error:', e);
        twiml.message('Failed to accept order.');
      }

    } else {
      twiml.message(
        'Welcome. Commands:\n1) menu <shopPhone>\n2) order <shopPhone> <itemId> <qty>\n3) status <orderId>\n4) accept <orderId>  (shop only)'
      );
    }
  } catch (err) {
    console.error('Webhook error:', err);
    twiml.message('Server error.');
  }

  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});
// --- Add this route to server.js for quick Socket.IO testing ---
app.get('/socket-test', (req, res) => {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Socket.IO Test</title>
    <style>
      body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; padding: 20px; }
      input, button { padding: 8px; font-size: 14px; }
      #log { margin-top: 12px; white-space: pre-wrap; border:1px solid #eee; padding:10px; height:260px; overflow:auto; background:#fafafa; }
    </style>
  </head>
  <body>
    <h2>Socket.IO Test</h2>
    <div>
      <label>Order ID: <input id="orderId" placeholder="paste order id here" style="width:320px" /></label>
      <button id="joinBtn">Connect & Join</button>
      <button id="disconnectBtn">Disconnect</button>
    </div>

    <div id="log">Logs will appear here...</div>

    <script src="https://cdn.socket.io/4.7.1/socket.io.min.js"></script>
    <script>
      const logEl = document.getElementById('log');
      function log(...args) { logEl.textContent += '\\n' + args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' '); logEl.scrollTop = logEl.scrollHeight; }

      let socket = null;
      document.getElementById('joinBtn').addEventListener('click', () => {
        const orderId = document.getElementById('orderId').value.trim();
        if (!orderId) return alert('enter order id');

        if (socket && socket.connected) {
          log('Already connected — joining room', orderId);
          socket.emit('joinOrder', { orderId });
          return;
        }

        // connect to same origin - omitted host will use current origin
        socket = io(window.location.origin);

        socket.on('connect', () => {
          log('Connected, socket id:', socket.id);
          socket.emit('joinOrder', { orderId });
          log('Joined order room:', orderId);
        });

        socket.on('disconnect', (reason) => {
          log('Disconnected:', reason);
        });

        socket.on('orderStatusUpdate', (data) => {
          log('orderStatusUpdate ->', data);
        });

        socket.on('restaurantOrderUpdate', (data) => {
          log('restaurantOrderUpdate ->', data);
        });

        log('Connecting...');
      });

      document.getElementById('disconnectBtn').addEventListener('click', () => {
        if (socket) {
          socket.disconnect();
          log('Manual disconnect called.');
          socket = null;
        }
      });
    </script>
  </body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/* ----------------- Start server ----------------- */
server.listen(PORT, () => console.log(`Server running with Socket.io on port ${PORT}`));
