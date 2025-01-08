const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  email: { type: String, required: true },
  paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  startTime: { type: Date },
  endTime: { type: Date },
  isExpired: { type: Boolean, default: false },
});

module.exports = mongoose.model('Order', OrderSchema);
