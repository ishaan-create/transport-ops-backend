const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.*, d.name as driver_name
      FROM trucks t
      LEFT JOIN drivers d ON d.id = t.driver_id
      ORDER BY t.vehicle_no
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trucks' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { vehicle_no, type, capacity, status, last_service, notes } = req.body;
    if (!vehicle_no) return res.status(400).json({ error: 'Vehicle number required' });
    const result = await db.query(
      'INSERT INTO trucks (vehicle_no, type, capacity, status, last_service, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [vehicle_no.toUpperCase(), type || 'Medium', capacity || 0, status || 'available', last_service || null, notes || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Vehicle number already exists' });
    res.status(500).json({ error: 'Failed to create truck' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { vehicle_no, type, capacity, driver_id, status, last_service, notes } = req.body;
    const result = await db.query(
      'UPDATE trucks SET vehicle_no=$1, type=$2, capacity=$3, driver_id=$4, status=$5, last_service=$6, notes=$7 WHERE id=$8 RETURNING *',
      [vehicle_no?.toUpperCase(), type, capacity, driver_id || null, status, last_service || null, notes || '', req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update truck' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM trucks WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete truck' });
  }
});

module.exports = router;
