const PDFDocument = require('pdfkit');
const path = require('path');

function generateInvoiceBuffer({ invoiceNumber, gameName, price, email, date }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];

      // Farben
      const primaryColor = '#355b4c';
      const lightGray = '#E9E2D0';

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Logo oben links
      const logoPath = path.join(__dirname, '../public/logo.png');
      doc.image(logoPath, 50, 45, { width: 80 });

      // Absenderadresse unter dem Logo
      doc
        .fillColor(primaryColor)
        .fontSize(16)
        .text('Kiezjagd', 50, 140)
        .fontSize(10)
        .text('Pasteurstraße 4', 50, 160)
        .text('10407 Berlin', 50, 175)
        .text('info@kiezjagd.de', 50, 190);

      // Rechnungstitel & Infos – weiter unten rechts
      doc
        .fontSize(12)
        .fillColor(primaryColor)
        .text(`Rechnung`, 400, 230, { align: 'right' })
        .text(`Rechnungs-Nr: ${invoiceNumber}`, { align: 'right' })
        .text(`Datum: ${date}`, { align: 'right' });

      // Trennlinie unter Header
      doc
        .moveTo(50, 270)
        .lineTo(550, 270)
        .lineWidth(1)
        .strokeColor(lightGray)
        .stroke();

      // Kunde
      doc
        .moveDown(2)
        .fontSize(12)
        .fillColor(primaryColor)
        .text('Rechnung an:', 50)
        .moveDown(0.5)
        .fontSize(11)
        .fillColor('black')
        .text(email);

      // Spielinfo
      doc
        .moveDown(2)
        .fontSize(12)
        .fillColor(primaryColor)
        .text('Gekauftes Spiel:', 50)
        .moveDown(0.5)
        .fontSize(11)
        .fillColor('black')
        .text(gameName);

      // Preis
      doc
        .moveDown(1.5)
        .fontSize(12)
        .fillColor(primaryColor)
        .text('Gesamtpreis:', 50);

      doc
        .fontSize(14)
        .fillColor(primaryColor)
        .text(`${price.toFixed(2)} EUR`, 150, doc.y - 15);

      // Trennlinie vor Fußzeile
      doc
        .moveDown(3)
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .lineWidth(1)
        .strokeColor(lightGray)
        .stroke();

      // Fußzeile
      doc
        .moveDown(1.5)
        .fontSize(10)
        .fillColor(primaryColor)
        .text('Vielen Dank für deinen Einkauf bei Kiezjagd!', 50)
        .moveDown(0.3)
        .text('Bei Fragen melde dich gern: info@kiezjagd.de');

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoiceBuffer };
