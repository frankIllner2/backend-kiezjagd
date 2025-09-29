const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const path = require('path');   // ✅ benötigt
const fs = require('fs');       // ✅ benötigt
const { generateCertificateBuffer } = require('./generateCertificateBuffer');
const Team = require('../models/Teams');
const Result = require('../models/Result');
const Game = require('../models/Game');

const { ObjectId } = mongoose.Types;

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
  if (ObjectId.isValid(gameId) && String(new ObjectId(gameId)) === String(gameId)) {
    const byId = await Game.findById(gameId);
    if (byId) return byId;
  }
  const byString = await Game.findOne({ gameId });
  if (byString) return byString;
  return null;
}

async function sendCertificate(resultId) {
  const result = await Result.findById(resultId);
  if (!result) throw new Error('Ergebnis nicht gefunden');

  const [team, game] = await Promise.all([
    Team.findOne({ name: result.teamName, gameId: result.gameId }),
    Game.findOne({ encryptedId: result.gameId }),
  ]);

  if (!team) throw new Error('Team nicht gefunden');
  if (!game) throw new Error(`Spiel nicht gefunden für gameId="${result.gameId}"`);

  // ✅ Nur wenn "withCertificate" true ist → Mail + Urkunde
  if (!game.withCertificate) {
    console.log(`📭 Kein Mailversand für Spiel "${game.name}" (withCertificate=false).`);
    return { status: 'skipped', reason: 'withCertificate_disabled' };
  }

  const gameName = game.name || result.gameType || 'Kiezjagd';
  const recipient = result.email || team.email;
  if (!recipient) throw new Error('Keine Empfänger-E-Mail vorhanden');

  const mailTextFromDb = game.mailtext ?? game.mailText;

  // ✅ Inline-Images aus ../public/ laden
  const logoPath = path.join(__dirname, '../public/logo.png');
  const fritzPath = path.join(__dirname, '../public/fritz.png');
  const fridaPath = path.join(__dirname, '../public/frida.png');

  const inlineImages = [];
  const pushIfExists = (fullPath, cid) => {
    try {
      if (fs.existsSync(fullPath)) {
        inlineImages.push({
          filename: path.basename(fullPath),
          path: fullPath,
          cid,                       // muss mit <img src="cid:..."> matchen
          contentDisposition: 'inline',
        });
      } else {
        console.warn('⚠️ Asset nicht gefunden:', fullPath);
      }
    } catch (e) {
      console.warn('⚠️ Asset-Check fehlgeschlagen:', fullPath, e.message);
    }
  };

  pushIfExists(logoPath,  'logo@kiezjagd');
  pushIfExists(fritzPath, 'fritz@kiezjagd');
  pushIfExists(fridaPath, 'frida@kiezjagd');

  // Fallback-HTML (falls im Admin nichts hinterlegt ist)
  const defaultHtml = `
    <div style="font-family: 'Trebuchet MS', Arial, sans-serif; border-radius: 12px;">
      <!-- Logo oben links -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td align="left" style="padding: 16px 16px 0 16px;">
            <img src="cid:logo@kiezjagd" alt="Kiezjagd" style="display:block; width:120px; max-width:40%; height:auto;">
          </td>
        </tr>
      </table>

      <!-- Hauptinhalt -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding: 8px 16px 0 16px;">
            <h2 style="color: #355b4c; text-align: center; margin: 16px 0 8px;">Hurra, Abenteuer bestanden!</h2>
            <p style="font-size:16px; color:#333; margin: 0 0 12px;">
              Liebes Team <strong>{{teamName}}</strong>,
            </p>
            <p style="font-size:16px; color:#333; margin: 0 0 12px;">
              ihr habt das Spiel <strong>„{{gameName}}“</strong> erfolgreich abgeschlossen!
              Wir sind richtig stolz auf euch – ihr habt Rätsel gelöst, Geheimnisse entdeckt und euch tapfer durchgeschlagen.
            </p>
            <p style="font-size:16px; color:#333; margin: 0 0 12px;">
              Zeigt euren Erfolg euren Freundinnen und Freunden, hängt ihn an die Wand oder bewahrt ihn wie einen Schatz auf – denn ihr habt ihn euch wirklich verdient!
            </p>
            <p style="font-size:14px; color:#555; margin: 12px 0 0;">
               Viele Grüße und bis bald, <br>eure Fritz und Frida von Kiezjagd
            </p>
          </td>
        </tr>
      </table>

      <!-- Unten: Fritz links, Frida rechts -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:16px;">
        <tr>
          <td align="left" style="padding: 0 16px 16px 16px; vertical-align: bottom;">
            <img src="cid:fritz@kiezjagd" alt="Fritz" style="display:block; max-width:120px; height:auto;">
          </td>
          <td align="right" style="padding: 0 16px 16px 16px; vertical-align: bottom;">
            <img src="cid:frida@kiezjagd" alt="Frida" style="display:block; max-width:120px; height:auto;">
          </td>
        </tr>
      </table>
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
    attachments: [...inlineImages],
  };

  // ✅ Urkunde anhängen (da withCertificate garantiert true ist)
  const buffer = await generateCertificateBuffer({ team, result });
  mailOptions.attachments.push({
    filename: `Urkunde-${team.name}.pdf`,
    content: buffer,
    contentType: 'application/pdf',
  });

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Mail + Urkunde versendet:', info.response);
    return { status: 'sent', withCertificate: true, response: info.response };
  } catch (error) {
    console.error('❌ Fehler beim Mailversand:', error.message);
    throw error;
  }
}

module.exports = { sendCertificate };
