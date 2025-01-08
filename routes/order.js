const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const { sendGameLink } = require('../services/emailService');

// ✅ Stripe-Checkout erstellen
router.post('/create-checkout-session', async (req, res) => {
  console.log('### create-checkout-session ###');
  const { gameId, email } = req.body;

  if (!email || !gameId) {
    console.error('⚠️ Fehlende E-Mail oder Spiel-ID:', { email, gameId });
    return res.status(400).json({ message: '⚠️ E-Mail und Spiel-ID sind erforderlich.' });
  }

  try {
    console.log('✅ Eingaben gültig, Bestellung wird erstellt...');

    // 🔑 Stripe-Checkout-Session erstellen
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
      success_url: `${process.env.FRONTEND_URL}/success?session_id=${session.id}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    });

    console.log('✅ Stripe-Session erstellt:', session.id);

    // 🔄 Bestellung vormerken mit Stripe-Session-ID
    const order = new Order({
      gameId,
      email,
      sessionId: session.id, // Stripe-Session-ID speichern
      paymentStatus: 'pending',
    });

    await order.save();
    console.log('✅ Bestellung erfolgreich gespeichert:', order);

    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Fehler bei Stripe-Checkout:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Bestellung nach Zahlung prüfen
router.post('/verify-payment', async (req, res) => {
  console.log('### verify-payment ###');
  const { sessionId } = req.body;

  if (!sessionId) {
    console.error('⚠️ Fehlende Session-ID');
    return res.status(400).json({ message: '⚠️ Session-ID ist erforderlich.' });
  }

  try {
    // 🔍 Stripe-Session abrufen
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      console.warn('❌ Zahlung nicht erfolgreich:', session.payment_status);
      return res.status(400).json({ message: '❌ Zahlung nicht erfolgreich.' });
    }

    console.log('✅ Zahlung erfolgreich:', session.customer_email);

    // 📦 Bestellung aktualisieren
    const order = await Order.findOneAndUpdate(
      { sessionId },
      { paymentStatus: 'paid' },
      { new: true }
    );

    if (!order) {
      console.error('❌ Bestellung nicht gefunden für Session-ID:', sessionId);
      return res.status(404).json({ message: '❌ Bestellung nicht gefunden.' });
    }

    // 📧 Spiel-Link senden
    await sendGameLink(order.email, order.gameId);
    console.log('✅ Spiel-Link gesendet an:', order.email);

    res.json({ message: '✅ Spiel-Link erfolgreich gesendet.' });
  } catch (error) {
    console.error('❌ Fehler bei Zahlungsprüfung:', error.message);
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
        gameName: order.gameName,
      },
      gameLink,
    });
  } catch (error) {
    console.error('❌ Fehler beim Abrufen des Bestellstatus:', error.message);
    res.status(500).json({ message: '❌ Interner Serverfehler', error: error.message });
  }
});

module.exports = router;
