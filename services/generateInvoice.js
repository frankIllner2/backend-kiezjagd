const PDFDocument = require('pdfkit');
const fs = require('fs');

function generateInvoiceBuffer({ invoiceNumber, gameName, price, email, date }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];
    const logoUrl =  `${process.env.FRONTEND_URL}/logo-email.png`;

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // Header
    doc
      .image(logoUrl, 50, 45, { width: 100 })
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
  });
}

module.exports = { generateInvoiceBuffer };
