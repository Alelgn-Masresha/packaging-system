const { Pool } = require('pg');

// Test script to verify initial stock transaction functionality
async function testInitialStockTransaction() {
  const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'packaging_db',
    password: 'password',
    port: 5432,
  });

  try {
    console.log('Testing initial stock transaction...');
    
    // Test creating a raw material with initial stock
    const client = await pool.connect();
    
    await client.query('BEGIN');
    
    // Create the raw material
    const result = await client.query(
      'INSERT INTO raw_materials (material_name, description, category, current_stock, unit, min_stock) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      ['Test Material', 'Test Description', 'Paper', 100, 'Sheets', 10]
    );
    
    const newMaterial = result.rows[0];
    console.log('Created material:', newMaterial.material_name, 'with stock:', newMaterial.current_stock);
    
    // Create initial stock transaction if stock > 0
    if (newMaterial.current_stock > 0) {
      await client.query(`
        INSERT INTO stock_transactions (
          material_id, transaction_type, quantity, previous_stock, new_stock, 
          reason, reference_type, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        newMaterial.material_id,
        'ADD',
        newMaterial.current_stock,
        0, // previous stock is 0 for new material
        newMaterial.current_stock, // new stock
        'Initial stock',
        'INITIAL',
        'SYSTEM'
      ]);
      
      console.log('Created initial stock transaction for', newMaterial.current_stock, 'units');
    }
    
    await client.query('COMMIT');
    
    // Verify the transaction was created
    const transactionResult = await client.query(
      'SELECT * FROM stock_transactions WHERE material_id = $1 ORDER BY created_at DESC',
      [newMaterial.material_id]
    );
    
    console.log('Found', transactionResult.rows.length, 'transactions for this material');
    if (transactionResult.rows.length > 0) {
      const transaction = transactionResult.rows[0];
      console.log('Latest transaction:', {
        type: transaction.transaction_type,
        quantity: transaction.quantity,
        reason: transaction.reason,
        created_at: transaction.created_at
      });
    }
    
    client.release();
    console.log('Test completed successfully!');
    
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await pool.end();
  }
}

testInitialStockTransaction();

