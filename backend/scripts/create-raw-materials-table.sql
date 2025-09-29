-- Create raw_materials table for STEP Packaging & Printing System
-- This table stores information about raw materials used in packaging production

CREATE TABLE IF NOT EXISTS raw_materials (
    material_id SERIAL PRIMARY KEY,
    material_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit VARCHAR(50) NOT NULL,
    min_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Available' CHECK (status IN ('Available', 'Low Stock', 'Out of Stock')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create an index on material_name for faster searches
CREATE INDEX IF NOT EXISTS idx_raw_materials_name ON raw_materials(material_name);

-- Create an index on category for filtering
CREATE INDEX IF NOT EXISTS idx_raw_materials_category ON raw_materials(category);

-- Create an index on status for quick status filtering
CREATE INDEX IF NOT EXISTS idx_raw_materials_status ON raw_materials(status);

-- Add a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_raw_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_raw_materials_updated_at
    BEFORE UPDATE ON raw_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_raw_materials_updated_at();

-- Add a trigger to automatically set status based on stock levels
CREATE OR REPLACE FUNCTION update_raw_materials_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update status based on current stock vs minimum stock
    IF NEW.current_stock <= 0 THEN
        NEW.status = 'Out of Stock';
    ELSIF NEW.current_stock <= NEW.min_stock THEN
        NEW.status = 'Low Stock';
    ELSE
        NEW.status = 'Available';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_raw_materials_status_trigger
    BEFORE INSERT OR UPDATE ON raw_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_raw_materials_status();

-- Insert sample raw materials data
INSERT INTO raw_materials (material_name, description, category, current_stock, unit, min_stock) VALUES
('Tissue Paper', 'Premium Quality', 'Paper', 1250.00, 'Units', 500.00),
('A4 Paper', '80gsm White', 'Paper', 85.00, 'Rims', 100.00),
('Transparent Plastic', '0.5mm thickness', 'Plastic', 45.70, 'Kg', 20.00),
('Cardboard Sheets', 'Heavy duty cardboard', 'Paper', 200.00, 'Sheets', 50.00),
('Adhesive Tape', 'Clear packing tape', 'Adhesive', 150.00, 'Rolls', 30.00),
('Bubble Wrap', 'Protective packaging', 'Protection', 75.50, 'Meters', 25.00),
('Ink Cartridge', 'Black ink for printing', 'Ink', 12.00, 'Units', 5.00),
('Staples', 'Office staples', 'Fasteners', 5000.00, 'Pieces', 1000.00);

-- Verify the table creation and data insertion
SELECT 'Raw Materials Table Created Successfully' as status;
SELECT COUNT(*) as total_materials FROM raw_materials;
SELECT material_name, category, current_stock, unit, min_stock, status FROM raw_materials ORDER BY material_id;
