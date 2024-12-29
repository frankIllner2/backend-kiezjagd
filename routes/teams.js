const express = require('express');
const router = express.Router();
const Teams = require('../models/Teams');

// Teamname prüfen
router.get('/check', async (req, res) => {
  const { teamName } = req.query;
  if (!teamName) {
    return res.status(400).json({ message: 'Teamname erforderlich.' });
  }

  const exists = await Teams.exists({ name: teamName });
  res.status(200).json({ exists });
});

module.exports = router;
