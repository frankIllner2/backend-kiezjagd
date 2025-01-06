const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// ✅ Geschützte Admin-Route
router.get('/', auth, (req, res) => {
  res.json({ message: '🔒 Admin-Bereich gesichert.' });
});

// ✅ Admin-Dashboard
router.get('/dashboard', auth, (req, res) => {
  res.json({ message: '📊 Admin-Dashboard geladen.', user: req.user });
});

module.exports = router;
