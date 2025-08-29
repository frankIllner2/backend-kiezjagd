// utils/generateInvoice.js
const PDFDocument = require('pdfkit');
const path = require('path');

function formatEUR(v) {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return isFinite(n)
    ? new Intl.DateTimeFormat // typo? no, below:
    : String(v);
}

function formatEUR(v){
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return isFinite(n)
    ? new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n)
    : String(v);
}

function toDate(d) {
  if (d instanceof Date) return d;
  if (!d) return new Date();
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function generateInvoiceBuffer({
  invoiceNumber = '000',
  gameName = '',
  price = 0,
  email = '',
  date = new Date(),
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const bufs = [];
      doc.on('data', bufs.push.bind(bufs));
      doc.on('end', () => resolve(Buffer.concat(bufs)));

      // Assets/Colors
      const logoPath = path.join(__dirname, '../public/logo.png');
      const frida = path.join(__dirname, '../public/frida.png');
      const fritz = path.join(__dirname, '../public/fritz.png');
      const julia = path.join(__dirname, '../public/julia.png');
      const frank = path.join(__dirname, '../public/frank.png');
      const primary = '#355b4c', lineCol = '#cfd7d2';
      const pageW = doc.page.width, pageH = doc.page.height;

      doc.fillColor(primary);

      // Absender
      doc.fontSize(10).text('Kiezjagd – Pasteurstr. 4 · 10407 Berlin', 50, 50);

      // Logo
      try { doc.image(logoPath, pageW - 50 - 110, 45, { width: 110 }); } catch {}

      // Empfänger (E-Mail)
      let y = 95;
      doc.fontSize(10).text('An:', 50, y);
      doc.fontSize(12).text(email || '', 80, y);

      // Rechnungsnr. / Datum
      const infoX = pageW - 240;
      y = 95;
      doc.fontSize(10).text('Rechnungsnr.', infoX, y);
      doc.fontSize(12).text(String(invoiceNumber).padStart(3, '0'), infoX + 100, y, { width: 90, align: 'right' });
      y += 18;
      doc.fontSize(10).text('Datum', infoX, y);
      doc.fontSize(12).text(new Intl.DateTimeFormat('de-DE').format(toDate(date)), infoX + 100, y, { width: 90, align: 'right' });

      // Überschrift
      y = 155;
      doc.fontSize(18).text('Rechnung', 50, y);

      // Tabelle
      y += 26;
      const colPosX = 50, colDescX = 110, colPriceX = pageW - 50 - 100;
      const line = yy => doc.save().strokeColor(lineCol).lineWidth(1).moveTo(50, yy).lineTo(pageW - 50, yy).stroke().restore();

      doc.fontSize(10);
      doc.text('Position', colPosX, y);
      doc.text('Beschreibung', colDescX, y);
      doc.text('Preis', colPriceX, y, { width: 100, align: 'right' });

      y += 10; line(y); y += 10;

      // Position 1: Spielname + Preis
      doc.fontSize(12);
      doc.text('1.', colPosX, y);
      doc.text(gameName, colDescX, y, { width: colPriceX - colDescX - 20 });
      doc.text(formatEUR(price), colPriceX, y, { width: 100, align: 'right' });
      y += 22;

      line(y); y += 12;

      // Total
      doc.fontSize(12).text('Total', colDescX, y, { width: colPriceX - colDescX - 20, align: 'right' });
      doc.fontSize(12).text(formatEUR(price), colPriceX, y, { width: 100, align: 'right' });
      y += 24;

      // Hinweise
      doc.fontSize(9).text(
        'Sofern nicht anders angegeben, entspricht das Leistungsdatum dem Rechnungsdatum.\n' +
        'Gemäß §19 UStG enthält der Rechnungsbetrag keine Umsatzsteuer.',
        50, y, { width: pageW - 100, align: 'center'  }
      );
      y += 40;

      // Dank + Gruß
      doc.fontSize(10).text(
        'Vielen Dank für deinen Einkauf bei Kiezjagd!\nBei Fragen melde dich gern: info@kiezjagd.de',
        50, y, { width: pageW - 100, align: 'center' }
      );
      y += 50;
      doc.fontSize(10).text(
        'Viele Grüße und bis bald,\n    eure Fritz und Frida von Kiezjagd',
        50, y, { width: pageW - 100, align: 'center' }
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
