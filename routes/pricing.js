const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Get global rate and all per-customer rates
router.get('/', auth, async (req, res) => {
  try {
    const global = await db.query(
      'SELECT * FROM pricing_rates WHERE is_global = true LIMIT 1'
    );
    const custom = await db.query(`
      SELECT pr.*, c.name as customer_name
      FROM pricing_rates pr
      JOIN customers c ON c.id = pr.customer_id
      WHERE pr.is_global = false
      ORDER BY c.name
    `);
    res.json({
      global_rate: global.rows[0]?.rate_per_tonne_km || 10,
      custom_rates: custom.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

// Update global rate
router.put('/global', auth, async (req, res) => {
  try {
    const { rate } = req.body;
    if (!rate || isNaN(rate)) return res.status(400).json({ error: 'Valid rate required' });
    
    await db.query(`
      INSERT INTO pricing_rates (is_global, rate_per_tonne_km)
      VALUES (true, $1)
      ON CONFLICT DO NOTHING
    `, [rate]);

    await db.query(
      'UPDATE pricing_rates SET rate_per_tonne_km = $1 WHERE is_global = true',
      [rate]
    );

    res.json({ success: true, rate });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update rate' });
  }
});

// Set per-customer rate
router.post('/customer', auth, async (req, res) => {
  try {
    const { customer_id, rate, notes } = req.body;
    if (!customer_id || !rate) return res.status(400).json({ error: 'Customer and rate required' });

    // Upsert
    const existing = await db.query(
      'SELECT id FROM pricing_rates WHERE customer_id = $1 AND is_global = false',
      [customer_id]
    );
    if (existing.rows.length) {
      await db.query(
        'UPDATE pricing_rates SET rate_per_tonne_km=$1, notes=$2 WHERE customer_id=$3',
        [rate, notes||'', customer_id]
      );
    } else {
      await db.query(
        'INSERT INTO pricing_rates (customer_id, rate_per_tonne_km, is_global, notes) VALUES ($1,$2,false,$3)',
        [customer_id, rate, notes||'']
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set customer rate' });
  }
});

// Get rate for a specific customer (falls back to global)
router.get('/for/:customer_id', auth, async (req, res) => {
  try {
    const custom = await db.query(
      'SELECT rate_per_tonne_km FROM pricing_rates WHERE customer_id=$1 AND is_global=false',
      [req.params.customer_id]
    );
    if (custom.rows.length) {
      return res.json({ rate: custom.rows[0].rate_per_tonne_km, type: 'custom' });
    }
    const global = await db.query(
      'SELECT rate_per_tonne_km FROM pricing_rates WHERE is_global=true LIMIT 1'
    );
    res.json({ rate: global.rows[0]?.rate_per_tonne_km || 10, type: 'global' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get rate' });
  }
});

module.exports = router;
