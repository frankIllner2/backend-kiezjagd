// 📁 middleware/auth.js
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Middleware: prüft, ob ein gültiger Token vorhanden ist
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "❌ Kein Token vorhanden." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // z. B. { username: "admin", isAdmin: true }
    next();
  } catch (err) {
    console.error("❌ Fehler bei Token-Validierung:", err.message);
    return res.status(401).json({ message: "❌ Ungültiger oder abgelaufener Token." });
  }
}

// Middleware: nur erlaubt, wenn isAdmin: true im Token steht
function verifyAdmin(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user?.isAdmin === true) {
      next();
    } else {
      return res.status(403).json({ message: "❌ Adminrechte erforderlich." });
    }
  });
}

module.exports = { verifyToken, verifyAdmin };
