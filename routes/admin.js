const express = require('express');
const router = express.Router();
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const Game = require('../models/Game');

// 🔒 Nur für Admins: Spiel abrufen
router.get('/game/:encryptedId', verifyAdmin, async (req, res) => {
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

// ✅ Admin-Bereich mit Token-Check
router.get('/', verifyToken, (req, res) => {
  res.json({ message: '🔒 Admin-Bereich gesichert.' });
});

// ✅ Dashboard inkl. Benutzerinfo
router.get('/dashboard', verifyToken, (req, res) => {
  res.json({
    message: '📊 Admin-Dashboard geladen.',
    user: req.user
  });
});

// ✅ Testroute: Bin ich Admin?
router.get('/whoami', verifyToken, (req, res) => {
  res.json({
    username: req.user.username,
    isAdmin: req.user.isAdmin,
  });
});

module.exports = router;
