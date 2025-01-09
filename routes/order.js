const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');


// ✅ Stripe-Checkout erstellen
router.post('/create-checkout-session', async (req, res) => {
  console.log('##########gameId##########');
  const { gameId, email } = req.body;
  console.log(gameId);
  if (!email || !gameId) {
    console.error('⚠️ Fehlende E-Mail oder Spiel-ID:', { email, gameId });
    return res.status(400).json({ message: '⚠️ E-Mail und Spiel-ID sind erforderlich.' });
  }

  try {
    // ✅ Bestellung vormerken (MongoDB)
    const order = new Order({
      gameId,
      email,
      paymentStatus: 'pending',
    });
    await order.save();
    console.log('✅ Bestellung gespeichert:', order);

    // ✅ Stripe-Session erstellen
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: `Spiel-ID: ${gameId}` },
            unit_amount: 1000,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`, // Keine direkte Verwendung von session.id hier!
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    });

    // ✅ Session-ID aktualisieren
    order.sessionId = session.id;
    await order.save();

    console.log('✅ Stripe-Session erstellt:', session.id);

    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Fehler bei Stripe-Checkout:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Bestellstatus abrufen
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
        gameName: order.gameName || 'Unbekanntes Spiel',
      },
      gameLink,
    });
  } catch (error) {
    console.error('❌ Fehler beim Abrufen des Bestellstatus:', error.message);
    res.status(500).json({ message: '❌ Interner Serverfehler', error: error.message });
  }
});

module.exports = router;
