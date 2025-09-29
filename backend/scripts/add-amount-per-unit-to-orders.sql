-- Add amount_per_unit column to orders table for custom size orders
-- This allows custom material consumption calculations for custom-sized products

-- Add amount_per_unit column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS amount_per_unit DECIMAL(18,6);

-- Add comment to document the column
COMMENT ON COLUMN orders.amount_per_unit IS 'Custom amount of raw material per unit for custom size orders. If NULL, uses product default amount_per_unit.';

-- Update existing orders to use product default amount_per_unit
UPDATE orders 
SET amount_per_unit = p.amount_per_unit
FROM products p 
WHERE orders.product_id = p.product_id 
AND orders.amount_per_unit IS NULL;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name = 'amount_per_unit';

-- Show sample data
SELECT 
    o.order_id,
    o.is_custom_size,
    o.amount_per_unit as order_amount_per_unit,
    p.amount_per_unit as product_amount_per_unit,
    p.name as product_name
FROM orders o
JOIN products p ON o.product_id = p.product_id
ORDER BY o.order_id DESC
LIMIT 5;
