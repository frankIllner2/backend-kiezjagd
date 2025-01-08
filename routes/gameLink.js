const crypto = require('crypto');
const Order = require('../models/Order');

// ✅ Spiel-Link validieren
async function validateGameLink(gameId, encryptedEmail) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', process.env.ENCRYPTION_KEY, process.env.ENCRYPTION_IV);
    let email = decipher.update(encryptedEmail, 'hex', 'utf8');
    email += decipher.final('utf8');

    const order = await Order.findOne({ gameId, email });

    if (!order || order.isExpired || new Date() > order.endTime) {
      throw new Error('❌ Spiel-Link abgelaufen oder ungültig');
    }

    return order;
  } catch (error) {
    console.error('❌ Fehler bei der Link-Validierung:', error);
    throw error;
  }
}

module.exports = { validateGameLink };
