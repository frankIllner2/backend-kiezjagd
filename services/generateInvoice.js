// utils/generateInvoice.js
const PDFDocument = require('pdfkit');
const path = require('path');

function formatEUR(value) {
  // erwartet Number oder String
  const num = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!isFinite(num)) return String(value);
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(num);
}

function generateInvoiceBuffer({
  from = 'Kiezjagd – Pasteurstr. 4 · 10407 Berlin',
  to = { name: '', address1: '', address2: '' }, // address2 optional (PLZ/Ort)
  invoiceNumber = '000',
  invoiceDate = new Date(),
  items = [
    // { pos: 1, title: 'Feen-Ausbildung', price: 4.00 }
  ],
  total = null, // wenn null -> Summe aus items
  notes = [
    'Sofern nicht anders angegeben, entspricht das Leistungsdatum dem Rechnungsdatum.',
    'Gemäß §19 UStG enthält der Rechnungsbetrag keine Umsatzsteuer.'
  ],
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Assets (passe Pfade an deine Dateien an)
      const logoPath = path.join(__dirname, '../public/logo.png');   // „Kiezjagd“-Schriftzug
      const frank    = path.join(__dirname, '../public/frank.png');
      const frida    = path.join(__dirname, '../public/frida.png');
      const fritz    = path.join(__dirname, '../public/fritz.png');
      const julia    = path.join(__dirname, '../public/julia.png');

      // Farben/Typo
      const primary = '#355b4c';
      const textCol = primary;
      const lineCol = '#cfd7d2';

      const pageW = doc.page.width;
      const pageH = doc.page.height;

      doc.fillColor(textCol);

      // Header: Absender links
      doc.fontSize(10).text(from, 50, 50);

      // Logo rechts oben
      try {
        const logoW = 110;
        doc.image(logoPath, pageW - 50 - logoW, 45, { width: logoW });
      } catch {}

      // Empfänger + Invoice-Infos Block
      let y = 95;

      // „An:“
      doc.fontSize(10).text('An:', 50, y);
      const toX = 80;
      doc.fontSize(12).text(to.name || '', toX, y);
      if (to.address1) doc.text(to.address1, toX, (y += 16));
      if (to.address2) doc.text(to.address2, toX, (y += 16));

      // Rechts daneben: Rechnungsnr./Datum
      const infoX = pageW - 240;
      y = 95;
      doc.fontSize(10).text('Rechnungsnr.', infoX, y);
      doc.fontSize(12).text(String(invoiceNumber).padStart(3, '0'), infoX + 100, y, { width: 90, align: 'right' });

      y += 18;
      doc.fontSize(10).text('Datum', infoX, y);
      const dateStr = new Intl.DateTimeFormat('de-DE').format(invoiceDate);
      doc.fontSize(12).text(dateStr, infoX + 100, y, { width: 90, align: 'right' });

      // Überschrift
      y = 155;
      doc.fontSize(18).text('Rechnung', 50, y);

      // Tabelle
      y += 26;

      const colPosX = 50;
      const colDescX = 110;
      const colPriceX = pageW - 50 - 100;

      // Linien oben/unten
      const drawHLine = (yy) => {
        doc.save().strokeColor(lineCol).lineWidth(1)
          .moveTo(50, yy).lineTo(pageW - 50, yy).stroke().restore();
      };

      // Tabellen-Header
      doc.fontSize(10);
      doc.text('Position', colPosX, y);
      doc.text('Beschreibung', colDescX, y);
      doc.text('Preis', colPriceX, y, { width: 100, align: 'right' });

      y += 10;
      drawHLine(y);
      y += 10;

      // Positionen
      doc.fontSize(12);
      items.forEach((it, idx) => {
        const pos = it.pos ?? idx + 1;
        const title = it.title ?? '';
        const price = formatEUR(it.price ?? 0);

        doc.text(String(pos) + '.', colPosX, y);
        doc.text(title, colDescX, y, { width: colPriceX - colDescX - 20 });
        doc.text(price, colPriceX, y, { width: 100, align: 'right' });

        y += 22;
      });

      // Untere Tabellenlinie
      drawHLine(y);
      y += 12;

      // Total rechts
      const sum = total == null
        ? items.reduce((acc, it) => acc + (Number(it.price) || 0), 0)
        : total;
      doc.fontSize(12).text('Total', colDescX, y, { width: colPriceX - colDescX - 20, align: 'right' });
      doc.fontSize(12).text(formatEUR(sum), colPriceX, y, { width: 100, align: 'right' });
      y += 24;

      // Hinweise
      doc.fontSize(9);
      (notes || []).forEach((line) => {
        doc.text(line, 50, y, { width: pageW - 100 });
        y += 14;
      });

      // Danke-Text
      y += 24;
      doc.fontSize(12).text(
        'Vielen Dank für deinen Einkauf bei Kiezjagd!\nBei Fragen melde dich gern: info@kiezjagd.de',
        50, y, { width: pageW - 100, align: 'center' }
      );

      y += 40;
      doc.fontSize(12).text(
        'Viele Grüße und bis bald,\n    eure Fritz und Frida von Kiezjagd',
        50, y, { width: pageW - 100, align: 'center' }
      );

      // Strichfiguren unten (gleichmäßig verteilt)
      const placeRow = (images, yPos, targetH) => {
        const n = images.length;
        if (!n) return;
        const gap = (pageW - 100) / (n + 1); // 50 Rand links/rechts
        for (let i = 0; i < n; i++) {
          const imgPath = images[i];
          try {
            // openImage gibt Maße → zentrierte Position nach Breite skalieren
            const img = doc.openImage(imgPath);
            const scale = targetH / img.height;
            const w = img.width * scale;
            const cx = 50 + gap * (i + 1);
            const x = cx - w / 2;
            doc.image(img, x, yPos, { height: targetH });
          } catch {}
        }
      };

      const bottomY = pageH - 140; // optischer Abstand
      placeRow([frida, fritz, julia, frank], bottomY, 70);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoiceBuffer };
