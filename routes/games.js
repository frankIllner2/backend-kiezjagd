const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const Result = require('../models/Result');

const crypto = require('crypto');


// Route: Alle Spiele abrufen
router.get('/', async (req, res) => {
  try {
    const games = await Game.find();
    res.json(games);
  } catch (err) {
    console.error('Fehler beim Abrufen der Spiele:', err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Zwei zufällige Spiele abrufen
router.get('/random', async (req, res) => {

  try {
    
    const randomGames = await Game.aggregate([{ $sample: { size: 3 } }]);

    if (!randomGames || randomGames.length === 0) {
      return res.status(404).json({ message: 'Keine zufälligen Spiele gefunden' });
    }

    res.json(randomGames.map(game => game.encryptedId));
  } catch (error) {
    console.error('❌ Fehler beim Abrufen zufälliger Spiele:', error);
    res.status(500).json({ message: 'Interner Serverfehler', error: error.message });
  }
});

  // Fragen für ein bestimmtes Spiel abrufen
  router.get('/:encryptedId/questions', async (req, res) => {
    try {
      const game = await Game.findOne({ encryptedId: req.params.encryptedId });
      if (!game) {
        return res.status(404).json({ message: 'Spiel nicht gefunden' });
      }
      res.json(game.questions || []);
    } catch (err) {
      console.error('Fehler beim Abrufen der Fragen:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // Frage hinzufügen
  router.post('/:encryptedId/questions', async (req, res) => {
    
    try {
      const game = await Game.findOne({ encryptedId: req.params.encryptedId });
      if (!game) {
  
        return res.status(404).json({ message: '❌ Spiel nicht gefunden' });
      }
  
      if (!req.body.question || req.body.question.trim() === '') {
        return res.status(400).json({ message: '⚠️ Frage darf nicht leer sein.' });
      }
  
      const newQuestion = {
        question: req.body.question,
        type: req.body.type,
        options: req.body.options || [],
        answer: req.body.answer || '',
        imageUrl: req.body.imageUrl || '',
      };
      console.log('########### addQestion 2 ###########');
      game.questions.push(newQuestion);
      await game.save();
  
      res.status(201).json(newQuestion);
      console.log('✅ Frage erfolgreich hinzugefügt');
    } catch (error) {
      console.error('❌ Fehler beim Hinzufügen der Frage:', error);
      res.status(500).json({ message: error.message });
    }
  });

  router.put('/:encryptedId/questions/:questionId', async (req, res) => {
    try {
      const game = await Game.findOne({ encryptedId: req.params.encryptedId });
      if (!game) {
        return res.status(404).json({ message: '❌ Spiel nicht gefunden' });
      }
  
      const question = game.questions.id(req.params.questionId);
      if (!question) {
        return res.status(404).json({ message: '❌ Frage nicht gefunden' });
      }
  
      // Aktualisiere Frage basierend auf dem Fragetyp
      question.question = req.body.question || question.question;
      question.answer = req.body.answer || question.answer;
      question.options = req.body.options || question.options;
      question.type = req.body.type || question.type;
      question.imageUrl = req.body.imageUrl || question.imageUrl;
  
      await game.save();
      res.status(200).json(question);
    } catch (error) {
      console.error('❌ Fehler beim Aktualisieren der Frage:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  router.get('/:encryptedId/top5', async (req, res) => {
    try {
      // Spiel anhand der encryptedId abrufen
      const game = await Game.findOne({ encryptedId: req.params.encryptedId });
      if (!game) {
        return res.status(404).json({ message: '❌ Spiel nicht gefunden - /:encryptedId/top5' });
      }
  
      // Top 5 Ergebnisse abrufen
      const topResults = await Result.find({ gameId: req.params.encryptedId })
        .sort({ duration: 1 }) // Sortiere nach kürzester Spielzeit
        .limit(5); // Beschränke auf die Top 5
  
      res.json({
        gameName: game.name,
        topResults,
      });
    } catch (error) {
      console.error('❌ Fehler beim Abrufen der Top 5 Ergebnisse:', error);
      res.status(500).json({ message: '❌ Interner Serverfehler', error: error.message });
    }
  });
  
// Route: Spiel anhand der verschlüsselten ID abrufen
router.get('/:encryptedId', async (req, res) => {
  try {
    const game = await Game.findOne({ encryptedId: req.params.encryptedId });
    if (!game) {
      return res.status(404).json({ message: 'Spiel nicht gefunden - /:encryptedId' });
    }
    res.json(game);
  } catch (err) {
    console.error('Fehler beim Abrufen des Spiels:', err);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

// Aktualisieren einer Frage innerhalb eines Spiels über encryptedId
router.put('/games/encrypted/:encryptedId/questions/:questionId', async (req, res) => {
  const { encryptedId, questionId } = req.params;
  const updatedQuestion = req.body;
  
  try {
    // Spiel anhand encryptedId finden
    const game = await Game.findOne({ encryptedId });
    if (!game) {
      return res.status(404).json({ message: 'Spiel nicht gefunden' });
    }

    // Frage im Spiel finden
    const questionIndex = game.questions.findIndex(q => q._id.toString() === questionId);
    if (questionIndex === -1) {
      return res.status(404).json({ message: 'Frage nicht gefunden' });
    }

    // Frage aktualisieren
    game.questions[questionIndex] = { 
      ...game.questions[questionIndex]._doc, 
      ...updatedQuestion 
    };

    await game.save();
    res.status(200).json({ 
      message: 'Frage erfolgreich aktualisiert', 
      question: game.questions[questionIndex] 
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Frage:', error);
    res.status(500).json({ 
      message: 'Interner Serverfehler', 
      error: error.message 
    });
  }
});

// Route: Neues Spiel erstellen
router.post('/', async (req, res) => {
  try {
    // Generiere eine verschlüsselte ID
    const encryptedId = crypto.randomBytes(16).toString('hex');

    // Neues Spiel erstellen
    const game = new Game({
      ...req.body,
      encryptedId,
    });

    const newGame = await game.save(); // Spiel speichern
    console.log('Spiel erfolgreich gespeichert:', newGame);

    res.status(201).json(newGame); // Erfolgreich erstellt
  } catch (err) {
    console.error('Fehler beim Erstellen des Spiels:', err);
    res.status(500).json({ message: err.message });
  }
});

// Route: Spiel aktualisieren
router.put('/:id', async (req, res) => {
  try {
    const updatedGame = await Game.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedGame) {
      return res.status(404).json({ message: 'Spiel nicht gefunden' });
    }
    console.log('Spiel erfolgreich aktualisiert:', updatedGame);
    res.json(updatedGame);
  } catch (err) {
    console.error('Fehler beim Aktualisieren des Spiels:', err);
    res.status(500).json({ message: err.message });
  }
});

// Route: Spiel löschen
router.delete('/:id', async (req, res) => {
  try {
    const deletedGame = await Game.findByIdAndDelete(req.params.id);
    if (!deletedGame) {
      return res.status(404).json({ message: 'Spiel nicht gefunden' });
    }
    console.log('Spiel erfolgreich gelöscht:', deletedGame);
    res.status(204).send(); // Kein Inhalt zurückgeben
  } catch (err) {
    console.error('Fehler beim Löschen des Spiels:', err);
    res.status(500).json({ message: err.message });
  }
});

// Ranking für ein bestimmtes Spiel abrufen
router.get('/:encryptedId/ranking', async (req, res) => {
  try {
    const topResults = await Result.find({ gameId: req.params.encryptedId })
      .sort({ duration: 1 }) // Nach kürzester Spielzeit sortieren
      .limit(5); // Top 5 anzeigen

    res.json(topResults);
  } catch (err) {
    console.error('Fehler beim Abrufen des Rankings:', err);
    res.status(500).json({ message: 'Interner Serverfehler beim Abrufen des Rankings' });
  }
});

// Frage löschen
router.delete('/:encryptedId/questions/:questionId', async (req, res) => {
  try {
    // Finde das Spiel anhand der encryptedId
    const game = await Game.findOne({ encryptedId: req.params.encryptedId });
    if (!game) {
      return res.status(404).json({ message: 'Spiel nicht gefunden' });
    }

    // Finde und entferne die Frage anhand ihrer _id
    game.questions = game.questions.filter(
      (question) => question._id.toString() !== req.params.questionId
    );

    // Speichere das aktualisierte Spiel
    await game.save();
    res.status(204).send(); // Erfolgreich gelöscht, kein Inhalt zurückgeben
  } catch (err) {
    console.error('Fehler beim Löschen der Frage:', err);
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;
