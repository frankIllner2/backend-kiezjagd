    const express = require("express");
    const NewsletterSubscriber = require("../models/NewsletterSubscriber"); // Pfad anpassen, falls deine models/ nicht neben routes/ liegt
    const mailer = require("../utils/mailer"); // Pfad ggf. anpassen
    const router = express.Router();

    // Middlewares sicher laden (mit Fallbacks)
    let isAuthenticated, isAdmin;
    try {
    const auth = require("../middleware/auth"); // <-- richtiger relativer Pfad von routes/ aus
    isAuthenticated = typeof auth.isAuthenticated === "function" ? auth.isAuthenticated : null;
    isAdmin = typeof auth.isAdmin === "function" ? auth.isAdmin : null;
    } catch (e) {
    // kein auth-Modul vorhanden – für den Start lassen wir durch
    }
    if (!isAuthenticated) isAuthenticated = (req, res, next) => next();
    if (!isAdmin) isAdmin = (req, res, next) => next();

    // GET /api/admin/newsletter?q=&only=all|subscribed|unsubscribed
    router.get("/", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { q = "", only = "all" } = req.query;
        const filter = {};
        if (q) filter.email = { $regex: q, $options: "i" };
        if (only === "subscribed") filter.isUnsubscribed = false;
        if (only === "unsubscribed") filter.isUnsubscribed = true;

        const items = await NewsletterSubscriber.find(filter).sort({ subscribedAt: -1 });
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: "Fehler beim Abrufen", error: err.message });
    }
    });

    // GET /api/admin/newsletter/export?filter=all|subscribed|unsubscribed  (optional)
    router.get("/export", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { filter = "all" } = req.query;
        const q = {};
        if (filter === "subscribed") q.isUnsubscribed = false;
        if (filter === "unsubscribed") q.isUnsubscribed = true;

        const items = await NewsletterSubscriber.find(q).lean();
        const csvRows = ['email,subscribedAt,isUnsubscribed,unsubscribedAt'];
        for (const s of items) {
        csvRows.push(`"${s.email}","${s.subscribedAt?.toISOString() || ''}",${s.isUnsubscribed},"${s.unsubscribedAt?.toISOString() || ''}"`);
        }
        const csv = csvRows.join('\n');
        res.header('Content-Type', 'text/csv');
        res.attachment('newsletter-subscribers.csv');
        res.send(csv);
    } catch (err) {
        res.status(500).json({ message: "Export fehlgeschlagen", error: err.message });
    }
    });

    // POST /api/admin/newsletter/send
    router.post("/send", isAuthenticated, isAdmin, async (req, res) => {
        try {
            const { ids, subject, html = "", text = "", testEmail } = req.body;

            if (testEmail) {
            try {
                await mailer.send({ to: testEmail, subject: subject || "(Test)", html, text });
                return res.json({ message: "Test-Mail gesendet" });
            } catch (e) {
                console.error("[ADMIN-NEWSLETTER][TEST] error:", e.message || e);
                return res.status(500).json({ message: "Test fehlgeschlagen", error: e.message || String(e) });
            }
            }

            if (!subject) return res.status(400).json({ message: "Subject fehlt" });

            let recipients = [];
            if (Array.isArray(ids) && ids.length) {
            recipients = await NewsletterSubscriber.find({ _id: { $in: ids }, isUnsubscribed: false }).lean();
            } else {
            recipients = await NewsletterSubscriber.find({ isUnsubscribed: false }).lean();
            }

            const results = [];
            for (const r of recipients) {
            try {
                await mailer.send({
                to: r.email,
                subject,
                html: html.replace(/{{\s*email\s*}}/g, r.email),
                text: text.replace(/{{\s*email\s*}}/g, r.email),
                });
                results.push({ email: r.email, ok: true });
            } catch (e) {
                console.error("[ADMIN-NEWSLETTER][SEND] error to", r.email, ":", e.message || e);
                results.push({ email: r.email, ok: false, error: e.message || String(e) });
            }
            }

            const sent = results.filter(r => r.ok).length;
            const failed = results.filter(r => !r.ok);
            if (failed.length) {
            return res.status(207).json({ // 207 = Multi-Status (teilweise ok)
                message: `Versendet: ${sent}/${results.length}, Fehler: ${failed.length}`,
                results,
            });
            }
            return res.json({ message: `Versendet: ${sent}/${results.length}`, results });
        } catch (err) {
            console.error("[ADMIN-NEWSLETTER] fatal:", err.message || err);
            res.status(500).json({ message: "Fehler beim Versand", error: err.message || String(err) });
        }
        });


    router.put("/:id/unsubscribe", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const s = await NewsletterSubscriber.findById(req.params.id);
        if (!s) return res.status(404).json({ message: "Nicht gefunden" });
        s.isUnsubscribed = true; s.unsubscribedAt = new Date();
        await s.save();
        res.json({ message: "Abgemeldet" });
    } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.put("/:id/reactivate", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const s = await NewsletterSubscriber.findById(req.params.id);
        if (!s) return res.status(404).json({ message: "Nicht gefunden" });
        s.isUnsubscribed = false; s.unsubscribedAt = null;
        await s.save();
        res.json({ message: "Reaktiviert" });   
    } catch (err) { res.status(500).json({ message: err.message }); }
    });

    router.delete("/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
        await NewsletterSubscriber.findByIdAndDelete(req.params.id);
        res.json({ message: "Gelöscht" });
    } catch (err) { res.status(500).json({ message: err.message }); }
    });

    module.exports = router;
