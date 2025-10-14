// routes/ranking.js
const express = require('express');
const router = express.Router();
const Result = require('../models/Result');

/**
 * GET /api/rankings/top8?ids=a,b,c
 * Antwort: { [encryptedId]: [{ teamName, duration, stars, gameType, startTime }, ...] }
 *
 * Sortierlogik:
 * - Mini:   startTime DESC (neueste zuerst)
 * - Medi:   stars DESC
 * - Maxi:   duration ASC (kürzer = besser)
 */

// ---- Helpers ----
function normalizeTeamName(r = {}) {
  return (r.teamName && String(r.teamName).trim())
      || (r.name && String(r.name).trim())
      || (r.team && String(r.team).trim())
      || '';
}

// "1h 2m 3s" | "2m 10s" | "45s" | "HH:MM:SS" | "MM:SS" | number (Sekunden)
function durationToSeconds(raw) {
  if (raw == null) return Number.POSITIVE_INFINITY;

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw; // schon Sekunden
  }

  const s = String(raw).trim();
  if (!s) return Number.POSITIVE_INFINITY;

  // "xh ym zs"
  const hms = s.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i);
  if (hms && (hms[1] || hms[2] || hms[3])) {
    const h = parseInt(hms[1] || '0', 10);
    const m = parseInt(hms[2] || '0', 10);
    const sec = parseInt(hms[3] || '0', 10);
    return h * 3600 + m * 60 + sec;
  }

  // "HH:MM:SS" | "MM:SS"
  const parts = s.split(':').map(n => parseInt(n, 10));
  if (parts.every(n => Number.isFinite(n))) {
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }

  return Number.POSITIVE_INFINITY;
}

function toNumberStars(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : 0;
}

// ---- Route ----
router.get('/top8', async (req, res) => {
  try {
    const ids = String(req.query.ids || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (!ids.length) return res.json({});

    // Wir ziehen alle relevanten Felder; gameType/stars/startTime werden ins Frontend gemappt.
    const results = await Result.find({ gameId: { $in: ids } })
      .select('gameId teamName name team duration stars gameType startTime')
      .lean();

    // Gruppieren nach gameId
    const map = {};
    for (const r of results) {
      const gid = r.gameId;
      if (!map[gid]) map[gid] = [];

      map[gid].push({
        teamName: normalizeTeamName(r),
        duration: r.duration,                   // String oder Zahl — Frontend zeigt Min.; wir sortieren hier korrekt.
        stars: r.stars,                         // kann String sein; sortieren mit toNumberStars
        gameType: r.gameType,                   // "Mini" | "Medi" | "Maxi" (laut deiner Aussage immer gesetzt)
        startTime: r.startTime || null,
      });
    }

    // Sort pro Spiel gemäß gameType + auf Top 8 kürzen
    for (const gid of Object.keys(map)) {
      const entries = map[gid];

      // gameType aus den Einträgen nehmen (falls mal gemischt, nehmen wir den häufigsten)
      const typeCounts = entries.reduce((acc, e) => {
        const k = (e.gameType || '').toString().trim().toLowerCase();
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      // Best guess
      let gameType = '';
      if (typeCounts.mini) gameType = 'Mini';
      else if (typeCounts.medi) gameType = 'Medi';
      else if (typeCounts.maxi) gameType = 'Maxi';

      if (gameType === 'Mini') {
        // Neueste zuerst
        entries.sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0));
      } else if (gameType === 'Medi') {
        // Sterne absteigend
        entries.sort((a, b) => toNumberStars(b.stars) - toNumberStars(a.stars));
      } else {
        // Maxi/default: Dauer aufsteigend
        entries.sort((a, b) => durationToSeconds(a.duration) - durationToSeconds(b.duration));
      }

      map[gid] = entries.slice(0, 8);
    }

    // Leere Arrays für Spiele ohne Ergebnisse
    for (const id of ids) {
      if (!map[id]) map[id] = [];
    }

    return res.json(map);
  } catch (err) {
    console.error('❌ Fehler bei Batch-Rankings:', err);
    return res.status(500).json({ message: 'Interner Serverfehler', error: err.message });
  }
});

module.exports = router;
