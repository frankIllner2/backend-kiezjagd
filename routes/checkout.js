const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');

  
// ✅ Route: Stripe-Checkout starten
router.post('/create-checkout-session', async (req, res) => {
  const { gameId, email } = req.body;

  try {
    // Validierung der Eingaben
    if (!email || !gameId) {
      return res.status(400).json({ message: 'E-Mail und Spiel-ID sind erforderlich' });
    }

    // Bestellung vormerken
    const order = new Order({
      gameId,
      email,
      paymentStatus: 'pending',
    });
    await order.save();

    // Stripe-Session erstellen
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Spiel-ID: ${gameId}`,
            },
            unit_amount: 1000, // Preis in Cent
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Fehler beim Erstellen der Stripe-Session:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Stripe Webhook-Handler
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];
  
    let event;
  
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET // Webhook-Secret aus dem Stripe-Dashboard
      );
    } catch (err) {
      console.error('❌ Webhook-Fehler:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  
    // Verarbeite das Ereignis
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('✅ Zahlung abgeschlossen:', session);
        // Hier kannst du Daten in deiner Datenbank aktualisieren
        break;
      default:
        console.warn(`🔔 Unerwartetes Ereignis: ${event.type}`);
    }
  
    res.json({ received: true });
  });


module.exports = router;