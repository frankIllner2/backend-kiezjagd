const cron = require('node-cron');
const Order = require('./models/Order');

// ✅ Abgelaufene Links deaktivieren
cron.schedule('0 * * * *', async () => {
  console.log('🕒 Überprüfe abgelaufene Spiele');
  const now = new Date();
  await Order.updateMany(
    { endTime: { $lt: now }, isExpired: false },
    { isExpired: true }
  );
  console.log('✅ Abgelaufene Spiele deaktiviert');
});
