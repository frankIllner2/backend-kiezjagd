const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true', // STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendGameLink(email, gameId) {
  const gameLink = `${process.env.FRONTEND_URL}/game/${gameId}?email=${encodeURIComponent(email)}`;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: '🎮 Dein Kiezjagd-Spiel-Link',
      text: `Hallo!\n\nHier ist dein Zugang zum Spiel:\n${gameLink}\n\nViel Spaß!\nDein Kiezjagd-Team`,
    });
    console.log('✅ E-Mail erfolgreich gesendet an:', email);
  } catch (error) {
    console.error('❌ Fehler beim Senden der E-Mail:', error.message);
    throw error;
  }
}

module.exports = { sendGameLink };
