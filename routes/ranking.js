// routes/ranking.js
const express = require('express');
const router = express.Router();
const Result = require('../models/Result');

/**
 * GET /api/rankings/8?ids=a,b,c
 * Antwort: { [encryptedId]: [{ teamName, duration }, ...] }
 *
 * Annahmen:
 * - Result hat Felder:
 *   - gameId (== encryptedId vom Spiel)
 *   - duration (Number, kleinere Zahl = schneller/besser)
 *   - teamName oder name (wir mappen teamName := teamName || name)
 * Falls duration als String (z.B. "1h 2m 3s") gespeichert ist, müsstest du im
 * Aggregat zuerst in Sekunden umrechnen; hier gehen wir von Number aus.
 */
router.get('/top8', async (req, res) => {
  try {
    const ids = String(req.query.ids || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (!ids.length) return res.json({});

    const pipeline = [
      { $match: { gameId: { $in: ids } } },
      { $sort: { gameId: 1, duration: 1 } }, // kürzeste Dauer zuerst
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
      { $project: { _id: 1, entries: { $slice: ['$entries', 8] } } }
    ];

    const rows = await Result.aggregate(pipeline).allowDiskUse(true);
    const map = {};
    for (const row of rows) {
      map[row._id] = row.entries;
    }
    // Leere Arrays für Spiele ohne Ergebnisse
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
