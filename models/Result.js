const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  gameId: { type: String, required: true }, // Spiel-ID
  teamName: { type: String, required: true }, // Team
  email: { type: String, required: true }, // Mail
  startTime: { type: Date, default: Date.now }, // Zeitstempel
  endTime: { type: Date, default: Date.now }, // Zeitstempel
  duration: { type: String, required: true }, 
});

// Verhindere, dass das Modell mehrfach kompiliert wird
const Result = mongoose.models.Result || mongoose.model('Result', resultSchema);

module.exports = Result;
