const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Routen
const gameRoutes = require('./routes/games');
const resultRoutes = require('./routes/results');
const teamRoutes = require('./routes/teams');
const uploadRoutes = require('./routes/upload');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = [
  'http://localhost:8080',
  'http://192.168.178.26:8080' // Füge deine lokale IP hinzu
];

// ✅ Middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy does not allow access from this origin'));
    }
  }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Statisches Verzeichnis für Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ MongoDB-Verbindung
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB verbunden!'))
  .catch(err => {
    console.error('❌ MongoDB-Verbindungsfehler:', err);
    process.exit(1); // Beendet den Prozess bei fehlgeschlagener Verbindung
  });

// ✅ Health-Check Route (zum Testen, ob Server läuft)
app.get('/', (req, res) => {
  res.status(200).send('✅ API läuft!');
});

// ✅ Routen
app.use('/api/games', gameRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api', uploadRoutes); 

// Entferne doppelte Verwendung von uploadRoutes
// app.use(uploadRoutes); <-- Das war doppelt und verursacht Konflikte

// ✅ Health-Check Route
app.get('/', (req, res) => {
  res.status(200).send('✅ API läuft!');
});

// ✅ Fehlerbehandlung für nicht vorhandene Routen
app.use((req, res) => {
  res.status(404).json({
    message: '❌ Route nicht gefunden.',
    route: req.originalUrl
  });
});

// ✅ Globaler Fehler-Handler
app.use((err, req, res, next) => {
  console.error('❌ Globaler Fehler:', err.stack);
  res.status(500).json({
    message: '❌ Interner Serverfehler',
    error: err.message,
  });
});

// ✅ Server starten
app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});
