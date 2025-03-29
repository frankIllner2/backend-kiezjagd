const PDFDocument = require('pdfkit');
const path = require('path');

function generateInvoiceBuffer({ invoiceNumber, gameName, price, email, date }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];

      // Farben
      const primaryColor = '#355b4c';
      const accentColor = '#FAC227';
      const lightGray = '#cccccc';

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Logo & Absender
      const logoPath = path.join(__dirname, '../public/logo.png');
      doc.image(logoPath, 50, 45, { width: 80 });

      doc
        .fillColor(primaryColor)
        .fontSize(16)
        .text('Kiezjagd', 100, 50)
        .fontSize(10)
        .text('Pasteurstraße 4', 100, 70)
        .text('10407 Berlin', 100, 85)
        .text('info@kiezjagd.de', 100, 100);

      // Rechnungsnummer + Datum oben rechts
      doc
        .fontSize(12)
        .fillColor(primaryColor)
        .text(`Rechnung`, 400, 50, { align: 'right' })
        .text(`Rechnungs-Nr: ${invoiceNumber}`, { align: 'right' })
        .text(`Datum: ${date}`, { align: 'right' });

      // Linie unter Kopfbereich
      doc
        .moveTo(50, 130)
        .lineTo(550, 130)
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

      // Spiel- & Preisangaben
      doc
        .moveDown(2)
        .fontSize(12)
        .fillColor(primaryColor)
        .text('Gekauftes Spiel:', 50)
        .moveDown(0.5)
        .fontSize(11)
        .fillColor('black')
        .text(gameName);

      doc
        .moveDown(1.5)
        .fontSize(12)
        .fillColor(primaryColor)
        .text('Gesamtpreis:', 50);

      doc
        .fontSize(14)
        .fillColor(accentColor)
        .text(`${price.toFixed(2)} EUR`, 150, doc.y - 15);

      // Linie vor Fußzeile
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
