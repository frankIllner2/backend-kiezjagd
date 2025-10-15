// routes/games.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const Game = require('../models/Game');
const Result = require('../models/Result');
const { verifyAdmin } = require('../middleware/auth');

function buildProjection(fieldsParam, fallback = null) {
  if (!fieldsParam) return fallback;
  const fields = String(fieldsParam)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (!fields.length) return fallback;
  return fields.join(' ');
}

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * GET /api/games
 * - Admin: alles
 * - Public: nur aktuell aktive (activation.enabled + isActiveNow)
 * - Optional: ?fields=...
 * - Sortierung: sortIndex, name
 */
router.get("/", async (req, res) => {
  try {
    const isAdmin = req.query.admin === "true";
    const fieldsParam = req.query.fields;

    // Felder, die wir für UI & Filter brauchen
    const mustHave = [
      "encryptedId","gameImage","name","plz","ageGroup", "isVoucher","withCertificate",
      "startloction","endloction","price","description",
      "activation.enabled","activation.from","activation.until","activation.repeatYearly",
      "sortIndex",
      "playtime"
    ];

    const parseFields = (fp) =>
      String(fp || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const fieldsArr = parseFields(fieldsParam);
    const wantsFields = fieldsArr.length > 0;

    const projectionObj = wantsFields
      ? Object.fromEntries(fieldsArr.map((f) => [f, 1]))
      : {}; // alle Felder

    // Pflichtfelder sicherstellen
    for (const f of mustHave) projectionObj[f] = 1;

    const baseMatch = isAdmin ? {} : { "activation.enabled": true };

    const docs = await Game.find(baseMatch, projectionObj)
      .sort({ sortIndex: 1, name: 1 })
      .lean();

    if (isAdmin) {
      return res.json(docs);
    }

    const now = new Date();
    const filtered = docs.filter((d) => (new Game(d)).isActiveNow(now));
    res.json(filtered);
  } catch (err) {
    console.error("Fehler beim Abrufen der Spiele:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/random', async (req, res) => {
  try {
    const size = Number.isFinite(parseInt(req.query.size, 10)) ? parseInt(req.query.size, 10) : 2;
    const candidates = await Game.find({ "activation.enabled": true }, { encryptedId: 1 }).lean();
    const now = new Date();
    const active = candidates.filter((d) => (new Game(d)).isActiveNow(now));
    if (!active.length) return res.status(404).json({ message: 'Keine aktiven Spiele gefunden' });
    // simple JS sample
    const shuffled = active.sort(() => 0.5 - Math.random());
    res.json(shuffled.slice(0, size).map(g => g.encryptedId));
  } catch (error) {
    console.error('❌ Fehler beim Abrufen zufälliger Spiele:', error);
    res.status(500).json({ message: 'Interner Serverfehler', error: error.message });
  }
});

router.get('/:encryptedId', async (req, res) => {
  try {
    const isAdmin = req.query.admin === "true";
    const projection = buildProjection(req.query.fields, undefined);

    const game = await Game.findOne(
      { encryptedId: req.params.encryptedId },
      projection || undefined
    ).lean();

    if (!game) {
      return res.status(404).json({ message: 'Spiel nicht gefunden' });
    }

    if (!isAdmin && !(new Game(game)).isActiveNow(new Date())) {
      return res.status(403).json({ message: 'Dieses Spiel ist deaktiviert.' });
    }

    res.json(game);
  } catch (err) {
    console.error('Fehler beim Abrufen des Spiels:', err);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

router.post('/:encryptedId/questions', async (req, res) => {
  try {
    const game = await Game.findOne({ encryptedId: req.params.encryptedId });
    if (!game) {
      return res.status(404).json({ message: '❌ Spiel nicht gefunden -3' });
    }

    if (!req.body.question || req.body.question.trim() === '') {
      return res.status(400).json({ message: '⚠️ Frage darf nicht leer sein.' });
    }

    const newQuestion = {
      question: req.body.question,
      answerquestion: req.body.answerquestion,
      type: req.body.type,
      options: req.body.options || [],
      answer: req.body.answer || '',
      imageUrl: req.body.imageUrl || '',
      audioUrl: req.body.audioUrl || '',
    };

    if (req.body.type === 'anweisung') {
      if (!req.body.coordinates || !req.body.coordinates.lat || !req.body.coordinates.lon) {
        return res.status(400).json({ message: '⚠️ GPS-Koordinaten erforderlich!' });
      }
      newQuestion.coordinates = req.body.coordinates;
    }

    game.questions.push(newQuestion);
    await game.save();

    res.status(201).json(newQuestion);
    console.log('✅ Frage erfolgreich hinzugefügt');
  } catch (error) {
    console.error('❌ Fehler beim Hinzufügen der Frage:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/:encryptedId/verify-location", async (req, res) => {
  try {
    const { questionId, userCoordinates } = req.body;

    if (!questionId || !userCoordinates || !userCoordinates.lat || !userCoordinates.lon) {
      return res.status(400).json({ error: "Ungültige Eingabe!" });
    }

    const game = await Game.findOne({ encryptedId: req.params.encryptedId });
    if (!game) {
      return res.status(404).json({ error: "Spiel nicht gefunden" });
    }

    const question = game.questions.id(questionId);
    if (!question || question.type !== "anweisung") {
      return res.status(404).json({ error: "Frage nicht gefunden oder falscher Typ." });
    }

    const distance = getDistanceFromLatLonInMeters(
      userCoordinates.lat, userCoordinates.lon,
      question.coordinates.lat, question.coordinates.lon
    );

    if (distance <= 30) {
      res.json({ success: true, message: "Standort korrekt!" });
    } else {
      res.json({ success: false, message: "Zu weit entfernt!" });
    }
  } catch (error) {
    console.error("❌ Fehler bei der Standortprüfung:", error);
    res.status(500).json({ error: "Fehler beim Prüfen der Position." });
  }
});

router.put('/:encryptedId/questions/:questionId', async (req, res) => {
  try {
    const game = await Game.findOne({ encryptedId: req.params.encryptedId });
    if (!game) {
      return res.status(404).json({ message: '❌ Spiel nicht gefunden - 2' });
    }

    const question = game.questions.id(req.params.questionId);
    if (!question) {
      return res.status(404).json({ message: '❌ Frage nicht gefunden' });
    }

    question.question = req.body.question ?? question.question;
    if (req.body.hasOwnProperty("answerquestion")) {
      question.answerquestion = req.body.answerquestion;
    }
    question.answer = req.body.answer ?? question.answer;
    question.options = Array.isArray(req.body.options) ? req.body.options : question.options;
    question.type = req.body.type ?? question.type;
    question.imageUrl = req.body.imageUrl ?? question.imageUrl;
    question.coordinates = req.body.coordinates ?? question.coordinates;
    question.audioUrl = req.body.audioUrl ?? question.audioUrl;

    await game.save();
    res.status(200).json(question);
  } catch (error) {
    console.error('❌ Fehler beim Aktualisieren der Frage:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/:encryptedId/top8', async (req, res) => {
  try {
    const game = await Game.findOne({ encryptedId: req.params.encryptedId }).lean();
    if (!game) return res.status(404).json({ message: '❌ Spiel nicht gefunden - /:encryptedId/top8' });

    const topResults = await Result.find({ gameId: req.params.encryptedId })
      .sort({ duration: 1 })
      .limit(8)
      .select('teamName duration stars gameType startTime')
      .lean();

    res.json({
      gameName: game.name,
      landingPageUrl: game.landingPageUrl || `/spiel/${game.encryptedId}`,
      topResults: topResults.map(r => ({
        teamName: r.teamName || r.name || r.team || '',
        duration: r.duration,
        stars: r.stars,
        gameType: r.gameType,
        startTime: r.startTime,
      })),
    });
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der Top 8 Ergebnisse:', error);
    res.status(500).json({ message: '❌ Interner Serverfehler', error: error.message });
  }
});

router.put('/games/encrypted/:encryptedId/questions/:questionId', async (req, res) => {
  const { encryptedId, questionId } = req.params;
  const updatedQuestion = req.body;

  try {
    const game = await Game.findOne({ encryptedId });
    if (!game) {
      return res.status(404).json({ message: 'Spiel nicht gefunden' });
    }

    const questionIndex = game.questions.findIndex(q => q._id.toString() === questionId);
    if (questionIndex === -1) {
      return res.status(404).json({ message: 'Frage nicht gefunden' });
    }

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

router.post('/', async (req, res) => {
  try {
    const encryptedId = crypto.randomBytes(16).toString('hex');
    const game = new Game({ ...req.body, encryptedId });
    const newGame = await game.save();
    res.status(201).json(newGame);
  } catch (err) {
    console.error('Fehler beim Erstellen des Spiels:', err);
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updatedGame = await Game.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedGame) {
      return res.status(404).json({ message: 'Spiel nicht gefunden' });
    }
    res.json(updatedGame);
  } catch (err) {
    console.error('Fehler beim Aktualisieren des Spiels:', err);
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deletedGame = await Game.findByIdAndDelete(req.params.id);
    if (!deletedGame) {
      return res.status(404).json({ message: 'Spiel nicht gefunden' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Fehler beim Löschen des Spiels:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/:encryptedId/ranking', async (req, res) => {
  try {
    const topResults = await Result.find({ gameId: req.params.encryptedId })
      .sort({ duration: 1 })
      .limit(5)
      .lean();
    res.json(topResults);
  } catch (err) {
    console.error('Fehler beim Abrufen des Rankings:', err);
    res.status(500).json({ message: 'Interner Serverfehler beim Abrufen des Rankings' });
  }
});

router.delete('/:encryptedId/questions/:questionId', async (req, res) => {
  try {
    const game = await Game.findOne({ encryptedId: req.params.encryptedId });
    if (!game) {
      return res.status(404).json({ message: 'Spiel nicht gefunden' });
    }

    const before = game.questions.length;
    game.questions = game.questions.filter(q => q._id.toString() !== req.params.questionId);

    if (game.questions.length === before) {
      return res.status(404).json({ message: 'Frage nicht gefunden' });
    }

    await game.save();
    res.status(204).send();
  } catch (err) {
    console.error('Fehler beim Löschen der Frage:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/copy', verifyAdmin, async (req, res) => {
  try {
    const originalGame = await Game.findById(req.params.id).lean();
    if (!originalGame) return res.status(404).json({ error: "Spiel nicht gefunden" });

    delete originalGame._id;
    originalGame.name = `${originalGame.name}_Kopie`;
    originalGame.encryptedId = crypto.randomBytes(16).toString('hex');
    originalGame.createdAt = new Date();
    originalGame.updatedAt = new Date();

    const newGame = new Game(originalGame);
    await newGame.save();

    res.status(201).json(newGame);
  } catch (err) {
    console.error("Fehler beim Kopieren:", err);
    res.status(500).json({ error: "Fehler beim Kopieren" });
  }
});

router.get('/rankings/top8', async (req, res) => {
  try {
    const ids = String(req.query.ids || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (!ids.length) return res.json({});

    const pipeline = [
      { $match: { gameId: { $in: ids } } },
      { $sort: { gameId: 1, duration: 1 } },
      {
        $group: {
          _id: '$gameId',
          entries: {
            $push: {
              teamName: { $ifNull: ['$teamName', '$name'] },
              duration: '$duration',
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          entries: { $slice: ['$entries', 8] }
        }
      }
    ];

    const rows = await Result.aggregate(pipeline).allowDiskUse(true);
    const map = {};
    for (const row of rows) map[row._id] = row.entries;
    for (const id of ids) if (!map[id]) map[id] = [];
    res.json(map);
  } catch (err) {
    console.error('❌ Fehler bei Batch-Rankings:', err);
    res.status(500).json({ message: 'Interner Serverfehler', error: err.message });
  }
});

module.exports = router;
