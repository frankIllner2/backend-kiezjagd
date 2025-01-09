const { sendGameLink } = require('../services/emailService');

(async () => {
  try {
    await sendGameLink('mail@frankillner.de', '123456');
    console.log('✅ Test-E-Mail erfolgreich gesendet');
  } catch (error) {
    console.error('❌ Fehler beim Testen des E-Mail-Versands:', error.message);
  }
})();
