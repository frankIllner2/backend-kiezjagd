// models/Result.js
const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  gameId:   { type: String, required: true },            // Spiel-ID (String oder ObjectId als String)
  gameTitle:{ type: String, required: true },            // << NEU: Spielname
  teamName: { type: String, required: true },            // Team
  email:    { type: String, required: true },            // Mail
  startTime:{ type: Date, default: Date.now },
  endTime:  { type: Date, default: Date.now },
  duration: { type: String },
  stars:    { type: String },
  gameType: { type: String, required: true }
}, { timestamps: true });

// Besser als "teamName" alleine unique: eindeutig pro Spiel
resultSchema.index({ gameId: 1, teamName: 1 }, { unique: true });

module.exports = mongoose.models.Result || mongoose.model('Result', resultSchema);
