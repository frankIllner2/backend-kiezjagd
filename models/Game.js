const mongoose = require('mongoose');
const crypto = require('crypto');

const QuestionSchema = new mongoose.Schema({
  question: { type: String, required: true }, // Die eigentliche Frage
  type: { type: String, enum: ['text', 'multiple'], default: 'text' }, // Frage-Typ: Text oder Mehrfachauswahl
  options: [
    {
      text: { type: String }, // Antworttext 
      correct: { type: Boolean, default: false } // Ist die Antwort korrekt?
    }
  ], // Optionen für Mehrfachauswahl
  answer: { type: String }, // Richtige Antwort für Freitext
  imageUrl: { type: String }, // URL des hochgeladenen Bildes
});

const GameSchema = new mongoose.Schema({
  city: { type: String, required: true },
  name: { type: String, required: true },
  ageGroup: { type: String, required: true },
  encryptedId: { type: String, required: true, unique: true },
  questions: [QuestionSchema], // Array von Fragen und Antworten
});

// Pre-save Hook für die verschlüsselte ID
GameSchema.pre('save', function (next) {
  if (!this.encryptedId) {
    this.encryptedId = crypto.randomBytes(16).toString('hex');
  }
  next();
});

module.exports = mongoose.model('Game', GameSchema);
