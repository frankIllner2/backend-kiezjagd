// models/NewsletterSubscriber.js
const mongoose = require('mongoose');

const newsletterSubscriberSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  subscribedAt: {
    type: Date,
    default: Date.now,
  },
  isUnsubscribed: {
    type: Boolean,
    default: false,
  },
  unsubscribedAt: {
    type: Date,
  }
});

module.exports = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);
