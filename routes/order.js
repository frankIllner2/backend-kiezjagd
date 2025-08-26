const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Game = require('../models/Game');
const Order = require('../models/Order');
const { sendGameLink } = require('../services/emailService');
const { generateInvoiceNumber } = require('../utils/generateInvoiceNumber');

// ✅ Stripe-Checkout erstellen
router.post('/create-checkout-session', async (req, res) => {
  const { gameId, email, voucherCode } = req.body;

  if (!email || !gameId) {
    console.error('⚠️ Fehlende E-Mail oder Spiel-ID:', { email, gameId });
    return res.status(400).json({ message: '⚠️ E-Mail und Spiel-ID sind erforderlich.' });
  }

  let order; // außerhalb deklarieren, damit im catch nutzbar

  try {
    // 🆕 Spiel laden
    const game = await Game.findOne({ encryptedId: gameId });
    if (!game) {
      return res.status(404).json({ message: '❌ Spiel nicht gefunden' });
    }

    // InvoiceNumber
    const invoiceNumber = await generateInvoiceNumber();

    // Link 72h gültig
    const now = new Date();
    const endTime = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    // Preis parsen
    const price = parseFloat(String(game.price).replace(/[^\d,.]/g, '').replace(',', '.'));
    if (isNaN(price)) {
      console.error('❌ Preis konnte nicht verarbeitet werden:', game.price);
      return res.status(400).json({ error: '❌ Preis ist ungültig.' });
    }

    // ✅ Bestellung vormerken
    order = new Order({
      gameId,
      email,
      gameName: game.name,
      price,
      paymentStatus: 'pending',
      sessionId: null,
      endTime,
      invoiceNumber,
      voucherCode: voucherCode || null
    });
    await order.save();
    console.log('✅ Bestellung gespeichert:', order._id);

    // 🎟️ Discounts ermitteln (Promotion Code bevorzugt)
    const discounts = [];
    if (voucherCode) {
      // a) Klartext-Promotion-Code (z. B. "Kiezjagd_2025")
      const promo = await stripe.promotionCodes.list({
        code: voucherCode,
        active: true,
        limit: 1,
      });

      if (promo.data.length) {
        discounts.push({ promotion_code: promo.data[0].id });
      } else if (/^promo_/.test(voucherCode)) {
        // b) Promotion-Code-ID direkt
        discounts.push({ promotion_code: voucherCode });
      } else {
        // c) Letzter Versuch: Coupon-ID validieren
        try {
          const c = await stripe.coupons.retrieve(voucherCode);
          if (c.valid) {
            discounts.push({ coupon: voucherCode });
          } else {
            return res.status(400).json({
              code: 'PROMO_CODE_INVALID',
              error: 'Dieser Gutscheincode ist abgelaufen oder ungültig.',
            });
          }
        } catch {
          return res.status(400).json({
            code: 'PROMO_CODE_INVALID',
            error: 'Dieser Gutscheincode ist abgelaufen oder ungültig.',
          });
        }
      }
    }

    // ✅ Stripe-Session erstellen
    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      metadata: { gameId },
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: game.name },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      discounts, // nur wenn valide
      // allow_promotion_codes: true, // Optional: Code-Feld im Checkout
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    });

    // ✅ Session-ID speichern
    order.sessionId = session.id;
    await order.save();
    console.log('✅ Stripe-Session erstellt:', session.id);

    return res.json({ url: session.url });

  } catch (err) {
    console.error('❌ Fehler bei Stripe-Checkout:', err?.message || err);

    // Erwartbare Nutzerfehler → 400
    const isStripe4xx =
      err?.type === 'StripeInvalidRequestError' ||
      err?.message?.toLowerCase?.().includes('coupon') ||
      err?.message?.toLowerCase?.().includes('promotion');

    // Pending-Order markieren (optional)
    if (order?._id && !order.sessionId) {
      try {
        await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'failed' } });
      } catch {}
    }

    return res.status(isStripe4xx ? 400 : 500).json({
      error: isStripe4xx
        ? (err.message || 'Dieser Gutscheincode ist abgelaufen oder ungültig.')
        : 'Checkout fehlgeschlagen.',
      code: isStripe4xx ? 'PROMO_CODE_INVALID' : 'CHECKOUT_ERROR',
    });
  }
});

// ✅ Zahlung verifizieren
router.post('/verify-payment', async (req, res) => {
  const { sessionId } = req.body;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ message: '❌ Zahlung nicht erfolgreich' });
    }

    const gameId = session.metadata.gameId;

    const order = await Order.findOneAndUpdate(
      { sessionId },
      { paymentStatus: 'paid' }
    );

    if (order) {
      await sendGameLink(order.email, sessionId, gameId, order.gameName, order.price);
      console.log('📧 Spiel-Link gesendet');
      return res.json({ message: '✅ Spiel-Link gesendet' });
    } else {
      return res.status(404).json({ message: '❌ Bestellung nicht gefunden' });
    }
  } catch (error) {
    console.error('❌ Fehler bei Zahlungsprüfung:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ✅ Link-Gültigkeit prüfen
router.get('/validate-link/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const order = await Order.findOne({ sessionId });
    if (!order) {
      return res.status(404).json({ message: '❌ Spiel nicht gefunden.' });
    }

    const now = new Date();
    if (order.isExpired || order.endTime < now) {
      return res.status(410).json({ message: '❌ Der Link ist abgelaufen.' });
    }

    return res.json({ message: '✅ Der Link ist gültig.', gameId: order.gameId });
  } catch (error) {
    console.error('❌ Fehler bei der Prüfung des Links:', error.message);
    return res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

// ✅ Bestellungen abrufen
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdTime: -1 });
    return res.status(200).json(orders);
  } catch (error) {
    return res.status(500).json({ error: 'Fehler beim Abrufen der Bestellungen.' });
  }
});

module.exports = router;
