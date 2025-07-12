const PDFDocument = require('pdfkit');
const path = require('path');

function generateCertificateBuffer({ team, result }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];

      const logoPath = path.join(__dirname, '../public/logo.png');
      const girlPath = path.join(__dirname, '../public/girl4.png');
      const boyPath = path.join(__dirname, '../public/junge.png');
      const starPath = path.join(__dirname, '../public/star.png');
      const primaryColor = '#355b4c';

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Logo oben zentriert
      const logoWidth = 250;
      const logoHeight = 150;
      const logoTop = 20;
      doc.image(logoPath, doc.page.width / 2 - logoWidth / 2, logoTop, { width: logoWidth });

      // Nach dem Logo gezielt Platz lassen
      doc.y = logoTop + logoHeight + 10;
      doc.fillColor(primaryColor);

      // Titel
      doc.fontSize(36).text('URKUNDE', { align: 'center' });

      // Team
      doc.moveDown();
      doc.fontSize(18).text('Herzlichen Glückwunsch an das Team', { align: 'center' });
      doc.fontSize(24).text(team.name, { align: 'center' });

      // Spieler:innen
      doc.moveDown();
      doc.fontSize(14).text('mit den mutigen Abenteurer:innen:', { align: 'center' });
      doc.fontSize(14).text(team.players.join(', '), { align: 'center' });

      // Dynamischer Text (Du/Ihr habt ...)
      const isSingle = team.players.length === 1;
      const pronoun = isSingle ? 'Du hast' : 'Ihr habt';
      const ending = 'gemeistert';

      doc.moveDown();
      doc.fontSize(14).text(`${pronoun} das spannende Abenteuer`, { align: 'center' });
      doc.fontSize(16).text(`„${result.gameType || 'Kiezjagd'}“`, { align: 'center' });
      doc.fontSize(14).text(`mit Bravour ${ending}`, { align: 'center' });

      // Zeit oder Sterne anzeigen
      const isMaxiGame = result.gameType?.toLowerCase().includes('maxi');

      if (isMaxiGame && result.time) {
        doc.moveDown();
        doc.fontSize(14).text('und dabei eine tolle Zeit erreicht:', { align: 'center' });
        doc.fontSize(16).text(result.time, { align: 'center' });
      } else {
        const starCount = result.stars || 0;

        doc.moveDown();
        doc.fontSize(14).text(`und dabei ${starCount} von 3 Sternen gesammelt!`, { align: 'center' });

        // Sterne als Bild
        const starSize = 15;
        const totalWidth = starCount * (starSize + 5) - 5;
        const startX = (doc.page.width - totalWidth) / 2;
        const starY = doc.y + 10;

        for (let i = 0; i < starCount; i++) {
          try {
            doc.image(starPath, startX + i * (starSize + 5), starY, {
              width: starSize,
              height: starSize,
            });
          } catch (e) {
            console.warn('⚠️ Fehler beim Laden von star.png:', e.message);
          }
        }

        doc.moveDown(5);
      }

      doc.moveDown(2);
      doc.fontSize(12).text('Wir sind stolz auf euch – weiter so!', { align: 'center' });

      doc.moveDown(2);
      doc.fontSize(12).text('Euer Kiezjagd-Team', { align: 'center' });

      // Strichfiguren
      const imageY = doc.y + 20;
      const imageHeight = 80;

      try {
        doc.image(girlPath, 80, imageY, { height: imageHeight });
      } catch (e) {
        console.warn('⚠️ Fehler bei girl.png:', e.message);
      }

      try {
        doc.image(boyPath, doc.page.width - 80 - imageHeight * 0.75, imageY, { height: imageHeight });
      } catch (e) {
        console.warn('⚠️ Fehler bei junge.png:', e.message);
      }

      doc.moveDown(6);

      // Datum & Footer
      const date = new Date().toLocaleDateString('de-DE');
      doc.fontSize(10).text(`Berlin, ${date}`, { align: 'center' });

      doc.moveDown(2);
      doc.fontSize(10).fillColor('gray').text('Kiezjagd – www.kiezjagd.de – info@kiezjagd.de', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCertificateBuffer };
