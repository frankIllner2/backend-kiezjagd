const nodemailer = require('nodemailer');
const crypto = require('crypto');

// 📧 Transporter einrichten
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 📧 E-Mail mit verschlüsseltem Link senden
async function sendGameLink(email, gameId) {
  try {
    const cipher = crypto.createCipheriv('aes-256-cbc', process.env.ENCRYPTION_KEY, process.env.ENCRYPTION_IV);
    let encryptedEmail = cipher.update(email, 'utf8', 'hex');
    encryptedEmail += cipher.final('hex');

    const link = `${process.env.FRONTEND_URL}/game/${gameId}?email=${encodeURIComponent(encryptedEmail)}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Ihr Kiezjagd-Spiel-Link',
      text: `Hallo,\n\nHier ist der Link zu Ihrem Spiel: ${link}\n\nViel Spaß!\nIhr Kiezjagd-Team`,
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ E-Mail erfolgreich gesendet');
  } catch (error) {
    console.error('❌ Fehler beim E-Mail-Versand:', error);
    throw error;
  }
}

module.exports = { sendGameLink };
