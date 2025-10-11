// server/models/Counter.js
const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // name of the counter, e.g. "orderNumber"
  seq: { type: Number, default: 0 },
}, { timestamps: true });

/**
 * Atomically increment and return next sequence for given counter name.
 * Usage: await Counter.next('orderNumber')
 */
CounterSchema.statics.next = async function(name) {
  if (!name) throw new Error('Counter name required');
  const updated = await this.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return updated.seq;
};

module.exports = mongoose.model('Counter', CounterSchema);
