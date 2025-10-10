// routes/teams.js
const express = require('express');
const router = express.Router();
// 👉 Dein Modell heißt plural:
const Team = require('../models/Teams');

// -------- Helpers --------
function normName(s = '') {
  return String(s).normalize('NFKC').replace(/\s+/g, ' ').trim();
}
function normEmail(s = '') {
  return String(s).trim().toLowerCase();
}
function sanitizePlayers(players) {
  return (Array.isArray(players) ? players : [])
    .map((p) => normName(p))
    .filter(Boolean)
    .slice(0, 8);
}

// Neues Team speichern
router.post('/', async (req, res) => {
  try {
    const { name, email, players, gameId } = req.body || {};

    const cleanName = normName(name);
    const emailNorm = normEmail(email);
    const cleanPlayers = sanitizePlayers(players);

    if (!gameId || !cleanName || !emailNorm || cleanPlayers.length < 1) {
      return res.status(400).json({ message: 'Ungültige Teaminformationen' });
    }

    // Doppelprüfung pro Spiel, case-insensitive.
    // Falls dein Schema ein Feld "nameLower" hat, wird es hier mit abgefragt.
    const existing = await Team.findOne({
      gameId,
      $or: [
        { nameLower: cleanName.toLowerCase() }, // funktioniert nur, wenn im Schema vorhanden
        { name: cleanName },
      ],
    }).collation({ locale: 'de', strength: 2 }); // case/diacritics-insensitive Vergleich

    if (existing) {
      return res.status(409).json({ message: 'Teamname bereits vergeben' });
    }

    const newTeam = await Team.create({
      name: cleanName,
      nameLower: cleanName.toLowerCase(), // wird ignoriert, wenn im Schema nicht definiert
      email: emailNorm,
      players: cleanPlayers,
      gameId,
      startTime: new Date(),
    });

    return res.status(201).json(newTeam);
  } catch (error) {
    if (error && error.code === 11000) {
      // z. B. aus Unique-Index (gameId + nameLower)
      return res.status(409).json({ message: 'Teamname bereits vergeben' });
    }
    console.error('❌ Fehler beim Team-Speichern:', error);
    return res.status(500).json({ message: 'Interner Fehler beim Speichern des Teams' });
  }
});

module.exports = router;
