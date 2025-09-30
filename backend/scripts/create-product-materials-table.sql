-- Create join table for product to multiple raw materials
CREATE TABLE IF NOT EXISTS product_materials (
  product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES raw_materials(material_id),
  amount_per_unit NUMERIC NOT NULL CHECK (amount_per_unit > 0),
  PRIMARY KEY (product_id, material_id)
);

-- Helpful index for lookups by material
CREATE INDEX IF NOT EXISTS idx_product_materials_material ON product_materials(material_id);


