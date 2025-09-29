-- Create stock_transactions table to track raw material stock changes
-- This table provides a complete audit trail for inventory management

CREATE TABLE IF NOT EXISTS stock_transactions (
    transaction_id SERIAL PRIMARY KEY,
    material_id INTEGER NOT NULL REFERENCES raw_materials(material_id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('ADD', 'SUBTRACT', 'ADJUSTMENT')),
    quantity DECIMAL(18,6) NOT NULL,
    previous_stock DECIMAL(18,6) NOT NULL,
    new_stock DECIMAL(18,6) NOT NULL,
    reason VARCHAR(255),
    reference_type VARCHAR(50), -- 'ORDER', 'MANUAL', 'ADJUSTMENT', etc.
    reference_id INTEGER, -- ID of order, user, or other reference
    created_by VARCHAR(100), -- User who made the change
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stock_transactions_material_id ON stock_transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_type ON stock_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_created_at ON stock_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_transactions_reference ON stock_transactions(reference_type, reference_id);

-- Add trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_stock_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stock_transactions_updated_at
    BEFORE UPDATE ON stock_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_transactions_updated_at();

-- Add trigger to automatically log stock changes when raw_materials.current_stock is updated
CREATE OR REPLACE FUNCTION log_stock_change()
RETURNS TRIGGER AS $$
DECLARE
    transaction_type_val VARCHAR(20);
    quantity_change DECIMAL(18,6);
BEGIN
    -- Determine transaction type based on stock change
    IF NEW.current_stock > OLD.current_stock THEN
        transaction_type_val := 'ADD';
        quantity_change := NEW.current_stock - OLD.current_stock;
    ELSIF NEW.current_stock < OLD.current_stock THEN
        transaction_type_val := 'SUBTRACT';
        quantity_change := OLD.current_stock - NEW.current_stock;
    ELSE
        -- No change, no need to log
        RETURN NEW;
    END IF;

    -- Insert transaction record
    INSERT INTO stock_transactions (
        material_id,
        transaction_type,
        quantity,
        previous_stock,
        new_stock,
        reason,
        reference_type,
        reference_id,
        created_by
    ) VALUES (
        NEW.material_id,
        transaction_type_val,
        quantity_change,
        OLD.current_stock,
        NEW.current_stock,
        COALESCE(TG_ARGV[0], 'Stock adjustment'),
        COALESCE(TG_ARGV[1], 'SYSTEM'),
        COALESCE(TG_ARGV[2]::INTEGER, NULL),
        COALESCE(TG_ARGV[3], 'SYSTEM')
    );

    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automatic stock change logging
CREATE TRIGGER log_stock_change_trigger
    AFTER UPDATE OF current_stock ON raw_materials
    FOR EACH ROW
    WHEN (OLD.current_stock IS DISTINCT FROM NEW.current_stock)
    EXECUTE FUNCTION log_stock_change();

-- Insert sample transaction data for existing materials (optional)
-- This creates initial transaction records for current stock levels
INSERT INTO stock_transactions (material_id, transaction_type, quantity, previous_stock, new_stock, reason, reference_type, created_by)
SELECT 
    material_id,
    'ADD',
    current_stock,
    0,
    current_stock,
    'Initial stock setup',
    'SYSTEM',
    'SYSTEM'
FROM raw_materials
WHERE current_stock > 0;

-- Add comments for documentation
COMMENT ON TABLE stock_transactions IS 'Audit trail for all raw material stock changes';
COMMENT ON COLUMN stock_transactions.transaction_type IS 'Type of transaction: ADD, SUBTRACT, or ADJUSTMENT';
COMMENT ON COLUMN stock_transactions.quantity IS 'Amount of stock changed (always positive)';
COMMENT ON COLUMN stock_transactions.previous_stock IS 'Stock level before the change';
COMMENT ON COLUMN stock_transactions.new_stock IS 'Stock level after the change';
COMMENT ON COLUMN stock_transactions.reason IS 'Human-readable reason for the change';
COMMENT ON COLUMN stock_transactions.reference_type IS 'Type of reference (ORDER, MANUAL, ADJUSTMENT, etc.)';
COMMENT ON COLUMN stock_transactions.reference_id IS 'ID of the reference (order_id, user_id, etc.)';
COMMENT ON COLUMN stock_transactions.created_by IS 'User or system that made the change';

-- Verify table creation
SELECT 'Stock Transactions Table Created Successfully' as status;
SELECT COUNT(*) as total_transactions FROM stock_transactions;
SELECT 
    st.transaction_id,
    rm.material_name,
    st.transaction_type,
    st.quantity,
    st.previous_stock,
    st.new_stock,
    st.reason,
    st.created_at
FROM stock_transactions st
JOIN raw_materials rm ON st.material_id = rm.material_id
ORDER BY st.created_at DESC
LIMIT 5;
