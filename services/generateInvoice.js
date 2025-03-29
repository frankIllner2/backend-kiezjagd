const PDFDocument = require('pdfkit');

function generateInvoiceBuffer({ invoiceNumber, gameName, price, email, date }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];
      const path = require('path');
      const logoPath = path.join(__dirname, '../public/logo.png');
    

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Header
      doc
        .image(logoPath, 50, 45, { width: 100 })
        .fontSize(20)
        .text('Kiezjagd', 160, 50)
        .fontSize(10)
        .text('Pasteurstraße 4', 160, 75)
        .text('10407 Berlin', 160, 90)
        .text('info@kiezjagd.de', 160, 105);

      // Rechnung
      doc.moveDown();
      doc.fontSize(16).text(`Rechnung`, { align: 'right' });
      doc.fontSize(12).text(`Rechnungsnummer: ${invoiceNumber}`, { align: 'right' });
      doc.text(`Rechnungsdatum: ${date}`, { align: 'right' });

      doc.moveDown();
      doc.text(`Kunde: ${email}`);
      doc.moveDown();

      doc.text(`Spiel: ${gameName}`);
      doc.text(`Preis: ${price} EUR`);

      doc.moveDown(2);
      doc.fontSize(10).text('Vielen Dank für deinen Einkauf bei Kiezjagd!');

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoiceBuffer };
