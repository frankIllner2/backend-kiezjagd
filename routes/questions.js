const express = require('express');
const router = express.Router();
const Game = require('../models/Game');

// Route: POST /api/questions/reorder
router.post('/reorder', async (req, res) => {
  const { gameId, reordered } = req.body;

  if (!gameId || !Array.isArray(reordered)) {
    return res.status(400).json({ error: 'Ungültige Daten. gameId und reordered erforderlich.' });
  }

  try {
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Spiel nicht gefunden' });
    }

    // Neue Reihenfolge anwenden:
    const reorderedQuestions = reordered
      .map(({ _id }) => game.questions.find((q) => q._id.toString() === _id))
      .filter(Boolean); // Filtere ungültige IDs raus

    if (reorderedQuestions.length !== game.questions.length) {
      return res.status(400).json({ error: 'Nicht alle Fragen wurden korrekt zugeordnet.' });
    }

    game.questions = reorderedQuestions;
    await game.save();

    res.json({ message: 'Fragenreihenfolge erfolgreich aktualisiert.' });
  } catch (error) {
    console.error('Fehler beim Sortieren der Fragen:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

module.exports = router;