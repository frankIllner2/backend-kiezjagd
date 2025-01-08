const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const { sendGameLink } = require('../services/emailService');

// ✅ Stripe-Checkout erstellen
router.post('/create-checkout-session', async (req, res) => {

  console.log('### create-checkout-session ####');
  const { gameId, email } = req.body;
  console.log( req.body);
  try {
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

    // Stripe-Checkout-Session erstellen
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
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('❌ Fehler bei Stripe-Checkout:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Bestellung nach Zahlung prüfen
router.post('/verify-payment', async (req, res) => {
  const { sessionId } = req.body;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ message: '❌ Zahlung nicht erfolgreich' });
    }

    const order = await Order.findOneAndUpdate(
      { email: session.customer_details.email },
      { paymentStatus: 'paid' }
    );

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

module.exports = router;
