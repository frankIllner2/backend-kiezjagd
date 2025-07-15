const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const router = express.Router();

// 🔐 Login-Route für Admin
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Benutzername prüfen
  if (username !== process.env.ADMIN_USERNAME) {
    return res.status(401).json({ message: '❌ Benutzername ist falsch.' });
  }

  // Passwort prüfen
  const isPasswordValid = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
  if (!isPasswordValid) {
    return res.status(401).json({ message: '❌ Passwort ist falsch.' });
  }

  // JWT erstellen
  const token = jwt.sign(
     { username, isAdmin: true },
    process.env.JWT_SECRET, 
    { expiresIn: '1h' }
  );

  res.json({ token });
});

// 🔑 Token validieren (optional für Debugging oder Router-Guards)
router.get('/validate', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: '❌ Kein Token vorhanden.' });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({ message: '✅ Token ist gültig.' });
  } catch (err) {
    console.error('❌ Token ungültig:', err.message);
    res.status(401).json({ message: '❌ Token ist ungültig oder abgelaufen.' });
  }
});

module.exports = router;
