const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Get all customers
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers ORDER BY customer_id DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customers',
      message: err.message
    });
  }
});

// Get customer by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM customers WHERE customer_id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error fetching customer:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer',
      message: err.message
    });
  }
});

// Search customers by name, phone, or ID
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const searchQuery = `%${query}%`;
    
    const result = await pool.query(
      'SELECT * FROM customers WHERE name ILIKE $1 OR phone ILIKE $2 OR customer_id::text ILIKE $3 ORDER BY customer_id DESC',
      [searchQuery, searchQuery, searchQuery]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      query: query
    });
  } catch (err) {
    console.error('Error searching customers:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to search customers',
      message: err.message
    });
  }
});

// Create new customer
router.post('/', async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Customer name is required'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO customers (name, phone, address) VALUES ($1, $2, $3) RETURNING *',
      [name, phone, address]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Customer created successfully'
    });
  } catch (err) {
    console.error('Error creating customer:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create customer',
      message: err.message
    });
  }
});

// Update customer
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Customer name is required'
      });
    }
    
    const result = await pool.query(
      'UPDATE customers SET name = $1, phone = $2, address = $3 WHERE customer_id = $4 RETURNING *',
      [name, phone, address, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Customer updated successfully'
    });
  } catch (err) {
    console.error('Error updating customer:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update customer',
      message: err.message
    });
  }
});

// Delete customer
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM customers WHERE customer_id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Customer deleted successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete customer',
      message: err.message
    });
  }
});

module.exports = router;
