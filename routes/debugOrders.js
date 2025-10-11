// e.g. src/routes/debugOrders.js (then mount under /api/debug/orders)
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

router.get('/', async (req, res) => {
  try {
    const list = await Order.find({}).sort({ createdAt: -1 }).limit(50).lean();
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).send('err');
  }
});

module.exports = router;
