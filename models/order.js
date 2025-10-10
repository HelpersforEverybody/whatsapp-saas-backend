// server/models/Order.js
const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  // store name and price at time of order (so history is consistent)
  itemId: { type: mongoose.Schema.Types.ObjectId, required: false }, // optional if you store _id
  name: { type: String, required: true },
  qty: { type: Number, required: true, default: 1 },
  price: { type: Number, required: true }, // price per unit at order time
  total: { type: Number, required: true } // qty * price (redundant but convenient)
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  orderNumber: { type: Number, required: true, index: true, unique: true }, // numeric visible id
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: false },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerName: String,
  phone: String,
  address: {
    label: String,
    address: String,
    phone: String,
    pincode: String
  },
  items: [OrderItemSchema],
  itemsTotal: { type: Number, required: true }, // sum of item totals
  deliveryFee: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true }, // itemsTotal + deliveryFee etc
  status: { type: String, default: 'received' }, // e.g., received, preparing, dispatched, delivered, cancelled
  meta: { type: Object, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);
