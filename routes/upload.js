const express = require('express');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// ✅ Speicherort und Dateinamen festlegen
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// ✅ Route zum Hochladen von Bildern
router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '⚠️ Keine Datei hochgeladen' });
  }
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  console.log('imageUrl: ################');
  console.log(imageUrl);
  res.json({ imageUrl });
});

module.exports = router;
