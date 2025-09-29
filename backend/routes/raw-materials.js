const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Get all raw materials
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM raw_materials ORDER BY material_id DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error('Error fetching raw materials:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch raw materials',
      message: err.message
    });
  }
});

// Get raw material by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM raw_materials WHERE material_id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Raw material not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error fetching raw material:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch raw material',
      message: err.message
    });
  }
});

// Search raw materials by name or category
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const searchQuery = `%${query}%`;
    
    const result = await pool.query(
      'SELECT * FROM raw_materials WHERE material_name ILIKE $1 OR category ILIKE $1 ORDER BY material_id DESC',
      [searchQuery]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      query: query
    });
  } catch (err) {
    console.error('Error searching raw materials:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to search raw materials',
      message: err.message
    });
  }
});

// Get raw materials by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM raw_materials WHERE category = $1 ORDER BY material_name',
      [category]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      category: category
    });
  } catch (err) {
    console.error('Error fetching raw materials by category:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch raw materials by category',
      message: err.message
    });
  }
});

// Get low stock materials
router.get('/low-stock/all', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM raw_materials WHERE status = $1 OR status = $2 ORDER BY current_stock ASC',
      ['Low Stock', 'Out of Stock']
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error('Error fetching low stock materials:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch low stock materials',
      message: err.message
    });
  }
});

// Create new raw material
router.post('/', async (req, res) => {
  const { material_name, description, category, current_stock, unit, min_stock } = req.body;

  try {
    // Validate required fields
    if (!material_name || !category || !unit) {
      return res.status(400).json({
        success: false,
        error: 'Material name, category, and unit are required'
      });
    }

    // Validate numeric fields
    const stock = parseFloat(current_stock) || 0;
    const minStock = parseFloat(min_stock) || 0;

    if (stock < 0 || minStock < 0) {
      return res.status(400).json({
        success: false,
        error: 'Stock values must be non-negative numbers'
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertResult = await client.query(
        'INSERT INTO raw_materials (material_name, description, category, current_stock, unit, min_stock) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [material_name, description, category, stock, unit, minStock]
      );

      const material = insertResult.rows[0];

      // Insert initial stock transaction if starting stock > 0
      if (stock > 0) {
        await client.query(
          `INSERT INTO stock_transactions (
            material_id, transaction_type, quantity, previous_stock, new_stock,
            reason, reference_type, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            material.material_id,
            'ADD',
            stock,
            0,
            stock,
            'Initial stock setup',
            'SYSTEM',
            'SYSTEM'
          ]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        data: material,
        message: 'Raw material created successfully'
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error creating raw material:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create raw material',
      message: err.message
    });
  }
});

// Update raw material
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { material_name, description, category, current_stock, unit, min_stock } = req.body;
    
    if (!material_name || !category || !unit) {
      return res.status(400).json({
        success: false,
        error: 'Material name, category, and unit are required'
      });
    }
    
    const stock = parseFloat(current_stock) || 0;
    const minStock = parseFloat(min_stock) || 0;
    
    if (stock < 0 || minStock < 0) {
      return res.status(400).json({
        success: false,
        error: 'Stock values must be non-negative numbers'
      });
    }
    
    const result = await pool.query(
      'UPDATE raw_materials SET material_name = $1, description = $2, category = $3, current_stock = $4, unit = $5, min_stock = $6 WHERE material_id = $7 RETURNING *',
      [material_name, description, category, stock, unit, minStock, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Raw material not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Raw material updated successfully'
    });
  } catch (err) {
    console.error('Error updating raw material:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update raw material',
      message: err.message
    });
  }
});

// Add stock to existing material
router.patch('/:id/add-stock', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { quantity, reason, created_by } = req.body;
    
    if (!quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid quantity is required'
      });
    }
    
    const addQuantity = parseFloat(quantity);
    
    await client.query('BEGIN');
    
    // Get current stock before update
    const currentResult = await client.query(
      'SELECT current_stock, material_name, unit FROM raw_materials WHERE material_id = $1',
      [id]
    );
    
    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Raw material not found'
      });
    }
    
    const currentStock = parseFloat(currentResult.rows[0].current_stock);
    const newStock = currentStock + addQuantity;
    
    // Update stock
    const result = await client.query(
      'UPDATE raw_materials SET current_stock = $1 WHERE material_id = $2 RETURNING *',
      [newStock, id]
    );
    
    // Do not manually insert a stock transaction here; the DB trigger will log this change
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      data: result.rows[0],
      message: `Added ${addQuantity} ${result.rows[0].unit} to ${result.rows[0].material_name}`,
      transaction: {
        quantity_added: addQuantity,
        previous_stock: currentStock,
        new_stock: newStock
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding stock:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to add stock',
      message: err.message
    });
  } finally {
    client.release();
  }
});

// Delete raw material
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');
    
    // Check if material exists
    const materialResult = await client.query('SELECT * FROM raw_materials WHERE material_id = $1', [id]);
    
    if (materialResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Raw material not found'
      });
    }
    
    // Check if material is referenced by products
    const productRefs = await client.query('SELECT COUNT(*) as count FROM products WHERE raw_material_id = $1', [id]);
    const refCount = parseInt(productRefs.rows[0].count);
    
    if (refCount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Cannot delete raw material',
        message: `This material is currently used by ${refCount} product(s). Please remove the material from all products before deleting.`
      });
    }
    
    // Delete the material (stock_transactions will be deleted due to CASCADE)
    const result = await client.query('DELETE FROM raw_materials WHERE material_id = $1 RETURNING *', [id]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Raw material deleted successfully',
      data: result.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting raw material:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete raw material',
      message: err.message
    });
  } finally {
    client.release();
  }
});

// Get all unique categories
router.get('/categories/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT category FROM raw_materials ORDER BY category');
    
    const categories = result.rows.map(row => row.category);
    
    res.json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories',
      message: err.message
    });
  }
});

// Get stock transaction history for a specific material
router.get('/:id/transactions', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, type } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT 
        st.*,
        rm.material_name,
        rm.unit
      FROM stock_transactions st
      JOIN raw_materials rm ON st.material_id = rm.material_id
      WHERE st.material_id = $1
    `;
    
    const params = [id];
    
    if (type) {
      query += ' AND st.transaction_type = $2';
      params.push(type);
    }
    
    query += ' ORDER BY st.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM stock_transactions WHERE material_id = $1';
    const countParams = [id];
    
    if (type) {
      countQuery += ' AND transaction_type = $2';
      countParams.push(type);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
      message: err.message
    });
  }
});

// Get all stock transactions (across all materials)
router.get('/transactions/all', async (req, res) => {
  try {
    const { page = 1, limit = 50, type, material_id } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT 
        st.*,
        rm.material_name,
        rm.unit
      FROM stock_transactions st
      JOIN raw_materials rm ON st.material_id = rm.material_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (type) {
      paramCount++;
      query += ` AND st.transaction_type = $${paramCount}`;
      params.push(type);
    }
    
    if (material_id) {
      paramCount++;
      query += ` AND st.material_id = $${paramCount}`;
      params.push(material_id);
    }
    
    query += ` ORDER BY st.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), offset);
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM stock_transactions WHERE 1=1';
    const countParams = [];
    let countParamCount = 0;
    
    if (type) {
      countParamCount++;
      countQuery += ` AND transaction_type = $${countParamCount}`;
      countParams.push(type);
    }
    
    if (material_id) {
      countParamCount++;
      countQuery += ` AND material_id = $${countParamCount}`;
      countParams.push(material_id);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error fetching all transactions:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
      message: err.message
    });
  }
});

module.exports = router;
