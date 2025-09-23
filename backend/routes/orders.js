const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Get all orders with customer and product details
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.address as customer_address,
        p.name as product_name,
        p.standard_size,
        p.base_price
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      JOIN products p ON o.product_id = p.product_id
      ORDER BY o.order_id DESC
    `);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: err.message
    });
  }
});

// Get orders by customer ID
router.get('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const result = await pool.query(`
      SELECT 
        o.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.address as customer_address,
        p.name as product_name,
        p.standard_size,
        p.base_price
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      JOIN products p ON o.product_id = p.product_id
      WHERE o.customer_id = $1
      ORDER BY o.order_id DESC
    `, [customerId]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      customer_id: customerId
    });
  } catch (err) {
    console.error('Error fetching customer orders:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch customer orders',
      message: err.message
    });
  }
});

// Get order by ID with full details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        o.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.address as customer_address,
        p.name as product_name,
        p.standard_size,
        p.base_price
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      JOIN products p ON o.product_id = p.product_id
      WHERE o.order_id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    // Get payments for this order
    const payments = await pool.query(
      'SELECT * FROM payments WHERE order_id = $1 ORDER BY payment_date DESC',
      [id]
    );
    
    res.json({
      success: true,
      data: {
        ...result.rows[0],
        payments: payments.rows
      }
    });
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order',
      message: err.message
    });
  }
});

// Filter orders by status
router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const validStatuses = ['Pending', 'In Progress', 'Completed', 'Delivered', 'Cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }
    
    const result = await pool.query(`
      SELECT 
        o.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.address as customer_address,
        p.name as product_name,
        p.standard_size,
        p.base_price
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      JOIN products p ON o.product_id = p.product_id
      WHERE o.status = $1
      ORDER BY o.order_id DESC
    `, [status]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      status: status
    });
  } catch (err) {
    console.error('Error fetching orders by status:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders by status',
      message: err.message
    });
  }
});

// Create new order
router.post('/', async (req, res) => {
  try {
    const {
      customer_id,
      product_id,
      delivery_date,
      quantity,
      order_unit_price,
      is_custom_size = false,
      length,
      width,
      height
    } = req.body;
    
    // Validate required fields
    if (!customer_id || !product_id || !delivery_date || !quantity || !order_unit_price) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID, Product ID, delivery date, quantity, and order unit price are required'
      });
    }
    
    // Validate quantity is positive
    if (parseInt(quantity) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be a positive number'
      });
    }
    
    // Validate order unit price is positive
    if (parseFloat(order_unit_price) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Order unit price must be a positive number'
      });
    }
    
    // Validate custom size dimensions if custom size is selected
    if (is_custom_size && (!length || !width || !height)) {
      return res.status(400).json({
        success: false,
        error: 'Length, width, and height are required for custom size orders'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO orders (
        customer_id, product_id, delivery_date, quantity, order_unit_price,
        is_custom_size, length, width, height
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        customer_id,
        product_id,
        delivery_date,
        parseInt(quantity),
        parseFloat(order_unit_price),
        is_custom_size,
        is_custom_size ? parseFloat(length) : null,
        is_custom_size ? parseFloat(width) : null,
        is_custom_size ? parseFloat(height) : null
      ]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Order created successfully'
    });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: err.message
    });
  }
});

// Update order status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['Pending', 'In Progress', 'Completed', 'Delivered', 'Cancelled'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Valid status is required. Must be one of: ' + validStatuses.join(', ')
      });
    }
    
    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE order_id = $2 RETURNING *',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Order status updated successfully'
    });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status',
      message: err.message
    });
  }
});

// Update order details
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      delivery_date,
      quantity,
      order_unit_price,
      is_custom_size,
      length,
      width,
      height
    } = req.body;
    
    // Build dynamic query based on provided fields
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (delivery_date !== undefined) {
      updates.push(`delivery_date = $${paramCount}`);
      values.push(delivery_date);
      paramCount++;
    }
    
    if (quantity !== undefined) {
      if (parseInt(quantity) <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Quantity must be a positive number'
        });
      }
      updates.push(`quantity = $${paramCount}`);
      values.push(parseInt(quantity));
      paramCount++;
    }
    
    if (order_unit_price !== undefined) {
      if (parseFloat(order_unit_price) <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Order unit price must be a positive number'
        });
      }
      updates.push(`order_unit_price = $${paramCount}`);
      values.push(parseFloat(order_unit_price));
      paramCount++;
    }
    
    if (is_custom_size !== undefined) {
      updates.push(`is_custom_size = $${paramCount}`);
      values.push(is_custom_size);
      paramCount++;
      
      if (is_custom_size && (length !== undefined || width !== undefined || height !== undefined)) {
        if (length !== undefined) {
          updates.push(`length = $${paramCount}`);
          values.push(parseFloat(length));
          paramCount++;
        }
        if (width !== undefined) {
          updates.push(`width = $${paramCount}`);
          values.push(parseFloat(width));
          paramCount++;
        }
        if (height !== undefined) {
          updates.push(`height = $${paramCount}`);
          values.push(parseFloat(height));
          paramCount++;
        }
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }
    
    values.push(id); // Add order ID as last parameter
    
    const query = `UPDATE orders SET ${updates.join(', ')} WHERE order_id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Order updated successfully'
    });
  } catch (err) {
    console.error('Error updating order:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update order',
      message: err.message
    });
  }
});

// Delete order
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if order has payments
    const paymentCheck = await pool.query('SELECT COUNT(*) FROM payments WHERE order_id = $1', [id]);
    if (parseInt(paymentCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete order. It has associated payments.'
      });
    }
    
    const result = await pool.query('DELETE FROM orders WHERE order_id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Order deleted successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error deleting order:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete order',
      message: err.message
    });
  }
});

module.exports = router;
