const PDFDocument = require('pdfkit');
const path = require('path');

function generateCertificateBuffer({ team, result }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Assets
      const frank    = path.join(__dirname, '../public/frank.png');
      const frida    = path.join(__dirname, '../public/frida.png');
      const fritz    = path.join(__dirname, '../public/fritz.png');
      const julia    = path.join(__dirname, '../public/julia.png');
      const headline = path.join(__dirname, '../public/headline-urkunde.png');
      const starPng  = path.join(__dirname, '../public/star.png');

      // Farben & Maße
      const primary = '#355b4c';
      const cardBg  = '#f3ecd6';
      const textCol = primary;
      const pageW   = doc.page.width;
      const pageH   = doc.page.height;

      // Hintergrund
      doc.save().rect(0, 0, pageW, pageH).fill(primary).restore();

      // Karte
      const cardMargin = 40;
      const cardR = 20;
      const cardX = cardMargin;
      const cardY = cardMargin;
      const cardW = pageW - cardMargin * 2;
      const cardH = pageH - cardMargin * 2;
      const centerX = cardX + cardW / 2;

      doc.save().roundedRect(cardX, cardY, cardW, cardH, cardR).fill(cardBg).restore();
      doc.save().lineWidth(1.5).strokeColor('#e5dcc3')
        .roundedRect(cardX, cardY, cardW, cardH, cardR).stroke().restore();

      // === Helper: Figuren-Reihe gleichmäßig verteilen (Zentren)
      // Gleichmäßige Verteilung einer Figuren-Reihe (ohne externe Abhängigkeiten)
      const placeFiguresRow = (images, y, targetH) => {
        const n = images.length;
        if (n === 0) return;
        const gap = cardW / (n + 1); // gleiche Abstände inkl. Rand

        for (let i = 0; i < n; i++) {
          const imgPath = images[i];
          try {
            // Bild öffnen -> Originalmaße lesen
            const img = doc.openImage(imgPath);     // <- PDFKit liefert width/height
            const scale = targetH / img.height;
            const w = img.width * scale;

            const cx = cardX + gap * (i + 1);       // Slot-Zentrum
            const x  = cx - w / 2;                   // zentriert um das Slot-Zentrum

            doc.image(img, x, y, { height: targetH });
          } catch (e) {
            console.warn('⚠️ Figur konnte nicht platziert werden:', imgPath, e.message);
          }
        }
      };


      // Figuren OBEN: Kopf am Rahmen (einheitliche Höhe)
      const inset = 6;
      const topFigH = 80;
      const topY = cardY + inset;
      placeFiguresRow([frank, frida, fritz, julia], topY, topFigH);

      // Cursor unter den oberen Figuren
     const contentOffset = 40; // hier stellst du den Extra-Abstand ein
    let cursorY = topY + topFigH + 18 + contentOffset

      // Überschrift als Bild
      try {
        const imgW = 300, imgH = 80;
        doc.image(headline, centerX - imgW/2, cursorY, { width: imgW, height: imgH });
        cursorY += imgH + 60;
      } catch (e) {
        console.warn('headline-urkunde.png:', e.message);
      }

      // Textblöcke
      doc.fillColor(textCol);
      doc.fontSize(14).text('Dein Team', cardX, cursorY, { width: cardW, align: 'center' });
      cursorY += 36;

      doc.fontSize(26).text(team.name, cardX, cursorY, { width: cardW, align: 'center' });
      cursorY += 36;

      doc.fontSize(16).text('hat das spannende Abenteuer', cardX, cursorY, { width: cardW, align: 'center' });
      cursorY += 36;

      const gameTitle = result.gameTitle || result.gameType || 'Kiezjagd';
      doc.fontSize(26).text(gameTitle, cardX, cursorY, { width: cardW, align: 'center' });
      cursorY += 36;

      doc.fontSize(16).text('mit Mut und Köpfchen gemeistert', cardX, cursorY, { width: cardW, align: 'center' });
      cursorY += 24;

      // Anzeige je Typ
      const type = (result.gameType || '').toLowerCase();
      const isMaxi = type.includes('maxi');
      const isMiniOrMedi = type.includes('mini') || type.includes('medi');
      const starCount = Number(result.stars || result.starCount || 0);

      if (isMaxi) {
        // Text für MAXI
        doc.fontSize(16).text(
          'und dabei eine tolle Zeit erreicht:',
          cardX,
          cursorY,
          { width: cardW, align: 'center' }
        );
        cursorY += 32;

        const duration = result.duration || '—';
        doc.fontSize(28).text(duration, cardX, cursorY, { width: cardW, align: 'center' });
        cursorY += 80;

      } else if (isMiniOrMedi) {
        // Text für MINI / MEDI
        doc.fontSize(16).text(
          'und dabei so viele Sterne gesammelt:',
          cardX,
          cursorY,
          { width: cardW, align: 'center' }
        );
        cursorY += 32;

        // Zahl + EIN Stern
        const numText = String(starCount);
        doc.fontSize(24);
        const numW = doc.widthOfString(numText);
        const numX = centerX - numW / 2;
        const numY = cursorY;

        doc.text(numText, numX, numY, { width: numW, align: 'left' });
        try {
          const gap = 20;
          const starH = 20;
          doc.image(starPng, numX + numW + gap - 14, numY - 6, { height: starH });

        } catch {}

        cursorY += 100;

      } else {
        // Fallback
        doc.fontSize(16).text(
          'und dabei Sterne gesammelt:',
          cardX,
          cursorY,
          { width: cardW, align: 'center' }
        );
        cursorY += 32;

        const numText = String(starCount);
        doc.fontSize(44);
        const numW = doc.widthOfString(numText);
        const numX = centerX - numW / 2;
        const numY = cursorY;

        doc.text(numText, numX, numY, { width: numW });
        try { doc.image(starPng, numX + numW + 10, numY - 6, { height: 40 }); } catch {}

        cursorY += 100;
      }

      doc.fontSize(16).text('Was für eine tolle Leistung!', cardX, cursorY, { width: cardW, align: 'center' });
      cursorY += 28;

      // Figuren UNTEN: Füße am Rahmen (gleiche Verteilung, gleiche Höhe)
      const bottomFigH = 90;
      const bottomY = cardY + cardH - inset - bottomFigH;
      placeFiguresRow([frida, julia, frank, fritz], bottomY, bottomFigH);

      // Footer
      doc.fontSize(12).fillColor(cardBg)
        .text('www.kiezjagd.de', cardX, cardY + cardH + 15, { width: cardW, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCertificateBuffer };
