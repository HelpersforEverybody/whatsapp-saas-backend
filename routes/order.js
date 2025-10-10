// backend/routes/orders.js (or wherever you create orders)
const express = require('express');
const router = express.Router();
const Order = require('../models/order'); // your order model
const Counter = require('../models/counter');
const Shop = require('../models/shop'); // to read menu/prices if needed

async function nextSequence(name) {
  const res = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return res.seq;
}

router.post('/', async (req, res) => {
  try {
    const { shop: shopId, customerName, phone, address, items } = req.body;

    // fetch shop menu to capture current prices for each item
    const shop = await Shop.findById(shopId).lean();
    // assume shop.menu is available as array of { _id, name, price }
    const menu = (shop && shop.menu) || [];

    // build order items capturing price at this moment
    const orderItems = (items || []).map(it => {
      // try to find price on shop menu by id or name
      const menuItem = menu.find(m => String(m._id) === String(it._id) || m.name === it.name);
      const price = menuItem ? Number(menuItem.price || 0) : Number(it.price || 0);
      return {
        _id: it._id || null,
        name: it.name,
        qty: Number(it.qty || 1),
        price
      };
    });

    const orderNumber = await nextSequence('orderNumber');

    const orderDoc = new Order({
      orderNumber,          // numeric sequence
      shop: shopId,
      customerName,
      phone,
      address,
      items: orderItems,
      total: orderItems.reduce((s,i)=> s + (i.qty * i.price), 0),
      status: 'received',
      createdAt: new Date()
    });

    await orderDoc.save();

    res.json(orderDoc);
  } catch (err) {
    console.error("create order err", err);
    res.status(500).send(err.message || String(err));
  }
});

module.exports = router;
