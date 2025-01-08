const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  email: { type: String, required: true },
  paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  startTime: { type: Date },
  endTime: { type: Date },
  isExpired: { type: Boolean, default: false },
  sessionId: { type: String }, // Stripe-Session-ID hinzufügen
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);
