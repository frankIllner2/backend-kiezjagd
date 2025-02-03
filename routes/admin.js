const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Game = require('../models/Game');

// Middleware für Admin-Check
const adminAuth = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Zugriff verweigert: Nur für Admins.' });
  }
  next();
};

// Admin-Route zum Abrufen eines Spiels mit verschlüsselter ID
router.get('/game/:encryptedId', auth, adminAuth, async (req, res) => {

  try {
    const game = await Game.findOne({ encryptedId: req.params.encryptedId });
    if (!game) {
      return res.status(404).json({ message: 'Spiel nicht gefunden.' });
    }
    res.json(game);
  } catch (err) {
    console.error('Fehler beim Abrufen des Spiels:', err);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

// ✅ Geschützte Admin-Route
router.get('/', auth, (req, res) => {
  res.json({ message: '🔒 Admin-Bereich gesichert.' });
});

// ✅ Admin-Dashboard
router.get('/dashboard', auth, (req, res) => {
  res.json({ message: '📊 Admin-Dashboard geladen.', user: req.user });
});

module.exports = router;
