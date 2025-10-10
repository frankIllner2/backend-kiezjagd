// routes/games.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const Game = require('../models/Game');
const Result = require('../models/Result');
const { verifyAdmin } = require('../middleware/auth');

/**
 * Hilfsfunktion: Projection aus ?fields=... (kommasepariert) bauen
 * Beispiel: ?fields=_id,name,city,ageGroup,encryptedId,isDisabled,questionsCount,sortIndex
 */
function buildProjection(fieldsParam, fallback = null) {
  if (!fieldsParam) return fallback;
  const fields = String(fieldsParam)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (!fields.length) return fallback;
  // Mongoose-Projection als Space-separierte Liste
  return fields.join(' ');
}

/**
 * Hilfsfunktion: Distanz in Metern (Haversine)
 */
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
 * 🔹 GET /api/games
 * - Admin: sieht alle, andere: nur nicht deaktivierte
 * - Optional: ?fields=_id,name,... für schlanke Antworten
 * - Sortiert nach sortIndex, name
 */
// routes/games.js (GET /api/games) – ERSETZEN
router.get("/", async (req, res) => {
  try {
    const isAdmin = req.query.admin === "true";
    const fieldsParam = req.query.fields;
    const query = isAdmin ? {} : { isDisabled: { $ne: true } };

    // Helper: fields als Array
    const parseFields = (fp) =>
      String(fp || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const fieldsArr = parseFields(fieldsParam);
    const wantsFields = fieldsArr.length > 0;
    const wantsQuestionsCount = fieldsArr.includes("questionsCount");

    // Wenn keine spezifischen Felder angefragt sind => altes Verhalten (volle Docs)
    if (!wantsFields) {
      const games = await Game.find(query).sort({ sortIndex: 1, name: 1 }).lean();
      return res.json(games);
    }

    // Aggregation: wir projizieren GENAU die Felder aus fieldsArr
    // und berechnen questionsCount robust: vorhandenes Feld ODER Größe des Arrays.
    const project = {};

    // Immer _id liefern, wenn angefragt oder wenn es nicht ausgeschlossen ist
    if (fieldsArr.includes("_id") || !fieldsArr.length) {
      project._id = 1;
    }

    for (const f of fieldsArr) {
      if (f === "questionsCount") continue; // berechnen wir unten
      // niemals das gesamte questions-Array zurückgeben, wenn nicht explizit verlangt
      if (f === "questions") continue;
      project[f] = 1;
    }

    // questionsCount berechnen: vorhandenes Feld bevorzugen, sonst $size(questions)
    project.questionsCount = {
      $ifNull: [
        "$questionsCount",
        { $size: { $ifNull: ["$questions", []] } }
      ]
    };

    const pipeline = [
      { $match: query },
      { $sort: { sortIndex: 1, name: 1 } },
      { $project: project },
    ];

    const games = await Game.aggregate(pipeline).allowDiskUse(true);
    return res.json(games);
  } catch (err) {
    console.error("Fehler beim Abrufen der Spiele:", err);
    res.status(500).json({ message: err.message });
  }
});


/**
 * 🔹 GET /api/games/random
 * - liefert 2 zufällige encryptedIds
 */
router.get('/random', async (req, res) => {
  try {
    const size = Number.isFinite(parseInt(req.query.size, 10)) ? parseInt(req.query.size, 10) : 2;
    const sample = await Game.aggregate([
      { $match: { isDisabled: { $ne: true } } },
      { $sample: { size } },
      { $project: { _id: 0, encryptedId: 1 } }
    ]);
    if (!sample || sample.length === 0) {
      return res.status(404).json({ message: 'Keine zufälligen Spiele gefunden' });
    }
    res.json(sample.map(g => g.encryptedId));
  } catch (error) {
    console.error('❌ Fehler beim Abrufen zufälliger Spiele:', error);
    res.status(500).json({ message: 'Interner Serverfehler', error: error.message });
  }
});

/**
 * 🔹 GET /api/games/:encryptedId
 * - optional ?admin=true
 * - optional ?fields=... (falls du Detailansicht schlank haben willst)
 */
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

    if (game.isDisabled && !isAdmin) {
      return res.status(403).json({ message: 'Dieses Spiel ist deaktiviert.' });
    }

    res.json(game);
  } catch (err) {
    console.error('Fehler beim Abrufen des Spiels:', err);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

/**
 * 🔹 POST /api/games/:encryptedId/questions
 * - Frage hinzufügen (inkl. GPS-Prüfung bei "anweisung")
 */
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
    await game.save(); // pre('save') aktualisiert questionsCount

    res.status(201).json(newQuestion);
    console.log('✅ Frage erfolgreich hinzugefügt');
  } catch (error) {
    console.error('❌ Fehler beim Hinzufügen der Frage:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * 🔹 POST /api/games/:encryptedId/verify-location
 * - Standortprüfung für "anweisung"-Fragen
 */
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

/**
 * 🔹 PUT /api/games/:encryptedId/questions/:questionId
 * - Frage aktualisieren
 */
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

    await game.save(); // pre('save') aktualisiert questionsCount
    res.status(200).json(question);
  } catch (error) {
    console.error('❌ Fehler beim Aktualisieren der Frage:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * 🔹 GET /api/games/:encryptedId/top8
 * - Top-Ergebnisse (kompatibel zu bestehendem Code)
 */
router.get('/:encryptedId/top8', async (req, res) => {
  try {
    const game = await Game.findOne({ encryptedId: req.params.encryptedId }, { name: 1 }).lean();
    if (!game) {
      return res.status(404).json({ message: '❌ Spiel nicht gefunden - /:encryptedId/top8' });
    }

    const topResults = await Result.find({ gameId: req.params.encryptedId })
      .sort({ duration: 1 })
      .limit(7) // historisch 7
      .lean();

    res.json({
      gameName: game.name,
      topResults,
    });
  } catch (error) {
    console.error('❌ Fehler beim Abrufen der Top 8 Ergebnisse:', error);
    res.status(500).json({ message: '❌ Interner Serverfehler', error: error.message });
  }
});

/**
 * 🔹 PUT /api/games/games/encrypted/:encryptedId/questions/:questionId
 * (Dein bestehender alternativer Updateweg – behalten für Kompatibilität)
 */
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

    await game.save(); // pre('save') aktualisiert questionsCount
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

/**
 * 🔹 POST /api/games
 * - Neues Spiel erstellen (encryptedId wird generiert)
 */
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

/**
 * 🔹 PUT /api/games/:id
 * - Spiel aktualisieren
 */
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

/**
 * 🔹 DELETE /api/games/:id
 * - Spiel löschen
 */
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

/**
 * 🔹 GET /api/games/:encryptedId/ranking
 * - Einzel-Ranking (Top 5) – kompatibel
 */
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

/**
 * 🔹 DELETE /api/games/:encryptedId/questions/:questionId
 * - Frage löschen
 */
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

    await game.save(); // pre('save') aktualisiert questionsCount
    res.status(204).send();
  } catch (err) {
    console.error('Fehler beim Löschen der Frage:', err);
    res.status(500).json({ message: err.message });
  }
});

/**
 * 🔹 POST /api/games/:id/copy
 * - Spiel kopieren (Admin)
 */
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

/* ------------------------------------------------------------------ */
/* 🚀 Batch-Ranking (Top8) für mehrere Spiele in EINEM Request
   GET /api/games/rankings/top8?ids=a,b,c
   Antwort: { [encryptedId]: [{ teamName, duration }, ...] }
   Annahmen:
   - Result hat Felder: gameId (encryptedId), duration (Number oder String),
     teamName (oder name). Wir mappen teamName := teamName || name.
*/
/* ------------------------------------------------------------------ */
router.get('/rankings/top8', async (req, res) => {
  try {
    const ids = String(req.query.ids || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (!ids.length) return res.json({});

    const pipeline = [
      { $match: { gameId: { $in: ids } } },
      // Dauer aufsteigend sortieren (kürzer = besser)
      { $sort: { gameId: 1, duration: 1 } },
      // Pro Spiel sammeln
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
      // Auf Top 5 kürzen
      {
        $project: {
          _id: 1,
          entries: { $slice: ['$entries', 8] }
        }
      }
    ];

    const rows = await Result.aggregate(pipeline).allowDiskUse(true);
    const map = {};
    for (const row of rows) {
      map[row._id] = row.entries;
    }
    // leere Arrays für Spiele ohne Ergebnisse
    for (const id of ids) {
      if (!map[id]) map[id] = [];
    }
    res.json(map);
  } catch (err) {
    console.error('❌ Fehler bei Batch-Rankings:', err);
    res.status(500).json({ message: 'Interner Serverfehler', error: err.message });
  }
});

module.exports = router;
