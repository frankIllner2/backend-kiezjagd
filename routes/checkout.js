const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const { sendGameLink } = require('../services/emailService');
const Game = require('../models/Game');

// ✅ Middleware für rohe Stripe-Payloads
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET // Webhook-Secret aus .env
      );
    } catch (err) {
      console.error('❌ Fehler bei der Webhook-Verifizierung:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 📡 Webhook-Ereignisse behandeln
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
       
        try {
          const order = await Order.findOneAndUpdate(
            { sessionId: session.id }, // Suche nach der Session-ID
            { paymentStatus: 'paid' }, // Update auf 'paid'
            { new: true } // Gibt das aktualisierte Dokument zurück
          );

          // 🆕 Spielnamen aus der Game-Datenbank abrufen
          const game = await Game.findOne({ encryptedId: session.metadata.gameId });
          if (!game) {
            return res.status(404).json({ message: '❌ Spiel nicht gefunden' });
          }

          if (order) {
            console.log('✅ Bestellung aktualisiert, E-Mail wird gesendet.');
            await sendGameLink(order.email, session.id,session.metadata.gameId, game.name);
          } else {
            console.warn('❌ Keine Bestellung mit dieser Session-ID gefunden.');
          }
          
          console.log('✅ Zahlung erfolgreich, Bestellung aktualisiert');
        } catch (error) {
          console.error('❌ Fehler beim Aktualisieren der Bestellung:', error.message);
        }

        break;

      default:
        console.warn(`⚠️ Unerwartetes Ereignis: ${event.type}`);
    }

    res.json({ received: true });
  }
);

// ✅ Route: Bestellung überprüfen (Optional für Frontend-Validierung)
router.get('/order-status/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
  
      if (!sessionId) {
        return res.status(400).json({ message: '⚠️ Session-ID ist erforderlich.' });
      }
  
      const order = await Order.findOne({ sessionId });
  
      if (!order) {
        return res.status(404).json({ message: '❌ Bestellung nicht gefunden.' });
      }
  
      const gameLink = `${process.env.FRONTEND_URL}/game/${order.gameId}?email=${encodeURIComponent(order.email)}`;
  
      res.json({
        order: {
          gameId: order.gameId,
          email: order.email,
          timestamp: order.createdAt,
          gameName: order.gameName,
        },
        gameLink,
      });
    } catch (error) {
      console.error('❌ Fehler beim Abrufen des Bestellstatus:', error);
      res.status(500).json({ message: 'Interner Serverfehler', error: error.message });
    }
});
  
module.exports = router;
