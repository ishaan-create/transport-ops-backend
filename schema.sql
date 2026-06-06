-- Transport Operations Management System
-- Run this once to set up your database

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  company VARCHAR(200),
  phone VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  license VARCHAR(100),
  license_expiry DATE,
  truck_id INTEGER,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available','on-trip','off-duty')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Trucks
CREATE TABLE IF NOT EXISTS trucks (
  id SERIAL PRIMARY KEY,
  vehicle_no VARCHAR(20) NOT NULL UNIQUE,
  type VARCHAR(50),
  capacity DECIMAL(8,2),
  driver_id INTEGER,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available','on-trip','maintenance')),
  last_service DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Pricing rates (per customer or global)
CREATE TABLE IF NOT EXISTS pricing_rates (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  rate_per_tonne_km DECIMAL(10,2) NOT NULL DEFAULT 10,
  is_global BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default global rate
INSERT INTO pricing_rates (is_global, rate_per_tonne_km, notes)
VALUES (true, 10, 'Default global rate - update as needed')
ON CONFLICT DO NOTHING;

-- Deliveries
CREATE TABLE IF NOT EXISTS deliveries (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  pickup_location VARCHAR(300),
  drop_location VARCHAR(300),
  truck_id INTEGER REFERENCES trucks(id),
  driver_id INTEGER REFERENCES drivers(id),
  weight_tonnes DECIMAL(10,2),
  distance_km DECIMAL(10,2),
  rate_used DECIMAL(10,2),
  base_price DECIMAL(12,2),
  confirmed_price DECIMAL(12,2),
  delivery_date DATE,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','in-transit','delivered','cancelled')),
  invoice_created BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_no VARCHAR(50) UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  delivery_id INTEGER REFERENCES deliveries(id),
  invoice_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  gst_rate DECIMAL(5,4) DEFAULT 0.18,
  gst_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  notes TEXT,
  is_manual BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_mode VARCHAR(20) CHECK (payment_mode IN ('Cash','NEFT','UPI','Cheque')),
  reference_no VARCHAR(200),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Invoice sequence counter
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deliveries_customer ON deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
