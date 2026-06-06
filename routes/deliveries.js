const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        d.*,
        c.name as customer_name, c.company as customer_company,
        t.vehicle_no,
        dr.name as driver_name
      FROM deliveries d
      LEFT JOIN customers c ON c.id = d.customer_id
      LEFT JOIN trucks t ON t.id = d.truck_id
      LEFT JOIN drivers dr ON dr.id = d.driver_id
      ORDER BY d.delivery_date DESC, d.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deliveries' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const {
      customer_id, pickup_location, drop_location,
      truck_id, driver_id, weight_tonnes, distance_km,
      rate_used, base_price, confirmed_price,
      delivery_date, status, notes
    } = req.body;

    if (!customer_id || !confirmed_price || !delivery_date)
      return res.status(400).json({ error: 'Customer, price and date are required' });

    const result = await db.query(`
      INSERT INTO deliveries 
        (customer_id, pickup_location, drop_location, truck_id, driver_id, 
         weight_tonnes, distance_km, rate_used, base_price, confirmed_price,
         delivery_date, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      customer_id, pickup_location || '', drop_location || '',
      truck_id || null, driver_id || null,
      weight_tonnes || 0, distance_km || 0,
      rate_used || 0, base_price || 0, confirmed_price,
      delivery_date, status || 'scheduled', notes || ''
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create delivery' });
  }
});

// Mark as delivered — auto-creates invoice
router.put('/:id/deliver', auth, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    const delRes = await client.query('SELECT * FROM deliveries WHERE id = $1', [id]);
    if (!delRes.rows.length) throw new Error('Delivery not found');
    const delivery = delRes.rows[0];

    // Update delivery status
    await client.query(
      'UPDATE deliveries SET status=$1, invoice_created=$2 WHERE id=$3',
      ['delivered', true, id]
    );

    // Generate invoice number
    const seqRes = await client.query("SELECT nextval('invoice_seq') as seq");
    const invNo = 'INV-' + String(seqRes.rows[0].seq).padStart(4, '0');

    const amount = parseFloat(delivery.confirmed_price);
    const gstRate = 0.18;
    const gstAmount = Math.round(amount * gstRate * 100) / 100;
    const totalAmount = Math.round((amount + gstAmount) * 100) / 100;

    const invResult = await client.query(`
      INSERT INTO invoices (invoice_no, customer_id, delivery_id, invoice_date, amount, gst_rate, gst_amount, total_amount, is_manual)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)
      RETURNING *
    `, [invNo, delivery.customer_id, id, delivery.delivery_date, amount, gstRate, gstAmount, totalAmount]);

    await client.query('COMMIT');
    res.json({ delivery: { ...delivery, status: 'delivered' }, invoice: invResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to mark delivered' });
  } finally {
    client.release();
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const {
      customer_id, pickup_location, drop_location,
      truck_id, driver_id, weight_tonnes, distance_km,
      rate_used, base_price, confirmed_price,
      delivery_date, status, notes
    } = req.body;
    const result = await db.query(`
      UPDATE deliveries SET
        customer_id=$1, pickup_location=$2, drop_location=$3,
        truck_id=$4, driver_id=$5, weight_tonnes=$6, distance_km=$7,
        rate_used=$8, base_price=$9, confirmed_price=$10,
        delivery_date=$11, status=$12, notes=$13
      WHERE id=$14 RETURNING *
    `, [customer_id, pickup_location, drop_location, truck_id||null, driver_id||null,
        weight_tonnes||0, distance_km||0, rate_used||0, base_price||0, confirmed_price,
        delivery_date, status, notes||'', req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update delivery' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM deliveries WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete delivery' });
  }
});

module.exports = router;
