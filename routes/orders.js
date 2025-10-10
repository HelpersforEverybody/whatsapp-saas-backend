// server/routes/orders.js
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Counter = require('../models/Counter');
// require auth middleware used in your project; I'll assume `requireAuth(req,res,next)` sets req.user.id
const requireAuth = (req,res,next) => {
  // adapt to your project's auth implementation:
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

// Place an order
router.post('/orders', requireAuth, async (req,res) => {
  try {
    const payload = req.body;
    // validate minimal
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      return res.status(400).json({ error: 'No items' });
    }
    // compute totals (and ensure each item has price & qty)
    let itemsTotal = 0;
    const items = payload.items.map(it => {
      const price = Number(it.price || 0);
      const qty = Number(it.qty || 1);
      const total = price * qty;
      itemsTotal += total;
      return {
        itemId: it._id || it.itemId || null,
        name: it.name || 'Item',
        qty,
        price,
        total
      };
    });

    const orderNumber = await Counter.next('orderNumber');

    const order = new Order({
      orderNumber,
      shop: payload.shop || null,
      customerId: req.user.id,
      customerName: payload.customerName || '',
      phone: payload.phone || '',
      address: payload.address || {},
      items,
      itemsTotal,
      deliveryFee: payload.deliveryFee || 0,
      totalPrice: (itemsTotal + (payload.deliveryFee || 0)),
      status: payload.status || 'received',
      meta: payload.meta || {}
    });

    await order.save();
    return res.json({ ok: true, order });
  } catch (e) {
    console.error('POST /orders error', e);
    return res.status(500).json({ error: 'Order failed' });
  }
});

// List customer orders (paginated)
router.get('/customers/orders', requireAuth, async (req,res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Number(req.query.limit || 20));
    const skip = (page - 1) * limit;

    const q = { customerId: req.user.id };
    const total = await Order.countDocuments(q);
    const orders = await Order.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({ total, page, limit, orders });
  } catch (e) {
    console.error('GET /customers/orders error', e);
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order detail (customer)
router.get('/customers/orders/:id', requireAuth, async (req,res) => {
  try {
    const id = req.params.id;
    const order = await Order.findOne({ _id: id, customerId: req.user.id }).lean();
    if (!order) return res.status(404).json({ error: 'Not found' });
    return res.json({ order });
  } catch (e) {
    console.error('GET order detail', e);
    return res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
