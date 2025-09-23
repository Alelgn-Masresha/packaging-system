const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Get all products
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY product_id DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      message: err.message
    });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM products WHERE product_id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product',
      message: err.message
    });
  }
});

// Search products by name
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const searchQuery = `%${query}%`;
    
    const result = await pool.query(
      'SELECT * FROM products WHERE name ILIKE $1 ORDER BY product_id DESC',
      [searchQuery]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      query: query
    });
  } catch (err) {
    console.error('Error searching products:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to search products',
      message: err.message
    });
  }
});

// Create new product
router.post('/', async (req, res) => {
  try {
    const { name, standard_size, base_price } = req.body;
    
    // Validate required fields
    if (!name || !base_price) {
      return res.status(400).json({
        success: false,
        error: 'Product name and base price are required'
      });
    }
    
    // Validate base_price is a number
    if (isNaN(parseFloat(base_price)) || parseFloat(base_price) < 0) {
      return res.status(400).json({
        success: false,
        error: 'Base price must be a valid positive number'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO products (name, standard_size, base_price) VALUES ($1, $2, $3) RETURNING *',
      [name, standard_size, parseFloat(base_price)]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Product created successfully'
    });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create product',
      message: err.message
    });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, standard_size, base_price } = req.body;
    
    if (!name || !base_price) {
      return res.status(400).json({
        success: false,
        error: 'Product name and base price are required'
      });
    }
    
    if (isNaN(parseFloat(base_price)) || parseFloat(base_price) < 0) {
      return res.status(400).json({
        success: false,
        error: 'Base price must be a valid positive number'
      });
    }
    
    const result = await pool.query(
      'UPDATE products SET name = $1, standard_size = $2, base_price = $3 WHERE product_id = $4 RETURNING *',
      [name, standard_size, parseFloat(base_price), id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Product updated successfully'
    });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update product',
      message: err.message
    });
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if product is used in any orders
    const orderCheck = await pool.query('SELECT COUNT(*) FROM orders WHERE product_id = $1', [id]);
    if (parseInt(orderCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete product. It is used in existing orders.'
      });
    }
    
    const result = await pool.query('DELETE FROM products WHERE product_id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product deleted successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product',
      message: err.message
    });
  }
});

module.exports = router;
