const express = require('express');
const multer = require('multer');
const path = require('path');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

// Gemeinsamer Speicherort
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.NODE_ENV === 'production'
      ? '/var/data/images'
      : path.join(__dirname, '../uploads');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

// ✅ Bild-Filter
const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/webp', 'image/png', 'image/jpeg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('❌ Nur JPG, PNG oder WebP erlaubt'), false);
  }
};

// ✅ Audio-Filter
const audioFilter = (req, file, cb) => {
  const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('❌ Nur MP3 oder WAV erlaubt'), false);
  }
};

// ✅ Zwei getrennte Multer-Instanzen
const uploadImage = multer({ storage, fileFilter: imageFilter });
const uploadAudio = multer({ storage, fileFilter: audioFilter });

// ✅ Route für Bild-Upload
router.post('/image', verifyAdmin, uploadImage.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '❌ Keine Bilddatei hochgeladen.' });

    const fileUrl = makeFileUrl(req, req.file.filename);
    console.log('📸 Bild-URL:', fileUrl);
    res.json({ imageUrl: fileUrl });
  } catch (error) {
    console.error('❌ Fehler beim Bild-Upload:', error);
    res.status(500).json({ message: '❌ Fehler beim Hochladen des Bildes.', error: error.message });
  }
});

// ✅ Route für Audio-Upload
router.post('/audio', verifyAdmin, uploadAudio.single('audio'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '❌ Keine Audiodatei hochgeladen.' });

    const fileUrl = makeFileUrl(req, req.file.filename);
    console.log('🔊 Audio-URL:', fileUrl);
    res.json({ audioUrl: fileUrl });
  } catch (error) {
    console.error('❌ Fehler beim Audio-Upload:', error);
    res.status(500).json({ message: '❌ Fehler beim Hochladen der Audiodatei.', error: error.message });
  }
});

// ✅ Hilfsfunktion für URLs
function makeFileUrl(req, filename) {
  const host = req.headers.host.replace('localhost', req.hostname);
  return process.env.NODE_ENV === 'production'
    ? `https://backend-kiezjagd.onrender.com/uploads/${filename}`
    : `${req.protocol}://${host}/uploads/${filename}`;
}

module.exports = router;
