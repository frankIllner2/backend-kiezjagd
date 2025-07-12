const fs = require('fs');
const { generateCertificateBuffer } = require('../utils/generateCertificateBuffer');

const team = {
  name: 'Die wilden Rätselknacker',
  players: ['Lina', 'Ben', 'Mira']
};

const result = {
  gameType: 'Reise zum Märchenbrunnen',
  stars: 20
};

generateCertificateBuffer({ team, result })
  .then((buffer) => {
    fs.writeFileSync('urkunde.pdf', buffer);
    console.log('✅ Urkunde erfolgreich generiert: urkunde.pdf');
  })
  .catch(console.error);
