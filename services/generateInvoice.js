// utils/generateInvoice.js
const PDFDocument = require('pdfkit');
const path = require('path');

function formatEUR(v) {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return isFinite(n)
    ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
    : String(v);
}
function toDate(d) {
  if (d instanceof Date) return d;
  const t = new Date(d);
  return isNaN(t.getTime()) ? new Date() : t;
}

function generateInvoiceBuffer({
  invoiceNumber,
  gameName,
  price,
  email,
  date,

  // 🔹 Neu: optionale Rabatt-Parameter (alle optional!)
  discountLabel,     // z.B. "Gutschein"
  discountCode,      // z.B. "ABC123"
  discountAmount,    // EUR (positiver Betrag)
  percentOff,        // z.B. 100
  total,             // EUR Endsumme nach Rabatt (falls schon bekannt)
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const offsetY = 60; 
      const bufs = [];
      doc.on('data', (b) => bufs.push(b));
      doc.on('end', () => resolve(Buffer.concat(bufs)));

      // Assets
      const logoPath = path.join(__dirname, '../public/logo.png');
      const frida = path.join(__dirname, '../public/frida.png');
      const fritz = path.join(__dirname, '../public/fritz.png');
      const julia = path.join(__dirname, '../public/julia.png');
      const frank = path.join(__dirname, '../public/frank.png');

      const primary = '#355b4c', lineCol = '#cfd7d2';
      const pageW = doc.page.width, pageH = doc.page.height;

      doc.fillColor(primary);

      // Absender
      doc.fontSize(8).text('Kiezjagd – Pasteurstr. 4 · 10407 Berlin', 50, 50 + offsetY);

      // Logo (bleibt oben, ohne Offset)
      try { doc.image(logoPath, pageW - 160, 45, { width: 90 }); } catch {}

      // Empfänger (E-Mail)
      let y = 95 + offsetY;
      doc.fontSize(10).text('An:', 50, y);
      y += 18; // etwas Abstand
      doc.fontSize(10).text(email || '', 50, y, { align: 'left' });

      // Rechnungsnr. / Datum  ▶️ Spalte etwas breiter gegen Umbruch
      const infoX = pageW - 300; // vorher pageW - 240
      y = 95 + offsetY;
      doc.fontSize(10).text('Rechnungsnr.', infoX, y);
      doc.fontSize(10).text(String(invoiceNumber).padStart(3, '0'), infoX + 100, y, { width: 120, align: 'right' }); // vorher width: 90
      y += 18;
      doc.fontSize(10).text('Datum', infoX, y);
      doc.fontSize(10).text(new Intl.DateTimeFormat('de-DE').format(toDate(date)), infoX + 100, y, { width: 120, align: 'right' });

      // Überschrift
      y = 185 + offsetY; // vorher 155 → mehr Abstand nach oben
      doc.fontSize(18).text('Rechnung', 50, y);

      // Tabelle
      y += 46; // vorher 26 → mehr Abstand zwischen Titel und Tabelle
      const colPosX = 50, colDescX = 110, colPriceX = pageW - 150;
      const line = (yy) => doc.save().strokeColor(lineCol).lineWidth(1).moveTo(50, yy).lineTo(pageW - 50, yy).stroke().restore();

      doc.fontSize(10);
      doc.text('Position', colPosX, y);
      doc.text('Beschreibung', colDescX, y);
      doc.text('Preis', colPriceX, y, { width: 100, align: 'right' });

      y += 10; line(y); y += 10;

      // Position 1
      doc.fontSize(10);
      doc.text('1.', colPosX, y);
      doc.text(gameName, colDescX, y, { width: colPriceX - colDescX - 20 });
      doc.text(formatEUR(price), colPriceX, y, { width: 100, align: 'right' });
      y += 22;

      // 🔹 NEU: Rabattzeile (nur wenn discountAmount vorhanden und > 0)
      if (discountAmount && Number(discountAmount) > 0) {
        line(y); y += 10;

        const label = discountLabel || 'Gutschein';
        const code = discountCode ? ` (${discountCode})` : '';
        const perc = percentOff ? ` – ${percentOff}%` : '';
        const title = `${label}${code}${perc}`;

        // Leere Pos.-Spalte, Titel links, negativer Betrag rechts
        doc.fontSize(10);
        doc.text('', colPosX, y);
        doc.text(title, colDescX, y, { width: colPriceX - colDescX - 20 });
        doc.text('-' + formatEUR(discountAmount), colPriceX, y, { width: 100, align: 'right' });
        y += 22;
      }

      // Abschlusslinie unter (allen) Positionen
      line(y);
      y += 32; // vorher 12 → mehr Abstand unter der Tabelle

      // 🔹 NEU: Total dynamisch (übergeben oder gerechnet)
      const grandTotal = (typeof total === 'number')
        ? total
        : Math.max(0, (Number(price) || 0) - (Number(discountAmount) || 0));

      doc.fontSize(12).text('Total', colDescX, y, { width: colPriceX - colDescX - 20, align: 'right' });
      doc.fontSize(12).text(formatEUR(grandTotal), colPriceX, y, { width: 100, align: 'right' });
      y += 60;

      // 🔹 NEU: Hinweis bei „0,00 €“
      if (grandTotal === 0) {
        doc.fontSize(9).text(
          'Hinweis: Der Rechnungsbetrag wurde vollständig durch einen Gutschein ausgeglichen.',
          50, y, { width: pageW - 100, align: 'left' }
        );
        y += 20;
      }

      // Hinweise
      doc.fontSize(9).text(
        'Sofern nicht anders angegeben, entspricht das Leistungsdatum dem Rechnungsdatum.\n' +
        'Gemäß §19 UStG enthält der Rechnungsbetrag keine Umsatzsteuer.',
        50, y, { width: pageW - 100, align: 'left' }
      );
      y += 30; // mehr Abstand nach den Hinweisen

      // Danke + Gruß
      doc.fontSize(9).text(
        'Vielen Dank für deinen Einkauf bei Kiezjagd!\nBei Fragen melde dich gern: info@kiezjagd.de',
        50, y, { width: pageW - 100, align: 'left' }
      );
      y += 80 + offsetY;
      doc.fontSize(12).text(
        'Viele Grüße und bis bald,\neure Fritz und Frida von Kiezjagd',
        50, y, { width: pageW - 100, align: 'left' }
      );

      // Figuren unten
      const placeRow = (imgs, yPos, h) => {
        const n = imgs.length; if (!n) return;
        const gap = (pageW - 100) / (n + 1);
        imgs.forEach((p, i) => {
          try {
            const img = doc.openImage(p);
            const s = h / img.height, w = img.width * s;
            const cx = 50 + gap * (i + 1), x = cx - w / 2;
            doc.image(img, x, yPos, { height: h });
          } catch {}
        });
      };
      placeRow([frida, fritz, julia, frank], pageH - 140, 70);

      doc.end();
    } catch (e) { reject(e); }
  });
}

module.exports = { generateInvoiceBuffer };
