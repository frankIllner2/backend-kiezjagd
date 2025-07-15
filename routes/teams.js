// routes/teams.js
const express = require('express');
const router = express.Router();
const Team = require('../models/Teams');

// Neues Team speichern
router.post('/', async (req, res) => {
  const { name, email, players, gameId } = req.body;

  if (!name || !email || !Array.isArray(players) || !gameId) {
    return res.status(400).json({ message: 'Ungültige Teaminformationen' });
  }

  try {
    const existing = await Team.findOne({ name, gameId });
    if (existing) {
      return res.status(409).json({ message: 'Teamname bereits vergeben' });
    }

    const newTeam = await Team.create({
      name,
      email,
      players,
      gameId,
      startTime: new Date(),
    });

    res.status(201).json(newTeam);
  } catch (error) {
    console.error('❌ Fehler beim Team-Speichern:', error);
    res.status(500).json({ message: 'Interner Fehler beim Speichern des Teams' });
  }
});

// Teamnamen prüfen
router.get('/check', async (req, res) => {
  const { teamName, gameId } = req.query;
  if (!teamName || !gameId) {
    return res.status(400).json({ message: 'Teamname und Spiel-ID sind erforderlich.' });
  }

  try {
    const existing = await Team.findOne({ name: teamName, gameId: gameId });
    res.json({ exists: !!existing }); // Antwort: { exists: true/false }
  } catch (error) {
    console.error('❌ Fehler beim Prüfen des Teamnamens:', error);
    res.status(500).json({ message: 'Fehler bei der Teamnamenprüfung' });
  }
});


module.exports = router;
