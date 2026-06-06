const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const [todayDeliveries, fleetStatus, overdueCustomers, expiringLicenses] = await Promise.all([
      db.query(`
        SELECT d.*, c.name as customer_name, t.vehicle_no
        FROM deliveries d
        LEFT JOIN customers c ON c.id = d.customer_id
        LEFT JOIN trucks t ON t.id = d.truck_id
        WHERE d.delivery_date = $1 AND d.status != 'cancelled'
        ORDER BY d.id
      `, [today]),

      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'available') as available,
          COUNT(*) FILTER (WHERE status = 'on-trip') as on_trip,
          COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
          COUNT(*) as total
        FROM trucks
      `),

      db.query(`
        SELECT c.id, c.name, c.company,
          COALESCE(SUM(i.total_amount),0) - COALESCE(SUM(p.amount),0) as outstanding
        FROM customers c
        LEFT JOIN invoices i ON i.customer_id = c.id
        LEFT JOIN payments p ON p.invoice_id = i.id
        GROUP BY c.id
        HAVING COALESCE(SUM(i.total_amount),0) - COALESCE(SUM(p.amount),0) > 0
        ORDER BY outstanding DESC
        LIMIT 6
      `),

      db.query(`
        SELECT * FROM drivers
        WHERE license_expiry BETWEEN $1 AND $2
        ORDER BY license_expiry
      `, [today, new Date(Date.now() + 60*24*60*60*1000).toISOString().split('T')[0]])
    ]);

    const totals = await db.query(`
      SELECT 
        COUNT(DISTINCT c.id) as total_customers,
        COUNT(DISTINCT dr.id) as total_drivers,
        COUNT(DISTINCT t.id) as total_trucks,
        COALESCE(SUM(i.total_amount),0) - COALESCE(SUM(p.amount),0) as total_outstanding
      FROM customers c
      CROSS JOIN (SELECT COUNT(*) as cnt FROM drivers) dr
      CROSS JOIN (SELECT COUNT(*) as cnt FROM trucks) t
      LEFT JOIN invoices i ON i.customer_id = c.id
      LEFT JOIN payments p ON p.invoice_id = i.id
    `);

    res.json({
      today_deliveries: todayDeliveries.rows,
      fleet: fleetStatus.rows[0],
      overdue_customers: overdueCustomers.rows,
      expiring_licenses: expiringLicenses.rows,
      totals: totals.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

module.exports = router;
