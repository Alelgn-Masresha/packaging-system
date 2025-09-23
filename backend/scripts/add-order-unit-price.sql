-- Add order_unit_price column to orders table
-- This stores the unit price at the time of ordering, which may differ from current product base_price

-- Connect to the database
\c db_packaging;

-- Add the order_unit_price column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_unit_price NUMERIC(10,2);

-- Update existing orders to use the product's base_price as their order_unit_price
UPDATE orders 
SET order_unit_price = p.base_price 
FROM products p 
WHERE orders.product_id = p.product_id 
AND orders.order_unit_price IS NULL;

-- Make the column NOT NULL for future orders
ALTER TABLE orders ALTER COLUMN order_unit_price SET NOT NULL;

-- Add a comment to explain the column purpose
COMMENT ON COLUMN orders.order_unit_price IS 'Unit price at the time of ordering, stored separately from product base_price';
