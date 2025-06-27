const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const { sendCertificate } = require('../utils/sendCertificateEmail');


// POST: Speichert das Spielergebnis
router.post('/', async (req, res) => {
  try {
    const { gameId, teamName, email, startTime, endTime, duration, stars, gameType } = req.body;

    if (!gameId || !teamName || !email || !startTime || !endTime || !duration || !gameType) {
      return res.status(400).json({ message: 'Alle Felder sind erforderlich.' });
    }

    const result = new Result({
      gameId,
      teamName,
      email,
      startTime,
      endTime,
      duration,
      gameType,
      stars
    });
 
    const savedResult = await result.save();
    console.log('✅ Ergebnis erfolgreich gespeichert:', savedResult);

    // 📨 Urkunde versenden
    try {
    //  await sendCertificate(savedResult._id);
      console.log('✅ Urkunde erfolgreich versendet.');
    } catch (mailError) {
      console.error('❌ Fehler beim Versenden der Urkunde:', mailError.message);
    }

    res.status(201).json({
      message: 'Ergebnis gespeichert und Urkunde versendet.',
      result: savedResult,
    });
  } catch (err) {
    console.error('❌ Fehler beim Speichern des Ergebnisses:', err.message);
    res.status(500).json({ message: 'Interner Serverfehler' });
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

module.exports = router;
