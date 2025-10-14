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

  // Alt-Flag (legacy)
  isDisabled: { type: Boolean, default: false },

  // Aktivierungsfenster + Serientermin
  activation: {
    enabled: { type: Boolean, default: false },
    from:   { type: Date, default: null },   // UTC ISO
    until:  { type: Date, default: null },   // UTC ISO
    repeatYearly: { type: Boolean, default: false }, // 🔁 jährlich wiederkehrend
  },

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

// 🧠 Aktivitätsprüfung: jetzt aktiv? (inkl. jährlich wiederkehrend)
GameSchema.methods.isActiveNow = function (now = new Date()) {
  const a = this.activation || {};
  if (!a.enabled) return false;

  // Einfacher Modus ohne Wiederholung
  if (!a.repeatYearly) {
    const fromOk = !a.from || now >= a.from;
    const untilOk = !a.until || now <= a.until;
    return fromOk && untilOk;
  }

  // Jährlich wiederkehrend: wir übertragen Monat/Tag(+Zeit) auf das laufende Jahr
  if (!a.from || !a.until) return false; // für Serientermin brauchen wir beide Enden

  const y = now.getUTCFullYear();
  const mkUTC = (tpl, year) => new Date(Date.UTC(
    year,
    tpl.getUTCMonth(),
    tpl.getUTCDate(),
    tpl.getUTCHours(),
    tpl.getUTCMinutes(),
    tpl.getUTCSeconds(),
    tpl.getUTCMilliseconds(),
  ));

  const startThisYear = mkUTC(a.from, y);
  const endThisYear = mkUTC(a.until, y);

  if (endThisYear >= startThisYear) {
    // normales Fenster (selbes Jahr)
    return now >= startThisYear && now <= endThisYear;
  } else {
    // Cross-Year (z. B. 01.11.–15.02.)
    const endNextYear = mkUTC(a.until, y + 1);
    const startPrevYear = mkUTC(a.from, y - 1);
    return (now >= startThisYear && now <= endNextYear) || (now >= startPrevYear && now <= endThisYear);
  }
};

// 🛠️ Auch bei Updates per findOneAndUpdate questionsCount mitziehen
GameSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  const newQuestions =
    (update.$set && update.$set.questions) ??
    update.questions;
  if (Array.isArray(newQuestions)) {
    if (!update.$set) update.$set = {};
    update.$set.questionsCount = newQuestions.length;
    this.setUpdate(update);
  }
  next();
});

GameSchema.methods.recountQuestions = function () {
  this.questionsCount = Array.isArray(this.questions) ? this.questions.length : 0;
  return this.questionsCount;
};

module.exports = mongoose.model('Game', GameSchema);
