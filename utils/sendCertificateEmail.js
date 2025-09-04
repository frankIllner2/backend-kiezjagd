const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const path = require('path');          // ⬅️ neu
const fs = require('fs');              // ⬅️ neu
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

  // 📁 Asset-Pfad und Inline-Images vorbereiten
  const ASSETS_DIR = process.env.ASSETS_DIR || path.join(__dirname, 'assets');
  const inlineImages = [];
  const pushIfExists = (filename, cid) => {
    try {
      const full = path.join(ASSETS_DIR, filename);
      if (fs.existsSync(full)) {
        inlineImages.push({ filename, path: full, cid });
      } else {
        console.warn(`⚠️ Asset nicht gefunden: ${full}`);
      }
    } catch (e) {
      console.warn(`⚠️ Konnte Asset nicht prüfen (${filename}):`, e.message);
    }
  };

  // Diese CIDs werden im HTML verwendet:
  pushIfExists('logo.png',  'logo@kiezjagd');
  pushIfExists('fritz.png', 'fritz@kiezjagd');
  pushIfExists('frida.png', 'frida@kiezjagd');

  // Standard-HTML (falls kein Admin-Template hinterlegt)
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
              Als Erinnerung an euren Erfolg gratulieren wir euch herzlich – ihr seid jetzt offizielle Kiezjäger:innen!
            </p>
            <p style="font-size:16px; color:#333; margin: 0 0 12px;">
              Zeigt euren Erfolg euren Freundinnen und Freunden, hängt ihn an die Wand oder bewahrt ihn wie einen Schatz auf – denn ihr habt ihn euch wirklich verdient!
            </p>
            <p style="font-size:14px; color:#555; margin: 12px 0 0;">
              Euer Kiezjagd-Team
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
    attachments: [
      ...inlineImages,
      // 📌 Falls du weiterhin ein PDF anhängen willst, lasse den folgenden Block aktiv.
      //     Wenn NICHT, einfach den if-Block unten entfernen.
    ],
  };

  if (withCertificate) {
    const buffer = await generateCertificateBuffer({ team, result });
    mailOptions.attachments.push({
      filename: `Urkunde-${team.name}.pdf`,
      content: buffer,
      contentType: 'application/pdf',
    });
  } else {
    console.log(`Urkundenanhang deaktiviert (withCertificate=false) für Spiel ${game.name}`);
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
