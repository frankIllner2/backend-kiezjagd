const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  email: { type: String, required: true },
  gameName: { type: String, required: true },
  voucherCode: { type: String, default: null },
  price: Number,
  paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  startTime: { type: Date },
  endTime: { type: Date }, 
  isExpired: { type: Boolean, default: false },
  sessionId: { type: String }, // Stripe-Session-ID hinzufügen
  createdAt: { type: Date, default: Date.now },
  invoiceNumber: {type: String}
});

module.exports = mongoose.model('Order', OrderSchema);
