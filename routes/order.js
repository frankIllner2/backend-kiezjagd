// routes/order.js
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const Game = require('../models/Game');
const Order = require('../models/Order');
const { sendGameLink } = require('../services/emailService');
const { generateInvoiceNumber } = require('../utils/generateInvoiceNumber');
const { generateInvoiceBuffer } = require('../services/generateInvoice');

// Helper: Prüfen, ob ein Wert eine valide Mongo ObjectId ist
const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);

// E-Mail Transport (einfach; identisch zu deinem Setup; passe ggf. an)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: process.env.NODE_ENV === 'production' ? {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  } : undefined,
  debug: true,
  logger: true,
});

// Hilfsfunktion: Rabatt-Infos aus der Session ziehen (Checkout)
function extractDiscountInfoFromSession(session) {
  const total = session.amount_total ?? 0; // Cent
  const amountDiscount = session.total_details?.amount_discount ?? 0; // Cent

  let label = null, code = null, percentOff = null, amountOff = null;

  const d = session.discounts?.[0];
  if (d?.coupon) {
    label = d.coupon.name || 'Gutschein';
    percentOff = d.coupon.percent_off ?? null;
    amountOff = d.coupon.amount_off ?? null; // Cent
  }
  if (d?.promotion_code?.code) {
    code = d.promotion_code.code;
  }

  const isFree = total === 0 || session.payment_status === 'no_payment_required';

  return {
    label,
    code,
    percentOff,
    amountOff,
    amountDiscount, // Cent
    total,          // Cent
    isFree,
  };
}

/**
 * ✅ Stripe-Checkout erstellen
 * Akzeptiert gameId als Mongo-_id ODER als encryptedId.
 * Speichert und übergibt intern die encryptedId als kanonische ID.
 */
router.post('/create-checkout-session', async (req, res) => {
  const { gameId, email, voucherCode } = req.body;

  if (!email || !gameId) {
    console.error('⚠️ Fehlende E-Mail oder Spiel-ID:', { email, gameId });
    return res.status(400).json({ message: '⚠️ E-Mail und Spiel-ID sind erforderlich.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('⚠️ Ungültige E-Mail-Adresse:', email);
    return res.status(400).json({
      code: 'EMAIL_INVALID',
      error: 'Bitte gib eine gültige E-Mail-Adresse ein.'
    });
  }

  let order;

  try {
    // Spiel laden – _id ODER encryptedId unterstützen
    let game;
    if (isObjectId(gameId)) {
      game = await Game.findById(gameId);
      if (!game) {
        game = await Game.findOne({ encryptedId: gameId });
      }
    } else {
      game = await Game.findOne({ encryptedId: gameId });
    }

    if (!game) {
      return res.status(404).json({ message: '❌ Spiel nicht gefunden' });
    }

    // Kanonische IDs
    const canonicalEncryptedId = game.encryptedId;

    // Rechnungsnummer
    const invoiceNumber = await generateInvoiceNumber();

    // Ablaufzeit: Link 48h gültig
    const now = new Date();
    const endTime = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Preis robust parsen
    const priceRaw = game.price;
    const price =
      typeof priceRaw === 'number'
        ? priceRaw
        : parseFloat(String(priceRaw).replace(/[^\d,.]/g, '').replace(',', '.'));
    if (Number.isNaN(price)) {
      console.error('❌ Preis konnte nicht verarbeitet werden:', priceRaw);
      return res.status(400).json({ error: '❌ Preis ist ungültig.' });
    }

    // Bestellung vormerken
    order = new Order({
      gameId: canonicalEncryptedId,
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
    console.log('✅ Bestellung gespeichert:', order._id, 'für Spiel', canonicalEncryptedId);

    // 🎟️ Discounts ermitteln (Promotion Code bevorzugt)
    const discounts = [];
    if (voucherCode) {
      try {
        const promo = await stripe.promotionCodes.list({
          code: voucherCode,
          active: true,
          limit: 1
        });
        if (promo.data.length) {
          discounts.push({ promotion_code: promo.data[0].id });
        } else if (/^promo_/.test(voucherCode)) {
          discounts.push({ promotion_code: voucherCode });
        } else {
          const c = await stripe.coupons.retrieve(voucherCode);
          if (c?.valid) {
            discounts.push({ coupon: voucherCode });
          } else {
            return res.status(400).json({
              code: 'PROMO_CODE_INVALID',
              error: 'Dieser Gutscheincode ist abgelaufen oder ungültig.'
            });
          }
        }
      } catch (e) {
        console.warn('⚠️ Gutschein ungültig/Fehler:', e?.message || e);
        return res.status(400).json({
          code: 'PROMO_CODE_INVALID',
          error: 'Dieser Gutscheincode ist abgelaufen oder ungültig.'
        });
      }
    }

    // Stripe-Session erstellen
    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      metadata: { gameId: canonicalEncryptedId },
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: game.name },
            unit_amount: Math.round(price * 100)
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      discounts, // [] ist ok
      // allow_promotion_codes: true, // optional
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`
    });

    // Session-ID in der Order merken
    order.sessionId = session.id;
    await order.save();
    console.log('✅ Stripe-Session erstellt:', session.id);

    return res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Fehler bei Stripe-Checkout:', err?.message || err);

    const isStripe4xx =
      err?.type === 'StripeInvalidRequestError' ||
      err?.message?.toLowerCase?.().includes('coupon') ||
      err?.message?.toLowerCase?.().includes('promotion');

    if (order?._id && !order.sessionId) {
      try {
        await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'failed' } });
      } catch (e) {
        console.warn('⚠️ Konnte Order-Status nicht auf failed setzen:', e?.message || e);
      }
    }

    return res.status(isStripe4xx ? 400 : 500).json({
      error: isStripe4xx
        ? err.message || 'Dieser Gutscheincode ist abgelaufen oder ungültig.'
        : 'Checkout fehlgeschlagen.',
      code: isStripe4xx ? 'PROMO_CODE_INVALID' : 'CHECKOUT_ERROR'
    });
  }
});

/**
 * ✅ Zahlung verifizieren
 * Setzt Order auf "paid", sendet Spiel-Link und Rechnung (mit Rabatt, wenn vorhanden).
 */
router.post('/verify-payment', async (req, res) => {
  const { sessionId } = req.body;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'discounts', 'discounts.coupon', 'discounts.promotion_code']
    });

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ message: '❌ Zahlung nicht erfolgreich' });
    }

    const gameId = session.metadata.gameId;

    const order = await Order.findOneAndUpdate(
      { sessionId },
      { paymentStatus: 'paid' },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: '❌ Bestellung nicht gefunden' });
    }

    // Rabatt-Infos aus Session
    const d = extractDiscountInfoFromSession(session);

    // PDF-Rechnung erzeugen
    const pdfBuffer = await generateInvoiceBuffer({
      invoiceNumber: order.invoiceNumber,
      gameName: order.gameName,
      price: order.price,                      // Originalpreis EUR
      email: order.email,
      date: new Date(),

      // Rabatt/Total aus Stripe-Session
      discountLabel: d.label,
      discountCode: d.code,
      percentOff: d.percentOff,
      discountAmount: ((d.amountDiscount || d.amountOff || 0) / 100), // EUR
      total: (d.total ?? Math.round(order.price * 100)) / 100,        // EUR Endsumme
    });

    // Spiel-Link senden (wie gehabt)
    await sendGameLink(order.email, sessionId, gameId, order.gameName, order.price);
    console.log('📧 Spiel-Link gesendet an', order.email, 'für', gameId);

    // Rechnung per E-Mail versenden
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: order.email,
      subject: `Rechnung Kiezjagd #${String(order.invoiceNumber).padStart(3, '0')}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <p>Hallo,</p>
          <p>vielen Dank für deine Bestellung bei <strong>Kiezjagd</strong>! 
            Im Anhang findest du die Rechnung für dein Spiel: <strong>${order.gameName}</strong>.</p>

          <p>Wir wünschen dir und deinem Team ganz viel Spaß beim Rätseln und Entdecken!</p>

          <p style="margin-top:20px;">
            Herzliche Grüße<br/>
            dein Kiezjagd-Team
          </p>
        </div>`,
      attachments: [
        {
          filename: `Rechnung-${String(order.invoiceNumber).padStart(3, '0')}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    return res.json({ message: '✅ Zahlung verifiziert, Spiel-Link & Rechnung versendet' });
  } catch (error) {
    console.error('❌ Fehler bei Zahlungsprüfung:', error?.message || error);
    return res.status(500).json({ error: error.message || 'Interner Serverfehler' });
  }
});

/**
 * ✅ Link-Gültigkeit prüfen
 */
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
    console.error('❌ Fehler bei der Prüfung des Links:', error?.message || error);
    return res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

/**
 * ✅ Bestellungen abrufen (Admin/Übersicht)
 */
// routes/order.js  (nur die /orders-Route)
router.get('/orders', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 200);
    const search = (req.query.search || '').trim();
    const searchBy = (req.query.searchBy || 'email').trim();
    const sortParam = (req.query.sort || '-createdAt').trim();

    const filter = {};
    if (search) {
      if (searchBy === 'email') {
        filter.email = { $regex: escapeRegex(search), $options: 'i' };
      } else if (searchBy === 'gameId') {
        filter.gameId = { $regex: escapeRegex(search), $options: 'i' };
      } else if (searchBy === 'date') {
        const [from, to] = search.split('..');
        if (from && !to) {
          const start = new Date(from);
          const end = new Date(from); end.setDate(end.getDate() + 1);
          filter.createdAt = { $gte: start, $lt: end };
        } else if (from && to) {
          const start = new Date(from);
          const end = new Date(to); end.setDate(end.getDate() + 1);
          filter.createdAt = { $gte: start, $lt: end };
        }
      }
    }

    const sort = sortStrToObj(sortParam);
    const [items, total] = await Promise.all([
      // falls du kein createdAt hast, fällt auf createdTime zurück
      Order.aggregate([
        { $match: filter },
        { $addFields: { _created: { $ifNull: ['$createdAt', '$createdTime'] } } },
        { $sort: Object.keys(sort).length
            ? Object.fromEntries(Object.entries(sort).map(([k,v]) => [k==='createdAt'?'_created':k, v]))
            : { _created: -1, _id: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $project: { _created: 0 } },
      ]),
      Order.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
  } catch (error) {
    console.error('❌ /order/orders:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Bestellungen.' });
  }
});

function escapeRegex(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function sortStrToObj(s){ if(!s) return { createdAt:-1 }; const f=s.replace(/^-/, ''); const d=s.startsWith('-')?-1:1; return {[f]:d}; }


module.exports = router;
