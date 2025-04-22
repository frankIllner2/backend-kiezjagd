const Counter = require('../models/Counter');

async function generateInvoiceNumber() {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, ''); // z. B. 20250422

  const counter = await Counter.findOneAndUpdate(
    { name: `invoice-${datePart}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );

  const number = counter.seq.toString().padStart(4, '0');
  return `R-${datePart}-${number}`; // z. B. R-20250422-0001
}

module.exports = { generateInvoiceNumber };
