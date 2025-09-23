// utils/mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: String(process.env.EMAIL_SECURE) === "true", // bei 587 meist false
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  logger: true,  // <-- Debug-Logs in der Konsole
  debug: true,   // <-- noch mehr Details
  // Für manche Provider in DEV nötig. Erst testen, dann ggf. entfernen:
  tls: { rejectUnauthorized: false },
});

// beim Start prüfen
transporter.verify((err, success) => {
  if (err) {
    console.error("[MAILER] verify() failed:", err.message);
  } else {
    console.log("[MAILER] SMTP ready:", success);
  }
});

async function send({ to, subject, html, text }) {
  try {
    return await transporter.sendMail({
      from: `"Kiezjagd" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    // Hier explizit loggen – kommt in der Route als 500 zurück
    console.error("[MAILER] send() error:", err && (err.response || err.message || err));
    throw err;
  }
}

module.exports = { send };
