const mongoose = require('mongoose');
const crypto = require('crypto');

const QuestionSchema = new mongoose.Schema({
  question: { type: String, required: true }, // Die eigentliche Frage
  answerquestion: { type: String, required: true }, // Antwort auf die Frage - individuell
  type: { type: String, enum: ['text', 'multiple', 'anweisung'], default: 'text' }, // Frage-Typ: Text oder Mehrfachauswahl oder Anweisung
  options: [
    {
      type: {
        type: String,
        enum: ['text', 'image', 'both', 'anweisung'], // Erlaube sowohl Text- als auch Bildoptionen
        default: 'text', // Standardwert ist Text
      },
      text: { type: String }, // Antworttext (nur für Textoptionen)
      imageUrl: { type: String }, // Bild-URL (nur für Bildoptionen)
      correct: { type: Boolean, default: false }, // Ist die Antwort korrekt?
    },
  ], // Optionen für Mehrfachauswahl
  answer: { type: String }, // Richtige Antwort für Freitext
  imageUrl: { type: String }, // URL des hochgeladenen Bildes für die Frage selbst
  coordinates: {
    lat: { type: Number, required: function () { return this.type === 'anweisung'; } }, // GPS-Daten erforderlich, falls "anweisung"
    lon: { type: Number, required: function () { return this.type === 'anweisung'; } },
  },
});

const GameSchema = new mongoose.Schema({
  city: { type: String, required: true },
  name: { type: String, required: true },
  ageGroup: { type: String, required: true },
  encryptedId: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  prehistory: { type: String, required: true },
  infohistory: { type: String, required: true },
  isDisabled: { type: Boolean, default: false },
  gameImage: { type: String, required: true }, 
  playtime: { type: String, required: false },
  startloction: { type: String, required: true },
  endloction: { type: String, required: true },
  price: { type: String, required: true },
  questions: [QuestionSchema],
});

// Pre-save Hook für die verschlüsselte ID
GameSchema.pre('save', function (next) {
  if (!this.encryptedId) {
    this.encryptedId = crypto.randomBytes(16).toString('hex');
  }
  next();
});

module.exports = mongoose.model('Game', GameSchema);