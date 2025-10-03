-- Create join table for orders with multiple products
CREATE TABLE IF NOT EXISTS order_products (
  order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(product_id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  order_unit_price NUMERIC NOT NULL CHECK (order_unit_price > 0),
  amount_per_unit NUMERIC,
  is_custom_size BOOLEAN DEFAULT FALSE,
  length NUMERIC,
  width NUMERIC,
  height NUMERIC,
  PRIMARY KEY (order_id, product_id)
);

-- Index for lookups by product
CREATE INDEX IF NOT EXISTS idx_order_products_product ON order_products(product_id);

-- Comments
COMMENT ON TABLE order_products IS 'Junction table linking orders to multiple products with quantities, pricing, and custom sizes';
COMMENT ON COLUMN order_products.quantity IS 'Quantity of this product in the order';
COMMENT ON COLUMN order_products.order_unit_price IS 'Unit price for this product at time of order';
COMMENT ON COLUMN order_products.amount_per_unit IS 'Custom amount per unit for raw material calculation (optional, for custom sizes)';
COMMENT ON COLUMN order_products.is_custom_size IS 'Whether this product has custom dimensions';
COMMENT ON COLUMN order_products.length IS 'Custom length dimension';
COMMENT ON COLUMN order_products.width IS 'Custom width dimension';
COMMENT ON COLUMN order_products.height IS 'Custom height dimension';

