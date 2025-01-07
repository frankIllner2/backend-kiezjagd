const express = require('express');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// ✅ Speicherort und Dateinamen festlegen
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.NODE_ENV === 'production' 
      ? '/mnt/data/uploads' // Produktionspfad für Render
      : path.join(__dirname, '../uploads'); // Lokaler Pfad
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// ✅ Route zum Hochladen von Bildern
router.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '❌ Keine Datei hochgeladen.' });
    }

    // Host ermitteln und Pfad setzen
    const host = req.headers.host.replace('localhost', req.hostname);

    // Bild-URL basierend auf der Umgebung erstellen
    const imageUrl = process.env.NODE_ENV === 'production'
      ? `https://kiezjagd.de/uploads/${req.file.filename}` // Produktions-URL
      : `${req.protocol}://${host}/uploads/${req.file.filename}`; // Lokale URL

    console.log('📸 Bild-URL:', imageUrl);

    res.json({ imageUrl });
  } catch (error) {
    console.error('❌ Fehler beim Hochladen des Bildes:', error);
    res.status(500).json({ message: '❌ Fehler beim Hochladen des Bildes.', error: error.message });
  }
});

module.exports = router;
