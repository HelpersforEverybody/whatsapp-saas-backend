// server/models/Counter.js
const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});

CounterSchema.statics.next = async function (name) {
  const rec = await this.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return rec.seq;
};

module.exports = mongoose.model('Counter', CounterSchema);
