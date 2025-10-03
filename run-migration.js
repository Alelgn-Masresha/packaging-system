const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'packaging_db',
    password: 'password',
    port: 5432,
  });

  try {
    console.log('Running migration: add-order-from-stock-column.sql');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'backend/scripts/add-order-from-stock-column.sql'), 
      'utf8'
    );
    
    await pool.query(migrationSQL);
    console.log('Migration completed successfully!');
    
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

runMigration();

