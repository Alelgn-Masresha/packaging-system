-- Add order_from_stock column to order_products table
-- This column indicates whether the order should subtract from product stock instead of raw materials

-- Add the column if it doesn't exist
ALTER TABLE order_products 
ADD COLUMN IF NOT EXISTS order_from_stock BOOLEAN DEFAULT FALSE;

-- Add a comment to explain the column
COMMENT ON COLUMN order_products.order_from_stock IS 'Indicates whether this order item should subtract from product stock instead of consuming raw materials';

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_order_products_order_from_stock ON order_products(order_from_stock);

-- Update existing records to have the default value
UPDATE order_products 
SET order_from_stock = FALSE 
WHERE order_from_stock IS NULL;
