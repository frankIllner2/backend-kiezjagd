const PDFDocument = require('pdfkit');
//const path = require('path');

function generateCertificateBuffer({ team, result }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];

      //const logoPath = path.join(__dirname, '../public/logo.png'); // optional: Logo einfügen
      const logoPath = '';
      const primaryColor = '#355b4c';

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Logo
      doc.image(logoPath, 50, 40, { width: 80 });

      // Titel
      doc.fontSize(26).fillColor(primaryColor).text(result.gameType || 'Kiezjagd', 0, 120, { align: 'center' });

      // Team
      doc.fontSize(18).text(`Team: ${team.name}`, { align: 'center' });

      // Spieler:innen
      doc.moveDown();
      doc.fontSize(14).text(`Spieler:innen: ${team.players.join(', ')}`, { align: 'center' });

      // Ergebnis
      doc.moveDown();
      const stars = result.stars || 'Keine Angabe';
      doc.text(`Ergebnis: ${stars} Sterne`, { align: 'center' });

      // Glückwunschtext
      doc.moveDown();
      doc.fontSize(12).text('Herzlichen Glückwunsch!', { align: 'center' });
      doc.text('Ihr habt das Spiel erfolgreich abgeschlossen.', { align: 'center' });

      // Footer
      doc.moveDown(4);
      doc.fontSize(10).text('Kiezjagd – www.kiezjagd.de – info@kiezjagd.de', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCertificateBuffer };
