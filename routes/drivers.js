const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT d.*, t.vehicle_no 
      FROM drivers d
      LEFT JOIN trucks t ON t.id = d.truck_id
      ORDER BY d.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, phone, license, license_expiry, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await db.query(
      'INSERT INTO drivers (name, phone, license, license_expiry, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, phone || '', license || '', license_expiry || null, status || 'available']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create driver' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, phone, license, license_expiry, truck_id, status } = req.body;
    const result = await db.query(
      'UPDATE drivers SET name=$1, phone=$2, license=$3, license_expiry=$4, truck_id=$5, status=$6 WHERE id=$7 RETURNING *',
      [name, phone, license, license_expiry || null, truck_id || null, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update driver' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM drivers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete driver' });
  }
});

module.exports = router;
