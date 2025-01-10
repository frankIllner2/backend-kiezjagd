const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const { sendGameLink } = require('../services/emailService');

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
        console.log('gameId');
        console.log(session.metadata.gameId);
        try {
          const order = await Order.findOneAndUpdate(
            { sessionId: session.id }, // Suche nach der Session-ID
            { paymentStatus: 'paid' }, // Update auf 'paid'
            { new: true } // Gibt das aktualisierte Dokument zurück
          );
          if (order) {
            console.log('✅ Bestellung aktualisiert, E-Mail wird gesendet.');
            await sendGameLink(order.email, order.gameId);
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

// ✅ Stripe-Checkout starten
router.post('/create-checkout-session', async (req, res) => {
    const { gameId, email } = req.body;
  
    try {
      if (!email || !gameId) {
        return res.status(400).json({ message: '⚠️ E-Mail und Spiel-ID sind erforderlich' });
      }
  
      // Stripe-Session erstellen
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer_email: email,
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: { name: game.name },
            unit_amount: 500, // Preis in Cent
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      });
  
      // Bestellung speichern, inklusive sessionId
      const order = new Order({
        gameId,
        gameName: game.name,
        email,
        paymentStatus: 'pending',
        sessionId: session.id, // Speichere die Stripe-Session-ID
      });
      await order.save();
  
      res.json({ url: session.url });
    } catch (error) {
      console.error('❌ Fehler beim Erstellen der Stripe-Session:', error);
      res.status(500).json({ error: error.message });
    }
});

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
