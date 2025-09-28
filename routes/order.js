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

// --- Startup-Logs (helfen bei Live/Test/Account-Verwechslungen)
try {
  console.log('[Stripe] mode:', process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'LIVE' : 'TEST');
  stripe.accounts.retrieve().then(acc => {
    console.log('[Stripe] account:', acc.id, acc.email);
  }).catch(()=>{});
} catch {}

// Helper: Prüfen, ob ein Wert eine valide Mongo ObjectId ist
const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);

// --- Helfer für Promo-/Coupon-Handling
function normalizePromoInput(input) {
  return String(input || '')
    .trim()
    .replace(/[\u2010-\u2015\u2212]/g, '-') // typografische Striche → "-"
    .replace(/\s+/g, '');                   // alle Whitespaces raus
}
function debugBytes(label, s) {
  if (process.env.NODE_ENV === 'production') return;
  const b = Buffer.from(String(s || ''), 'utf8');
  console.log(label, JSON.stringify(String(s)), 'bytes:', [...b]);
}

/**
 * Löst den Kundencode (z. B. "KJ-123456") in ein Stripe-Discount-Objekt auf.
 * Alles mit "-" wird ausschließlich als Promotion Code behandelt (nie als Coupon).
 */
async function resolveDiscount(stripeClient, raw) {
  const code = normalizePromoInput(raw);

  if (code.includes('-') || /^promo_/i.test(code)) {
    let list = await stripeClient.promotionCodes.list({ code, active: true, limit: 1 });
    if (list.data.length) {
      return { promotion_code: list.data[0].id };
    }

    list = await stripeClient.promotionCodes.list({ code, limit: 1 });
    if (list.data.length) {
      const err = new Error('Promotion code exists but is inactive');
      err.code = 'PROMO_INACTIVE';
      throw err;
    }

    if (/^promo_\w+$/i.test(code)) {
      return { promotion_code: code };
    }
    return null;
  }

  if (/^coupon_\w+$/i.test(code) || /^[A-Za-z0-9]{6,}$/.test(code)) {
    try {
      const c = await stripeClient.coupons.retrieve(code);
      if (c?.valid) return { coupon: c.id };
    } catch {}
  }

  const list = await stripeClient.promotionCodes.list({ code, active: true, limit: 1 });
  if (list.data.length) {
    return { promotion_code: list.data[0].id };
  }
  return null;
}

// E-Mail Transport
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

// Rabatt-Infos aus der Session
function extractDiscountInfoFromSession(session) {
  const total = session.amount_total ?? 0; // Cent
  const amountDiscount = session.total_details?.amount_discount ?? 0; // Cent

  let label = null, code = null, percentOff = null, amountOff = null;

  const d = session.discounts?.[0];
  if (d?.coupon) {
    label = d.coupon.name || 'Gutschein';
    percentOff = d.coupon.percent_off ?? null;
    amountOff = d.coupon.amount_off ?? null;
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
    amountDiscount,
    total,
    isFree,
  };
}

/**
 * ✅ Stripe-Checkout erstellen
 */
router.post('/create-checkout-session', async (req, res) => {
  const { gameId, email, voucherCode } = req.body;

  if (!email || !gameId) {
    return res.status(400).json({ message: '⚠️ E-Mail und Spiel-ID sind erforderlich.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      code: 'EMAIL_INVALID',
      error: 'Bitte gib eine gültige E-Mail-Adresse ein.'
    });
  }

  let order;

  try {
    let game;
    if (isObjectId(gameId)) {
      game = await Game.findById(gameId);
      if (!game) game = await Game.findOne({ encryptedId: gameId });
    } else {
      game = await Game.findOne({ encryptedId: gameId });
    }
    if (!game) return res.status(404).json({ message: '❌ Spiel nicht gefunden' });

    const canonicalEncryptedId = game.encryptedId;
    const invoiceNumber = await generateInvoiceNumber();

    const now = new Date();
    const endTime = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const priceRaw = game.price;
    const price =
      typeof priceRaw === 'number'
        ? priceRaw
        : parseFloat(String(priceRaw).replace(/[^\d,.]/g, '').replace(',', '.'));
    if (Number.isNaN(price)) {
      return res.status(400).json({ error: '❌ Preis ist ungültig.' });
    }

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

    const discounts = [];
    if (voucherCode && typeof voucherCode === 'string') {
      const normalized = normalizePromoInput(voucherCode);
      try {
        const d = await resolveDiscount(stripe, normalized);
        if (!d) {
          return res.status(400).json({
            code: 'PROMO_CODE_INVALID',
            error: 'Gutscheincode existiert in dieser Stripe-Umgebung nicht oder ist falsch.'
          });
        }
        discounts.push(d);
      } catch (e) {
        const msg = e?.code === 'PROMO_INACTIVE'
          ? 'Dieser Gutscheincode ist nicht mehr aktiv (Limit/Ablauf/Deaktivierung).'
          : 'Gutscheincode existiert in dieser Stripe-Umgebung nicht oder ist falsch.';
        return res.status(400).json({ code: 'PROMO_CODE_INVALID', error: msg });
      }
    }

    const lineItems = [];
    if (game.stripePriceId) {
      lineItems.push({ price: game.stripePriceId, quantity: 1 });
    } else {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: { name: game.name },
          unit_amount: Math.round(price * 100)
        },
        quantity: 1
      });
    }

    // ...
    // Stripe-Session erstellen
    const hasDiscount = discounts.length > 0;

    const sessionParams = {
      customer_email: email,
      metadata: { gameId: canonicalEncryptedId },
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`
    };

    // Entweder discounts ODER allow_promotion_codes
    if (hasDiscount) {
      sessionParams.discounts = discounts;
    } else {
      sessionParams.allow_promotion_codes = true;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    // ...

    order.sessionId = session.id;
    await order.save();

    return res.json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Checkout fehlgeschlagen.' });
  }
});

/**
 * ✅ Zahlung verifizieren
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
    if (!order) return res.status(404).json({ message: '❌ Bestellung nicht gefunden' });

    const d = extractDiscountInfoFromSession(session);

    const pdfBuffer = await generateInvoiceBuffer({
      invoiceNumber: order.invoiceNumber,
      gameName: order.gameName,
      price: order.price,
      email: order.email,
      date: new Date(),
      discountLabel: d.label,
      discountCode: d.code,
      percentOff: d.percentOff,
      discountAmount: ((d.amountDiscount || d.amountOff || 0) / 100),
      total: (d.total ?? Math.round(order.price * 100)) / 100,
    });

    await sendGameLink(order.email, sessionId, gameId, order.gameName, order.price);

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: order.email,
      subject: `Rechnung Kiezjagd #${String(order.invoiceNumber).padStart(3, '0')}`,
      html: `<div><p>Hallo,</p><p>vielen Dank für deine Bestellung bei <strong>Kiezjagd</strong>! 
            Im Anhang findest du die Rechnung für dein Spiel: <strong>${order.gameName}</strong>.</p>
            <p>Viel Spaß beim Rätseln!</p></div>`,
      attachments: [
        {
          filename: `Rechnung-${String(order.invoiceNumber).padStart(3, '0')}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    return res.json({ message: '✅ Zahlung verifiziert, Spiel-Link & Rechnung versendet' });
  } catch (error) {
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
    if (!order) return res.status(404).json({ message: '❌ Spiel nicht gefunden.' });

    const now = new Date();
    if (order.isExpired || order.endTime < now) {
      return res.status(410).json({ message: '❌ Der Link ist abgelaufen.' });
    }

    return res.json({ message: '✅ Der Link ist gültig.', gameId: order.gameId });
  } catch (error) {
    return res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

/**
 * ✅ Bestellungen abrufen (Admin/Übersicht)
 */
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
      }
    }

    const sort = sortStrToObj(sortParam);
    const [items, total] = await Promise.all([
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
    res.status(500).json({ error: 'Fehler beim Abrufen der Bestellungen.' });
  }
});

function escapeRegex(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function sortStrToObj(s){ if(!s) return { createdAt:-1 }; const f=s.replace(/^-/, ''); const d=s.startsWith('-')?-1:1; return {[f]:d}; }

module.exports = router;
