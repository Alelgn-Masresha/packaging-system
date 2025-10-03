-- Add stock_quantity column to products table
-- Ensures non-negative integer values with default 0

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0);


