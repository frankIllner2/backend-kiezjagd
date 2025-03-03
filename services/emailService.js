const nodemailer = require('nodemailer');

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

async function sendGameLink(email, sessionId, gameId, gameName) {
  const link = `${process.env.FRONTEND_URL}/game/${sessionId}/${gameId}`;
  const logoUrl = `${process.env.FRONTEND_URL}/img/logo.png`;
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Dein Spiel "${gameName}" wartet auf dich!`,
    html: `
    <div style="font-family: Arial, sans-serif; text-align: center; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
      <img src="${logoUrl}" alt="Kiezjagd Logo" style="max-width: 150px; margin-bottom: 20px;">
      <h2 style="color: #355b4c;">Willkommen zu deiner Kiezjagd!</h2>
      <p style="font-size: 16px; color: #355b4c;">Wir freuen uns, dass du dich für das Abenteuer <strong>"${gameName}"</strong> entschieden hast!</p>
      <p style="font-size: 16px; color: #355b4c;"><strong>Du kennst Kiezjagd schon?</strong> </p>
  <p>Super, dann kannst du direkt loslegen!</p><br />
  <a href="${link}"  target="_blank"  style="display: inline-block; background-color: #355b4c; color: #FAC227; padding: 10px 20px; text-decoration: none; font-size: 18px; border-radius: 5px; margin-top: 10px;">
        Spiel starten
      </a>
      <p style="font-size: 14px; color: #355b4c; margin-top: 20px;"><strong>Das ist deine erste Kiezjagd?</strong></p>
  <p style="font-size: 14px; color: #355b4c;">Hier sind ein paar wichtige Hinweise und Tipps für dich:</p>
  <ul style="font-size: 14px; color: #355b4c;">
    <li>Mit einem Klick auf den Start-Button hast du 72 Stunden Zeit, um dein gewähltes Spiel einmalig zu spielen.</li>
    <li>Wichtig: Sei beim Spielstart am angegebenen Startpunkt, da du einige Rätsel nur mit Hilfe deiner Umgebung lösen kannst.</li>
  </ul>
  
  <ul style="font-size: 14px; color: #355b4c;">
    <li>Gemeinsam spielen:
      Tragt im Spiel mehrere Spielernamen ein. Bei jeder Frage wird ein anderer von euch angesprochen. Ihr könnt das Handy oder Tablet einfach weitergeben.
    </li>
    <li>2.	Gegeneinander spielen:
      Ihr möchtet das Gerät nicht teilen? Dann könnt ihr das Spiel mehrfach kaufen und auf zwei Geräten gleichzeitig starten. So könnt ihr euch im Wettkampf messen!
    </li>
  </ul>
  <hr>
  <p style="font-size: 14px; color: #355b4c;"><strong>Belohnungen & Kiezmeisterschaft</strong> </p>
  <p style="font-size: 14px; color: #355b4c;">Mini-Kiezjagd:</p><br/>
  <p> style="font-size: 14px; color: #355b4c;"Nach erfolgreichem Abschluss könnt ihr euch mit eurem Spieldatum in unsere Mitmachliste eintragen.</p>
  <ul style="font-size: 14px; color: #355b4c;">
    <li>5 Sterne für die richtige Antwort beim ersten Versuch</li>
    <li>3 Sterne beim zweiten Versuch</li>
    <li>1 Stern beim dritten Versuch</li>
  </ul>
  <p style="font-size: 14px; color: #355b4c;">Medi-Kiezjagd:</p><br/>
  <p style="font-size: 14px; color: #355b4c;">Tragt euch am Ende mit der Anzahl eurer gesammelten Sterne in die Kiezmeisterschaft ein.</p>
  <ul style="font-size: 14px; color: #355b4c;">
    <li>5 Sterne für den ersten Versuch</li>
    <li>3 Sterne beim zweiten Versuch</li>
    <li>1 Stern beim dritten Versuch</li>
  </ul>
  <p style="font-size: 14px; color: #355b4c;">Maxi-Kiezjagd:</p><br/>
  <p style="font-size: 14px; color: #355b4c;">Nach erfolgreichem Abschluss könnt ihr euch mit eurer Spielzeit in die Kiezmeisterschaft eintragen.</p>
  <ul style="font-size: 14px; color: #355b4c;">
    <li>5 Sterne für den ersten Versuch</li>
    <li>3 Sterne beim zweiten Versuch</li>
    <li>1 Stern beim dritten Versuch <br />Extra: Am Ende könnt ihr eure Sterne in Zeit umtauschen: Jeder Stern bringt euch 30 Sekunden nach vorn im Ranking!</li>
  </ul>
  <hr>
  
  <p>Du hast Ideen oder Feedback?</p>
  <p>Wir freuen uns über Anregungen! Schreib uns einfach an:</p>
  <p>support@kiezjagd.de</p>
  <br><br>
  <p>Viel Spaß und eine erfolgreiche Kiezjagd! </p>
    </div>
  `,
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ E-Mail erfolgreich gesendet:', info.response);
  } catch (error) {
    console.error('❌ Fehler beim Senden der E-Mail:', error.message);
  }
}

module.exports = { sendGameLink };
