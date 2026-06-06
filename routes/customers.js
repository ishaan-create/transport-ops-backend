const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET all customers with balance
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        c.*,
        COALESCE(SUM(i.total_amount), 0) AS total_billed,
        COALESCE(SUM(p.amount), 0) AS total_paid,
        COALESCE(SUM(i.total_amount), 0) - COALESCE(SUM(p.amount), 0) AS outstanding
      FROM customers c
      LEFT JOIN invoices i ON i.customer_id = c.id
      LEFT JOIN payments p ON p.invoice_id = i.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET single customer with full history
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await db.query('SELECT * FROM customers WHERE id = $1', [id]);
    if (!customer.rows.length) return res.status(404).json({ error: 'Not found' });

    const deliveries = await db.query(
      'SELECT d.*, t.vehicle_no, dr.name as driver_name FROM deliveries d LEFT JOIN trucks t ON t.id = d.truck_id LEFT JOIN drivers dr ON dr.id = d.driver_id WHERE d.customer_id = $1 ORDER BY d.delivery_date DESC',
      [id]
    );
    const invoices = await db.query(
      'SELECT * FROM invoices WHERE customer_id = $1 ORDER BY invoice_date DESC', [id]
    );
    const payments = await db.query(
      'SELECT p.*, i.invoice_no FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.customer_id = $1 ORDER BY p.payment_date DESC',
      [id]
    );

    res.json({
      ...customer.rows[0],
      deliveries: deliveries.rows,
      invoices: invoices.rows,
      payments: payments.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// POST create customer
router.post('/', auth, async (req, res) => {
  try {
    const { name, company, phone, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await db.query(
      'INSERT INTO customers (name, company, phone, address) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, company || '', phone || '', address || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT update customer
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, company, phone, address } = req.body;
    const result = await db.query(
      'UPDATE customers SET name=$1, company=$2, phone=$3, address=$4 WHERE id=$5 RETURNING *',
      [name, company, phone, address, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// DELETE customer
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

module.exports = router;
