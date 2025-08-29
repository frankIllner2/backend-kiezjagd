// tests/TestInvoice.js
const fs = require('fs');
const path = require('path');
const { generateInvoiceBuffer } = require('../services/generateInvoice'); // <— Pfad ggf. anpassen

function save(buf, name) {
  const out = path.join(__dirname, name);
  fs.writeFileSync(out, buf);
  console.log('✅ Rechnung gespeichert:', out);
}

(async () => {
  try {
    // 1) Standard ohne Rabatt
    {
      const buf = await generateInvoiceBuffer({
        invoiceNumber: 'R-000001',
        gameName: 'Feen-Ausbildung (Mini)',
        price: 4.00,
        email: 'kunde@example.com',
        date: '2025-08-12',
      });
      save(buf, 'Rechnung-standard.pdf');
    }

    // 2) Prozent-Rabatt (z. B. 100%)
    {
      const buf = await generateInvoiceBuffer({
        invoiceNumber: 'R-000002',
        gameName: 'Feen-Ausbildung (Mini)',
        price: 10.00,
        email: 'kunde@example.com',
        date: '2025-08-12',
        discountLabel: 'Gutschein',
        discountCode: 'ABC123',
        percentOff: 100,
        discountAmount: 10.00, // EUR (für Anzeige in der Zeile)
        total: 0.00,           // Endsumme
      });
      save(buf, 'Rechnung-rabatt-prozent-100.pdf');
    }

    // 3) Fester Betrag (amount_off), z. B. 3,00 € Rabatt auf 10 €
    {
      const buf = await generateInvoiceBuffer({
        invoiceNumber: 'R-000003',
        gameName: 'Feen-Ausbildung (Mini)',
        price: 10.00,
        email: 'kunde@example.com',
        date: '2025-08-12',
        discountLabel: 'Gutschein',
        discountCode: 'FIX3',
        discountAmount: 3.00,  // EUR
        // kein total übergeben → wird intern = price - discountAmount gerechnet
      });
      save(buf, 'Rechnung-rabatt-betrag-3eur.pdf');
    }

    // 4) Teil-Rabatt mit übergebenem total (z. B. Stripe total)
    {
      const buf = await generateInvoiceBuffer({
        invoiceNumber: 'R-000004',
        gameName: 'Feen-Ausbildung (Medi)',
        price: 15.00,
        email: 'kunde@example.com',
        date: '2025-08-12',
        discountLabel: 'Promo',
        discountCode: 'SUMMER25',
        percentOff: 25,
        discountAmount: 3.75,  // 25% auf 15 €
        total: 11.25,          // explizit setzen (wie von Stripe geliefert)
      });
      save(buf, 'Rechnung-rabatt-prozent-25.pdf');
    }

    // 5) Langer Rechnungsnummern-Test (Umbruch verhindern)
    {
      const buf = await generateInvoiceBuffer({
        invoiceNumber: 'R-1234567890-XYZ-2025-00004567',
        gameName: 'Feen-Ausbildung (Maxi)',
        price: 19.90,
        email: 'kunde@example.com',
        date: new Date(),
      });
      save(buf, 'Rechnung-lange-nummer.pdf');
    }

  } catch (err) {
    console.error('❌ Fehler beim Generieren:', err);
    process.exit(1);
  }
})();
