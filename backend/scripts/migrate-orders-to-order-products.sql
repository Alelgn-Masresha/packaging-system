-- Backfill order_products from existing orders table
-- Run this AFTER creating order_products table and BEFORE dropping columns from orders

INSERT INTO order_products (order_id, product_id, quantity, order_unit_price, amount_per_unit, is_custom_size, length, width, height)
SELECT 
  order_id, 
  product_id, 
  quantity, 
  order_unit_price, 
  amount_per_unit,
  is_custom_size,
  length,
  width,
  height
FROM orders
WHERE product_id IS NOT NULL
ON CONFLICT (order_id, product_id) DO UPDATE 
  SET quantity = EXCLUDED.quantity,
      order_unit_price = EXCLUDED.order_unit_price,
      amount_per_unit = EXCLUDED.amount_per_unit,
      is_custom_size = EXCLUDED.is_custom_size,
      length = EXCLUDED.length,
      width = EXCLUDED.width,
      height = EXCLUDED.height;

-- After backfill, you can drop the old columns:
-- ALTER TABLE orders DROP COLUMN IF EXISTS product_id;
-- ALTER TABLE orders DROP COLUMN IF EXISTS quantity;
-- ALTER TABLE orders DROP COLUMN IF EXISTS order_unit_price;
-- ALTER TABLE orders DROP COLUMN IF EXISTS amount_per_unit;
-- ALTER TABLE orders DROP COLUMN IF EXISTS is_custom_size;
-- ALTER TABLE orders DROP COLUMN IF EXISTS length;
-- ALTER TABLE orders DROP COLUMN IF EXISTS width;
-- ALTER TABLE orders DROP COLUMN IF EXISTS height;

