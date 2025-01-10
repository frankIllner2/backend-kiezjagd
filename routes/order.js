const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Game = require('../models/Game');
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
    // 🆕 Spielnamen aus der Game-Datenbank abrufen
    const game = await Game.findOne({ encryptedId: gameId });
    if (!game) {
      return res.status(404).json({ message: '❌ Spiel nicht gefunden' });
    }
    console.log( game.name);

    // ✅ Bestellung vormerken (MongoDB)
    const order = new Order({
      gameId,
      email,
      gameName: game.name,
      paymentStatus: 'pending',
      sessionId: null,
    
    });
    await order.save();
    console.log('✅ Bestellung gespeichert:', order);

    // ✅ Stripe-Session erstellen
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      metadata: { gameId },
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: game.name },
            unit_amount: 500,
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

// ✅ Bestellung nach Zahlung prüfen
router.post('/verify-payment', async (req, res) => {
  const { sessionId } = req.body;
  console.log('########### verify payment ##########');
  console.log(sessionId);
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ message: '❌ Zahlung nicht erfolgreich' });
    }

    const order = await Order.findOneAndUpdate(
      { sessionId: sessionId },
      { paymentStatus: 'paid' }
    );
    console.log('######### order email ###########');
    console.log(order.email);
    console.log(order.gameId);
    if (order) {
      await sendGameLink(order.email, order.gameId);
      res.json({ message: '✅ Spiel-Link gesendet' });
    } else {
      res.status(404).json({ message: '❌ Bestellung nicht gefunden' });
    }
  } catch (error) {
    console.error('❌ Fehler bei Zahlungsprüfung:', error);
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
