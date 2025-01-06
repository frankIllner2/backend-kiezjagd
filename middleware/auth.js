const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: '❌ Kein Token vorhanden.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Admin-Details hinzufügen
    next();
  } catch (err) {
    console.error('❌ Fehler bei Token-Validierung:', err.message);
    return res.status(401).json({ message: '❌ Ungültiger oder abgelaufener Token.' });
  }
};
