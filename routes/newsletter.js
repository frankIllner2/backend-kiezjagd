// routes/newsletter.js
const express = require('express');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const router = express.Router();

// POST /api/newsletter/subscribe
router.post("/subscribe", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email ist erforderlich" });

  try {
    const existing = await NewsletterSubscriber.findOne({ email });
    if (existing) {
      if (existing.isUnsubscribed) {
        existing.isUnsubscribed = false;
        existing.unsubscribedAt = null;
        await existing.save();
      }
      return res.status(200).json({ message: "Bereits eingetragen (reaktiviert)" });
    }

    await NewsletterSubscriber.create({ email });
    res.status(201).json({ message: "Erfolgreich eingetragen" });
  } catch (err) {
    res.status(500).json({ message: "Fehler beim Speichern", error: err });
  }
});

// POST /api/newsletter/unsubscribe
router.post("/unsubscribe", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email ist erforderlich" });

  try {
    const subscriber = await NewsletterSubscriber.findOne({ email });
    if (!subscriber) return res.status(404).json({ message: "Nicht gefunden" });

    subscriber.isUnsubscribed = true;
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();

    res.status(200).json({ message: "Erfolgreich abgemeldet" });
  } catch (err) {
    res.status(500).json({ message: "Fehler beim Abmelden", error: err });
  }
});

module.exports = router;
