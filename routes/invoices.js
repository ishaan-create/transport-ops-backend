const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        i.*,
        c.name as customer_name, c.company as customer_company, c.phone as customer_phone, c.address as customer_address,
        COALESCE(SUM(p.amount), 0) as paid_amount,
        i.total_amount - COALESCE(SUM(p.amount), 0) as balance_due
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      LEFT JOIN payments p ON p.invoice_id = i.id
      GROUP BY i.id, c.id
      ORDER BY i.invoice_date DESC, i.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Manual invoice creation
router.post('/', auth, async (req, res) => {
  try {
    const { customer_id, invoice_date, amount, gst_rate, notes } = req.body;
    if (!customer_id || !amount) return res.status(400).json({ error: 'Customer and amount required' });

    const seqRes = await db.query("SELECT nextval('invoice_seq') as seq");
    const invNo = 'INV-' + String(seqRes.rows[0].seq).padStart(4, '0');

    const rate = parseFloat(gst_rate) || 0.18;
    const amt = parseFloat(amount);
    const gstAmount = Math.round(amt * rate * 100) / 100;
    const totalAmount = Math.round((amt + gstAmount) * 100) / 100;

    const result = await db.query(`
      INSERT INTO invoices (invoice_no, customer_id, invoice_date, amount, gst_rate, gst_amount, total_amount, notes, is_manual)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING *
    `, [invNo, customer_id, invoice_date, amt, rate, gstAmount, totalAmount, notes || '']);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

module.exports = router;
