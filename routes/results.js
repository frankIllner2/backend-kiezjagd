const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const Game = require('../models/Game'); // << NEU: fürs Nachladen des Titels
const { sendCertificate } = require('../utils/sendCertificateEmail');

// POST: Speichert das Spielergebnis
router.post('/', async (req, res) => {
  try {
    const {
      gameId,
      teamName,
      email,
      startTime,
      endTime,
      duration,
      stars,
      gameType
    } = req.body;

    // Pflichtfelder prüfen
    if (!gameId || !teamName || !email || !startTime || !endTime || !duration || !gameType) {
      return res.status(400).json({ message: 'Alle Felder sind erforderlich.' });
    }

    // Duplikat-Check: Teamname innerhalb desselben Spiels soll einzigartig sein
    const already = await Result.findOne({ gameId, teamName }).lean();
    if (already) {
      return res.status(409).json({ message: 'Teamname ist in diesem Spiel bereits vergeben.' });
    }

    // Game-Titel nachladen (Fallbacks)
    let gameTitle = 'Kiezjagd';
    try {
      const game = await Game.findOne({ encryptedId: gameId }).lean();
      if (game) {
        gameTitle = game.name || game.title || gameTitle;
      }
    } catch (e) {
      // kein harter Fehler – wir nutzen den Fallback
      console.warn('⚠️ Konnte Game nicht laden, nutze Fallback-Titel:', e.message);
    }

    const result = new Result({
      gameId,
      gameTitle, // << NEU
      teamName,
      email,
      startTime,
      endTime,
      duration,
      gameType,
      stars
    });

    const savedResult = await result.save();
    console.log('✅ Ergebnis erfolgreich gespeichert:', savedResult._id);

    // 📨 Urkunde versenden (Fehler hier blockieren nicht das Speichern)
    try {
      await sendCertificate(savedResult._id);
      console.log('✅ Urkunde erfolgreich versendet.');
    } catch (mailError) {
      console.error('❌ Fehler beim Versenden der Urkunde:', mailError.message);
      // Hinweis: Wenn du hier einen 202/207-ähnlichen Status willst, kannst du das JSON erweitern
    }

    return res.status(201).json({
      message: 'Ergebnis gespeichert und Urkunde versendet.',
      result: savedResult
    });
  } catch (err) {
    console.error('❌ Fehler beim Speichern des Ergebnisses:', err);
    return res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

// GET: Alle Ergebnisse abrufen
router.get('/', async (req, res) => {
  try {
    const results = await Result.find();
    res.json(results);
  } catch (err) {
    console.error('❌ Fehler beim Abrufen der Ergebnisse:', err.message);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

// Teamnamen prüfen (pro Spiel)
router.get('/check', async (req, res) => {
  const { teamName, gameId } = req.query;
  if (!teamName || !gameId) {
    return res.status(400).json({ message: 'Teamname und Spiel-ID sind erforderlich.' });
  }

  const normalize = (s) => (s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  try {
    const norm = normalize(teamName);
    // Baue regex: Worte getrennt durch \s+, exakter Match:
    const pattern = '^' + escapeRegex(norm).replace(/\s+/g, '\\s+') + '$';
    const existing = await Result.findOne({
      gameId,
      teamName: { $regex: pattern, $options: 'i' },
    }).lean();

    return res.json({ exists: !!existing });
  } catch (error) {
    console.error('❌ Fehler bei der Teamnamenprüfung:', error);
    return res.status(500).json({ message: 'Fehler bei der Teamnamenprüfung' });
  }
});


/*
// GET: Ergebnisse für ein bestimmtes Spiel abrufen
router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const results = await Result.find({ gameId });
    res.json(results);
  } catch (err) {
    console.error('❌ Fehler beim Abrufen der Ergebnisse für ein Spiel:', err.message);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});
*/

module.exports = router;
