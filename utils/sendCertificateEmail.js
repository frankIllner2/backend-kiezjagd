const nodemailer = require('nodemailer');
const mongoose = require('mongoose'); // <—
const { generateCertificateBuffer } = require('./generateCertificateBuffer');
const Team = require('../models/Teams');
const Result = require('../models/Result');
const Game = require('../models/Game');

const { ObjectId } = mongoose.Types; // <—

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: String(process.env.EMAIL_PORT) === '465',
  auth: process.env.NODE_ENV === 'production'
    ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    : undefined,
  debug: true,
  logger: true,
});

// sehr simples Platzhalter-Templating: {{key}}
function renderTemplate(tpl, data) {
  const str = String(tpl ?? '');
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(str);
  const base = hasHtml ? str : str.replace(/\n/g, '<br>');
  return base.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = data[key];
    return v !== undefined && v !== null ? String(v) : '';
  });
}

// Robust: Spiel anhand von ObjectId ODER String-Feld (gameId/slug) laden
async function loadGameByResultGameId(gameId) {
  // 1) Falls echt wie ein ObjectId aussieht, probiere findById
  if (ObjectId.isValid(gameId) && String(new ObjectId(gameId)) === String(gameId)) {
    const byId = await Game.findById(gameId);
    if (byId) return byId;
  }
  // 2) Fallback: eigenes String-Feld – hier "gameId"
  //    -> Falls dein Schema stattdessen "slug" o.Ä. nutzt, ändere die folgende Zeile:
  const byString = await Game.findOne({ gameId });
  if (byString) return byString;

  // Optional weiterer Fallback (nur wenn sinnvoll):
  // return await Game.findOne({ name: gameId });

  return null;
}

async function sendCertificate(resultId) {
  const result = await Result.findById(resultId);
  if (!result) throw new Error('Ergebnis nicht gefunden');

  // Parallel laden: Team + Spiel (robust)
  const [team, game] = await Promise.all([
    Team.findOne({ name: result.teamName, gameId: result.gameId }),
    Game.findOne({ encryptedId: result.gameId }),
  ]);

  if (!team) throw new Error('Team nicht gefunden');
  if (!game) throw new Error(`Spiel nicht gefunden für gameId="${result.gameId}"`);

  // robust: withCertificate oder (historisch) withCerticate
  const withCertificate =
    typeof game.withCertificate === 'boolean'
      ? game.withCertificate
      : Boolean(game.withCerticate);

  const gameName = game.name || result.gameType || 'Kiezjagd';
  const recipient = result.email || team.email;
  if (!recipient) throw new Error('Keine Empfänger-E-Mail vorhanden');

  // Mail-HTML aus DB (Schema: mailtext), Fallback auf Standard
  const mailTextFromDb = game.mailtext ?? game.mailText; // beides tolerieren
  const defaultHtml = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #355b4c;">Herzlichen Glückwunsch, {{teamName}}!</h2>
      <p>Ihr habt das Spiel <strong>{{gameName}}</strong> erfolgreich abgeschlossen.</p>
      ${withCertificate ? '<p>Im Anhang findet ihr eure Urkunde als PDF.</p>' : ''}
      <p>Danke fürs Mitmachen & bis zur nächsten Kiezjagd!</p>
      <p>Euer Kiezjagd-Team</p>
    </div>
  `;

  const html = renderTemplate(mailTextFromDb || defaultHtml, {
    teamName: team.name,
    gameName,
    duration: result.duration ?? '',
    stars: result.starCount ?? result.stars ?? '',
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipient,
    subject: `Eure Urkunde für "${gameName}"`,
    html,
  };

  if (withCertificate) {
    const buffer = await generateCertificateBuffer({ team, result });
    mailOptions.attachments = [{
      filename: `Urkunde-${team.name}.pdf`,
      content: buffer,
      contentType: 'application/pdf',
    }];
  } else {
    console.log(`ℹ️ Urkundenanhang deaktiviert (withCertificate=false) für Spiel ${game.name}`);
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(withCertificate ? '✅ Mail + Urkunde versendet:' : '✅ Mail (ohne Urkunde) versendet:', info.response);
    return { status: 'sent', withCertificate, response: info.response };
  } catch (error) {
    console.error('❌ Fehler beim Mailversand:', error.message);
    throw error;
  }
}

module.exports = { sendCertificate };
