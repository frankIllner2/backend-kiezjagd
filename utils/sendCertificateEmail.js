const nodemailer = require('nodemailer');
const { generateCertificateBuffer } = require('./generateCertificateBuffer');
const Team = require('../models/Teams');
const Result = require('../models/Result');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: process.env.NODE_ENV === 'production' ? {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  } : undefined,
  debug: true,
  logger: true,
});

async function sendCertificate(resultId) {
  const result = await Result.findById(resultId);
  const team = await Team.findOne({ name: result.teamName, gameId: result.gameId });

  if (!team || !result) throw new Error('Team oder Ergebnis nicht gefunden');

  const buffer = await generateCertificateBuffer({ team, result });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: result.email,
    subject: `Eure Urkunde für das Spiel "${result.gameType}"`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #355b4c;">Herzlichen Glückwunsch, ${team.name}!</h2>
        <p>Ihr habt das Spiel <strong>${result.gameType}</strong> erfolgreich abgeschlossen.</p>
        <p>Im Anhang findet ihr eure Urkunde als PDF.</p>
        <p>Danke fürs Mitmachen & bis zur nächsten Kiezjagd!</p>
        <p>Euer Kiezjagd-Team</p>
      </div>
    `,
    attachments: [
      {
        filename: `Urkunde-${team.name}.pdf`,
        content: buffer,
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Urkunde versendet:', info.response);
  } catch (error) {
    console.error('❌ Fehler beim Senden der Urkunde:', error.message);
    throw error;
  }
}

module.exports = { sendCertificate };
