const express = require('express');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// ✅ Speicherort und Dateinamen festlegen
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.NODE_ENV === 'production'
      ? '/var/data'  // allgemeiner Upload-Pfad in Produktion
      : path.join(__dirname, '../uploads'); // lokal
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// ✅ Route für Bild-Upload
router.post('/image', upload.single('image'), (req, res) => {
 
  try {
    console.log('hier:' + req.file);
    if (!req.file) {
      return res.status(400).json({ message: '❌ Keine Bilddatei hochgeladen xxx.' });
    }

    const host = req.headers.host.replace('localhost', req.hostname);
    const fileUrl = process.env.NODE_ENV === 'production'
      ? `https://backend-kiezjagd.onrender.com/uploads/${req.file.filename}`
      : `${req.protocol}://${host}/uploads/${req.file.filename}`;

    console.log('📸 Bild-URL:', fileUrl);
    res.json({ imageUrl: fileUrl });

  } catch (error) {
    console.error('❌ Fehler beim Bild-Upload:', error);
    res.status(500).json({ message: '❌ Fehler beim Hochladen des Bildes.', error: error.message });
  }
});

// ✅ Route für Audio-Upload
router.post('/audio', upload.single('audio'), (req, res) => {

  try {
    if (!req.file) {
      return res.status(400).json({ message: '❌ Keine Audiodatei hochgeladen.' });
    }
   
    const host = req.headers.host.replace('localhost', req.hostname);
    const fileUrl = process.env.NODE_ENV === 'production'
      ? `https://backend-kiezjagd.onrender.com/uploads/${req.file.filename}`
      : `${req.protocol}://${host}/uploads/${req.file.filename}`;

    console.log('🔊 Audio-URL:', fileUrl);
    res.json({ audioUrl: fileUrl });

  } catch (error) {
    console.error('❌ Fehler beim Audio-Upload:', error);
    res.status(500).json({ message: '❌ Fehler beim Hochladen der Audiodatei.', error: error.message });
  }
});

module.exports = router;
