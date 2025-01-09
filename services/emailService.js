const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // Falls du STARTTLS verwendest, setze dies auf `false`
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  debug: true, // Aktiviert Debugging
  logger: true, // Protokolliert SMTP-Kommunikation
});

async function sendGameLink(email, gameId) {
  const link = `${process.env.FRONTEND_URL}/game/${gameId}`;
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: '🎮 Dein Spiel-Link für Kiezjagd',
    text: `Hallo,\n\nHier ist der Link zu deinem Spiel: ${link}\n\nViel Spaß beim Spielen!\nDein Kiezjagd-Team`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ E-Mail erfolgreich gesendet:', info.response);
  } catch (error) {
    console.error('❌ Fehler beim Senden der E-Mail:', error.message);
  }
}

module.exports = { sendGameLink };
