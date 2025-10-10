// models/Game.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const QuestionOptionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'image', 'both', 'audio', 'anweisung'],
    default: 'text',
  },
  text: { type: String },
  imageUrl: { type: String },
  audioUrl: { type: String },
  correct: { type: Boolean, default: false },
}, { _id: false });

const QuestionSchema = new mongoose.Schema({
  // Die eigentliche Frage
  question: { type: String, required: true },

  // Individuelle Antwortzeile (optional)
  answerquestion: { type: String },

  // Frage-Typ
  type: { type: String, enum: ['text', 'multiple', 'anweisung', 'next'], default: 'text' },

  // Optionen für Multiple Choice
  options: { type: [QuestionOptionSchema], default: [] },

  // Richtige Antwort (Freitext)
  answer: { type: String },

  // Medien zur Frage
  imageUrl: { type: String },
  audioUrl: { type: String },

  // Standort (nur bei "anweisung" erforderlich)
  coordinates: {
    lat: {
      type: Number,
      required: function () { return this.type === 'anweisung'; }
    },
    lon: {
      type: Number,
      required: function () { return this.type === 'anweisung'; }
    },
  },
}, { _id: true, timestamps: false });

const GameSchema = new mongoose.Schema({
  city: { type: String, required: true },
  plz: { type: String, required: true },
  name: { type: String, required: true },
  ageGroup: { type: String, required: true },

  encryptedId: { type: String, required: true, unique: true },

  description: { type: String, required: true },
  prehistory: { type: String },
  infohistory: { type: String },
  landingPageUrl: { type: String },
  mailtext: { type: String },

  isDisabled: { type: Boolean, default: false },
  isVoucher: { type: Boolean, default: false },
  withCertificate: { type: Boolean, default: false },
  voucherName: { type: String },

  gameImage: { type: String, required: true },
  playtime: { type: String },
  startloction: { type: String, required: true },
  endloction: { type: String, required: true },
  price: { type: String, required: true },

  sortIndex: { type: Number, default: 9999, index: true },

  // Volle Fragenliste
  questions: { type: [QuestionSchema], default: [] },

  // 🚀 Neu: gezählte Anzahl für Listenseiten / Projections
  questionsCount: { type: Number, default: 0 },
}, {
  timestamps: true,
  minimize: true,
});

// 🔐 EncryptedId erzeugen, falls nicht vorhanden
GameSchema.pre('save', function (next) {
  if (!this.encryptedId) {
    this.encryptedId = crypto.randomBytes(16).toString('hex');
  }
  // questionsCount aktuell halten
  if (Array.isArray(this.questions)) {
    this.questionsCount = this.questions.length;
  } else {
    this.questionsCount = 0;
  }
  next();
});

// 🛠️ Auch bei Updates per findOneAndUpdate questionsCount mitziehen,
// wenn questions direkt ersetzt/gesetzt werden
GameSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  // Wenn $set.questions oder questions direkt gesetzt werden
  const newQuestions =
    (update.$set && update.$set.questions) ??
    update.questions;

  if (Array.isArray(newQuestions)) {
    // $set.questionsCount setzen, damit es atomar mit gespeichert wird
    if (!update.$set) update.$set = {};
    update.$set.questionsCount = newQuestions.length;
    this.setUpdate(update);
  }
  next();
});

// Optional: kleines Helferchen, wenn du serverseitig bewusst aktualisieren willst
GameSchema.methods.recountQuestions = function () {
  this.questionsCount = Array.isArray(this.questions) ? this.questions.length : 0;
  return this.questionsCount;
};

module.exports = mongoose.model('Game', GameSchema);
