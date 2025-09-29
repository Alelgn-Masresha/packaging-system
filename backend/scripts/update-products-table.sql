-- Update products table to include raw material and unit fields
-- This script adds raw_material_id and unit columns to the existing products table

-- Add raw_material_id column (foreign key to raw_materials table)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS raw_material_id INTEGER REFERENCES raw_materials(material_id);

-- Add unit column
-- Replace unit with amount_per_unit (numeric quantity of raw material needed per product)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS amount_per_unit DECIMAL(18,6);

-- Ensure precision is 6 decimal places if the column already existed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'amount_per_unit'
  ) THEN
    BEGIN
      ALTER TABLE products 
      ALTER COLUMN amount_per_unit TYPE DECIMAL(18,6);
    EXCEPTION WHEN others THEN
      -- ignore if already correct type
      NULL;
    END;
  END IF;
END$$;

-- Add index on raw_material_id for better performance
CREATE INDEX IF NOT EXISTS idx_products_raw_material_id ON products(raw_material_id);

-- Update existing products with default values (optional)
-- You can modify these values based on your existing data
-- Optional backfill: if you previously stored unit text, you can drop it later
-- UPDATE products SET amount_per_unit = 1 WHERE amount_per_unit IS NULL;

-- Add a comment to document the changes
COMMENT ON COLUMN products.raw_material_id IS 'Foreign key reference to raw_materials table';
COMMENT ON COLUMN products.amount_per_unit IS 'Quantity of raw material required to produce one unit of product';

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'products' 
ORDER BY ordinal_position;
