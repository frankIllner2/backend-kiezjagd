const express = require('express');
const router = express.Router();
const Result = require('../models/Result');

router.get('/check', async (req, res) => {
  const { teamName, gameId } = req.query;
  console.log('checkname');
  console.log(teamName);
  console.log(gameId);
  if (!teamName || !gameId) {
    return res.status(400).json({ message: 'Teamname und Spiel-ID sind erforderlich' });
  }

  try {
    // Prüfe, ob ein Team mit diesem Namen und Spiel-ID existiert
    const existingTeam = await Result.findOne({ teamName, gameId });
    if (existingTeam) {
      return res.json({ exists: true });
    }
    res.json({ exists: false });
  } catch (error) {
    console.error('Fehler bei der Überprüfung des Teamnamens:', error.message);
    res.status(500).json({ message: 'Interner Serverfehler', error: error.message });
  }
});


module.exports = router;
