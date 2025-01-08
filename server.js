const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// ✅ Routen-Import
const authRoutes = require('./routes/auth'); 
const adminRoutes = require('./routes/admin'); 
const checkoutRoutes = require('./routes/checkout');
const orderRoutes = require('./routes/order');
const gameRoutes = require('./routes/games');
const resultRoutes = require('./routes/results');
const teamRoutes = require('./routes/teams');
const uploadRoutes = require('./routes/upload');

// ✅ CronJobs ausführen
require('./cronJobs');

// ✅ Express-Setup
const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = [
  'https://www.kiezjagd.de',
  'https://frontend-kiezjagd.vercel.app',
  'http://localhost:8080', 
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

// ✅ Statisches Verzeichnis für Uploads
const uploadPath = process.env.NODE_ENV === 'production'
  ? '/var/data/images' // Produktionspfad
  : path.join(__dirname, 'uploads'); // Lokaler Pfad
app.use('/uploads', express.static(uploadPath));

// ✅ MongoDB-Verbindung
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB verbunden!'))
  .catch(err => {
    console.error('❌ MongoDB-Verbindungsfehler:', err);
    process.exit(1);
  });

// ✅ Health-Check Route
app.get('/', (req, res) => {
  res.status(200).send('✅ API läuft!');
});

// ✅ Routen
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api', uploadRoutes);
app.use('/api/order', orderRoutes);

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
