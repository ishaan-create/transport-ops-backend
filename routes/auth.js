const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Single admin login - credentials from env
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@transport.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Transport@2024';

    if (email !== adminEmail)
      return res.status(401).json({ error: 'Invalid credentials' });

    // Support both plain and bcrypt passwords
    let valid = false;
    if (adminPassword.startsWith('$2')) {
      valid = await bcrypt.compare(password, adminPassword);
    } else {
      valid = password === adminPassword;
    }

    if (!valid)
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, email, role: 'admin' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
