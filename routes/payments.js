const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        p.*,
        i.invoice_no, i.total_amount as invoice_total,
        c.name as customer_name
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      JOIN customers c ON c.id = i.customer_id
      ORDER BY p.payment_date DESC, p.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { invoice_id, amount, payment_date, payment_mode, reference_no, notes } = req.body;
    if (!invoice_id || !amount) return res.status(400).json({ error: 'Invoice and amount required' });

    const result = await db.query(`
      INSERT INTO payments (invoice_id, amount, payment_date, payment_mode, reference_no, notes)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [invoice_id, parseFloat(amount), payment_date, payment_mode || 'Cash', reference_no || '', notes || '']);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

module.exports = router;
