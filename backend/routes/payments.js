const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Get all payments with order details
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        o.order_id,
        o.delivery_date,
        o.status as order_status,
        c.name as customer_name,
        c.phone as customer_phone,
        pr.name as product_name
      FROM payments p
      JOIN orders o ON p.order_id = o.order_id
      JOIN customers c ON o.customer_id = c.customer_id
      JOIN products pr ON o.product_id = pr.product_id
      ORDER BY p.payment_date DESC
    `);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments',
      message: err.message
    });
  }
});

// Get payments by order ID
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await pool.query(`
      SELECT 
        p.*,
        o.order_id,
        o.delivery_date,
        o.status as order_status,
        c.name as customer_name,
        c.phone as customer_phone,
        pr.name as product_name
      FROM payments p
      JOIN orders o ON p.order_id = o.order_id
      JOIN customers c ON o.customer_id = c.customer_id
      JOIN products pr ON o.product_id = pr.product_id
      WHERE p.order_id = $1
      ORDER BY p.payment_date DESC
    `, [orderId]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      order_id: orderId
    });
  } catch (err) {
    console.error('Error fetching order payments:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order payments',
      message: err.message
    });
  }
});

// Get payment by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        p.*,
        o.order_id,
        o.delivery_date,
        o.status as order_status,
        c.name as customer_name,
        c.phone as customer_phone,
        pr.name as product_name
      FROM payments p
      JOIN orders o ON p.order_id = o.order_id
      JOIN customers c ON o.customer_id = c.customer_id
      JOIN products pr ON o.product_id = pr.product_id
      WHERE p.payment_id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error fetching payment:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment',
      message: err.message
    });
  }
});

// Filter payments by type (Advance/Final)
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['Advance', 'Final'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment type. Must be one of: ' + validTypes.join(', ')
      });
    }
    
    const result = await pool.query(`
      SELECT 
        p.*,
        o.order_id,
        o.delivery_date,
        o.status as order_status,
        c.name as customer_name,
        c.phone as customer_phone,
        pr.name as product_name
      FROM payments p
      JOIN orders o ON p.order_id = o.order_id
      JOIN customers c ON o.customer_id = c.customer_id
      JOIN products pr ON o.product_id = pr.product_id
      WHERE p.type = $1
      ORDER BY p.payment_date DESC
    `, [type]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      type: type
    });
  } catch (err) {
    console.error('Error fetching payments by type:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payments by type',
      message: err.message
    });
  }
});

// Create new payment
router.post('/', async (req, res) => {
  try {
    const {
      order_id,
      amount,
      payment_date,
      reference_number,
      type
    } = req.body;
    
    // Validate required fields
    if (!order_id || !amount || !type) {
      return res.status(400).json({
        success: false,
        error: 'Order ID, amount, and payment type are required'
      });
    }
    
    // Validate payment type
    const validTypes = ['Advance', 'Final'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Payment type must be one of: ' + validTypes.join(', ')
      });
    }
    
    // Validate amount is positive
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a valid positive number'
      });
    }
    
    // Check if order exists
    const orderCheck = await pool.query('SELECT * FROM orders WHERE order_id = $1', [order_id]);
    if (orderCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    // Use current date if payment_date not provided
    const paymentDate = payment_date || new Date().toISOString().split('T')[0];
    
    const result = await pool.query(
      'INSERT INTO payments (order_id, amount, payment_date, reference_number, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [order_id, parseFloat(amount), paymentDate, reference_number, type]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Payment created successfully'
    });
  } catch (err) {
    console.error('Error creating payment:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment',
      message: err.message
    });
  }
});

// Update payment
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      amount,
      payment_date,
      reference_number,
      type
    } = req.body;
    
    // Validate payment type if provided
    if (type) {
      const validTypes = ['Advance', 'Final'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Payment type must be one of: ' + validTypes.join(', ')
        });
      }
    }
    
    // Validate amount if provided
    if (amount !== undefined) {
      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be a valid positive number'
        });
      }
    }
    
    // Build dynamic query based on provided fields
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (amount !== undefined) {
      updates.push(`amount = $${paramCount}`);
      values.push(parseFloat(amount));
      paramCount++;
    }
    
    if (payment_date !== undefined) {
      updates.push(`payment_date = $${paramCount}`);
      values.push(payment_date);
      paramCount++;
    }
    
    if (reference_number !== undefined) {
      updates.push(`reference_number = $${paramCount}`);
      values.push(reference_number);
      paramCount++;
    }
    
    if (type !== undefined) {
      updates.push(`type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }
    
    values.push(id); // Add payment ID as last parameter
    
    const query = `UPDATE payments SET ${updates.join(', ')} WHERE payment_id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Payment updated successfully'
    });
  } catch (err) {
    console.error('Error updating payment:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment',
      message: err.message
    });
  }
});

// Delete payment
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM payments WHERE payment_id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Payment deleted successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error deleting payment:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete payment',
      message: err.message
    });
  }
});

// Get payment summary for an order
router.get('/order/:orderId/summary', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Get order details
    const orderResult = await pool.query(`
      SELECT 
        o.*,
        c.name as customer_name,
        pr.name as product_name,
        pr.base_price
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      JOIN products pr ON o.product_id = pr.product_id
      WHERE o.order_id = $1
    `, [orderId]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    // Get payment summary
    const paymentResult = await pool.query(`
      SELECT 
        type,
        SUM(amount) as total_amount,
        COUNT(*) as payment_count
      FROM payments 
      WHERE order_id = $1 
      GROUP BY type
    `, [orderId]);
    
    // Get all payments for this order
    const allPayments = await pool.query(
      'SELECT * FROM payments WHERE order_id = $1 ORDER BY payment_date DESC',
      [orderId]
    );
    
    const order = orderResult.rows[0];
    const totalOrderValue = order.base_price * order.quantity;
    
    // Calculate payment summary
    let totalPaid = 0;
    let advancePaid = 0;
    let finalPaid = 0;
    
    paymentResult.rows.forEach(payment => {
      totalPaid += parseFloat(payment.total_amount);
      if (payment.type === 'Advance') {
        advancePaid = parseFloat(payment.total_amount);
      } else if (payment.type === 'Final') {
        finalPaid = parseFloat(payment.total_amount);
      }
    });
    
    const outstanding = totalOrderValue - totalPaid;
    
    res.json({
      success: true,
      data: {
        order: order,
        payment_summary: {
          total_order_value: totalOrderValue,
          total_paid: totalPaid,
          advance_paid: advancePaid,
          final_paid: finalPaid,
          outstanding: outstanding,
          payment_status: outstanding <= 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Unpaid')
        },
        payments: allPayments.rows
      }
    });
  } catch (err) {
    console.error('Error fetching payment summary:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment summary',
      message: err.message
    });
  }
});

module.exports = router;
