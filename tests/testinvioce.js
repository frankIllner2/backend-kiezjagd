// tests/TestInvoice.js
const fs = require('fs');
const path = require('path');
const { generateInvoiceBuffer } = require('../services/generateInvoice');

(async () => {
  try {
    const buf = await generateInvoiceBuffer({
      invoiceNumber: 'R-12345332-04',
      gameName: 'Feen-Ausbildung (Mini)',
      price: 4.00,
      email: 'kunde@example.com',
      date: '2025-08-12',
    });

    const out = path.join(__dirname, 'Rechnung-12345.pdf');
    fs.writeFileSync(out, buf);
    console.log('✅ Rechnung gespeichert:', out);
  } catch (err) {
    console.error('❌ Fehler beim Generieren:', err);
  }
})();
