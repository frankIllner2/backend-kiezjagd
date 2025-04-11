const nodemailer = require('nodemailer');
const { generateInvoiceBuffer } = require('./generateInvoice');
const { v4: uuidv4 } = require('uuid'); // für Rechnungsnummer z. B.


const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // Falls du STARTTLS verwendest, setze dies auf `false`
  auth: process.env.NODE_ENV === 'production' ? {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  } : undefined,
  debug: true, // Aktiviert Debugging
  logger: true, // Protokolliert SMTP-Kommunikation
});

async function sendGameLink(email, sessionId, gameId, gameName, price) {
  const link = `${process.env.FRONTEND_URL}/game/${sessionId}/${gameId}`;
  const logoUrl =  `${process.env.FRONTEND_URL}/logo-email.png`;
  const fb = `${process.env.FRONTEND_URL}/fb.jpg`;
  const instagram = `${process.env.FRONTEND_URL}/insta.jpg`;

  const invoiceNumber = 'R-' + uuidv4().split('-')[0].toUpperCase();
  const date = new Date().toLocaleDateString('de-DE');

  const invoiceBuffer = await generateInvoiceBuffer({
    invoiceNumber,
    gameName,
    price,
    email,
    date,
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Dein Spiel "${gameName}" wartet auf dich!`,
    html: `
   <div style="font-family: Arial, sans-serif; text-align: left; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
  <img src="${logoUrl}" alt="Kiezjagd Logo" style="max-width: 150px; margin-bottom: 20px; display: block;">
  
  <div style="margin-bottom: 20px;">
    <a href="https://facebook.com" target="_blank" style="margin-right: 10px;">
      <img src="${fb}" alt="Facebook" width="24" height="24" style="vertical-align: middle;">
    </a>
    <a href="https://instagram.com" target="_blank" style="margin-right: 10px;">
      <img src="${insta}" alt="Instagram" width="24" height="24" style="vertical-align: middle;">
    </a>
  </div>


  <h2 style="color: #355b4c;">Willkommen zu deiner Kiezjagd!</h2>
  <p style="font-size: 16px; color: #355b4c;">Wir freuen uns, dass du dich für das Abenteuer <strong>"${gameName}"</strong> entschieden hast!</p>
  <p style="font-size: 16px; color: #355b4c;"><strong>Du kennst Kiezjagd schon?</strong></p>
  <p>Super, dann kannst du direkt loslegen!</p>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 20px 0;">
    <tr>
      <td align="center" bgcolor="#355b4c" style="border-radius: 5px; padding: 12px 24px;">
        <a href="${link}" target="_blank"
           style="font-size: 18px; color: #FAC227; text-decoration: none; display: inline-block; 
                  font-weight: bold; border-radius: 5px;">
           Spiel starten
        </a>
      </td>
    </tr>
  </table>

  <p style="font-size: 14px; color: #355b4c;"><strong>Das ist deine erste Kiezjagd?</strong></p>
  <p style="font-size: 14px; color: #355b4c;">Hier sind ein paar wichtige Hinweise und Tipps für dich:</p>

  <table role="presentation" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding: 5px;">✅</td>
      <td style="padding: 5px;">Mit einem Klick auf den Start-Button hast du 72 Stunden Zeit, um dein gewähltes Spiel einmalig zu spielen.</td>
    </tr>
    <tr>
      <td style="padding: 5px;">✅</td>
      <td style="padding: 5px;">Wichtig: Sei beim Spielstart am angegebenen Startpunkt, da du einige Rätsel nur mit Hilfe deiner Umgebung lösen kannst.</td>
    </tr>
  </table>

  <h3 style="color: #355b4c; margin-top: 20px;">Gemeinsam oder gegeneinander spielen:</h3>
  <table role="presentation" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding: 5px;">✅</td>
      <td style="padding: 5px;">Gemeinsam spielen: Tragt im Spiel mehrere Spielernamen ein. Ihr könnt das Handy oder Tablet einfach weitergeben.</td>
    </tr>
    <tr>
      <td style="padding: 5px;">✅</td>
      <td style="padding: 5px;">Gegeneinander spielen: Ihr könnt das Spiel mehrfach kaufen und auf zwei Geräten gleichzeitig starten.</td>
    </tr>
  </table>

  <hr>

  <h3 style="color: #355b4c;">Belohnungen & Kiezmeisterschaft</h3>
  
  <h4 style="color: #355b4c;">Mini-Kiezjagd:</h4>
  <p style="font-size: 14px; color: #355b4c;">Nach erfolgreichem Abschluss könnt ihr euch mit eurem Spieldatum in unsere Mitmachliste eintragen.</p>
  <table role="presentation" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding: 5px;">⭐</td>
      <td style="padding: 5px;">5 Sterne für die richtige Antwort beim ersten Versuch</td>
    </tr>
    <tr>
      <td style="padding: 5px;">⭐</td>
      <td style="padding: 5px;">3 Sterne beim zweiten Versuch</td>
    </tr>
    <tr>
      <td style="padding: 5px;">⭐</td>
      <td style="padding: 5px;">1 Stern beim dritten Versuch</td>
    </tr>
  </table>

  <h4 style="color: #355b4c;">Medi-Kiezjagd:</h4>
  <p style="font-size: 14px; color: #355b4c;">Tragt euch am Ende mit der Anzahl eurer gesammelten Sterne in die Kiezmeisterschaft ein.</p>
  <table role="presentation" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding: 5px;">⭐</td>
      <td style="padding: 5px;">5 Sterne für den ersten Versuch</td>
    </tr>
    <tr>
      <td style="padding: 5px;">⭐</td>
      <td style="padding: 5px;">3 Sterne beim zweiten Versuch</td>
    </tr>
    <tr>
      <td style="padding: 5px;">⭐</td>
      <td style="padding: 5px;">1 Stern beim dritten Versuch</td>
    </tr>
  </table>

  <h4 style="color: #355b4c;">Maxi-Kiezjagd:</h4>
  <p style="font-size: 14px; color: #355b4c;">Nach erfolgreichem Abschluss könnt ihr euch mit eurer Spielzeit in die Kiezmeisterschaft eintragen.</p>
  <table role="presentation" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td style="padding: 5px;">⭐</td>
      <td style="padding: 5px;">5 Sterne für den ersten Versuch</td>
    </tr>
    <tr>
      <td style="padding: 5px;">⭐</td>
      <td style="padding: 5px;">3 Sterne beim zweiten Versuch</td>
    </tr>
    <tr>
      <td style="padding: 5px;">⭐</td>
      <td style="padding: 5px;">1 Stern beim dritten Versuch</td>
    </tr>
    <tr>
      <td style="padding: 5px;">⏳</td>
      <td style="padding: 5px;">Jeder Stern bringt euch 30 Sekunden nach vorn im Ranking!</td>
    </tr>
  </table>

  <hr>

  <p>Du hast Ideen oder Feedback?</p>
  <p>Wir freuen uns über Anregungen! Schreib uns einfach an:</p>
  <p><a href="mailto:support@kiezjagd.de">support@kiezjagd.de</a></p>

  <p>Viel Spaß und eine erfolgreiche Kiezjagd! 🎯</p>
</div>

  `,
  attachments: [
    {
      filename: `Rechnung-${invoiceNumber}.pdf`,
      content: invoiceBuffer,
    },
  ],

  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ E-Mail erfolgreich gesendet:', info.response);
  } catch (error) {
    console.error('❌ Fehler beim Senden der E-Mail:', error.message);
  }
}

module.exports = { sendGameLink };
