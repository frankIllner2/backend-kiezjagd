// TestmailUrkunde.js
const fs = require('fs');
const path = require('path');
const { generateCertificateBuffer } = require('./generateCertificateBuffer');

async function main() {
  // Dummy-Daten wie sie normalerweise aus DB/Result kommen
  const team = {
    name: 'Rose Rot',
    players: ['Anna', 'Ben']
  };
  const result = {
    gameType: 'Mini Abenteuer',
    gameTitle: 'Feen-Ausbildung',
    stars: 44,
    email: 'test@example.com'
  };

  // PDF generieren
  const buffer = await generateCertificateBuffer({ team, result });

  // lokal abspeichern
  const filePath = path.join(__dirname, `Urkunde-${team.name}.pdf`);
  fs.writeFileSync(filePath, buffer);
  console.log('✅ Test-Urkunde gespeichert:', filePath);
}

main().catch(console.error);
