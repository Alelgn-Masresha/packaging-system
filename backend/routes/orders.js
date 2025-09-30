const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Helper function to calculate raw material requirements for an order
// Uses product_materials join table (supports multiple materials per product)
const calculateRawMaterialRequirements = async (productId, quantity, customAmountPerUnit = null) => {
  try {
    // Get all materials for the product
    const materialsRes = await pool.query(`
      SELECT pm.material_id, pm.amount_per_unit, rm.material_name, rm.current_stock, rm.unit
      FROM product_materials pm
      JOIN raw_materials rm ON rm.material_id = pm.material_id
      WHERE pm.product_id = $1
    `, [productId]);

    if (materialsRes.rows.length === 0) {
      // Product has no material requirements
      return { requirements: [], totalRequired: 0 };
    }

    const requirements = materialsRes.rows.map(row => {
      // If a custom amount is provided and only one material exists, apply it; otherwise use stored amount
      const perUnit = (customAmountPerUnit !== null && materialsRes.rows.length === 1)
        ? parseFloat(customAmountPerUnit)
        : parseFloat(row.amount_per_unit);
      const totalReq = perUnit * parseInt(quantity);
      const current = parseFloat(row.current_stock);
      return {
        material_id: row.material_id,
        material_name: row.material_name,
        current_stock: current,
        unit: row.unit,
        amount_per_unit: perUnit,
        total_required: totalReq,
        sufficient: current >= totalReq
      };
    });

    const totalRequired = requirements.reduce((sum, r) => sum + r.total_required, 0);
    return { requirements, totalRequired };
  } catch (err) {
    console.error('Error calculating raw material requirements:', err);
    throw err;
  }
};

// Helper function to subtract raw materials from stock
const subtractRawMaterials = async (requirements, orderId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const req of requirements) {
      if (req.sufficient) {
        // Get current stock before update
        const currentResult = await client.query(
          'SELECT current_stock FROM raw_materials WHERE material_id = $1',
          [req.material_id]
        );
        
        if (currentResult.rows.length > 0) {
          const currentStock = parseFloat(currentResult.rows[0].current_stock);
          const newStock = currentStock - req.total_required;
          
          // Update stock
          await client.query(
            'UPDATE raw_materials SET current_stock = $1 WHERE material_id = $2',
            [newStock, req.material_id]
          );
          
          // Log transaction
          await client.query(`
            INSERT INTO stock_transactions (
              material_id, transaction_type, quantity, previous_stock, new_stock, 
              reason, reference_type, reference_id, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            req.material_id,
            'SUBTRACT',
            req.total_required,
            currentStock,
            newStock,
            `Order #${orderId} - Material consumption`,
            'ORDER',
            orderId,
            'SYSTEM'
          ]);
        }
      }
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Helper function to restore raw materials when order is cancelled
const restoreRawMaterials = async (orderId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get order with product id and quantity
    const orderResult = await client.query(`
      SELECT o.order_id, o.product_id, o.quantity
      FROM orders o
      WHERE o.order_id = $1
    `, [orderId]);
    
    if (orderResult.rows.length === 0) {
      throw new Error('Order not found');
    }
    
    const order = orderResult.rows[0];
    
    // Get the materials for the product
    const materialsRes = await client.query(`
      SELECT pm.material_id, pm.amount_per_unit, rm.current_stock, rm.unit
      FROM product_materials pm
      JOIN raw_materials rm ON rm.material_id = pm.material_id
      WHERE pm.product_id = $1
    `, [order.product_id]);

    for (const row of materialsRes.rows) {
      const perUnit = parseFloat(row.amount_per_unit);
      if (!perUnit || perUnit <= 0) continue;
      const totalToRestore = perUnit * parseInt(order.quantity);
      const currentStock = parseFloat(row.current_stock);
      const newStock = currentStock + totalToRestore;

      await client.query('UPDATE raw_materials SET current_stock = $1 WHERE material_id = $2', [newStock, row.material_id]);
      await client.query(`
        INSERT INTO stock_transactions (
          material_id, transaction_type, quantity, previous_stock, new_stock, 
          reason, reference_type, reference_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        row.material_id,
        'ADD',
        totalToRestore,
        currentStock,
        newStock,
        `Order #${orderId} - Material restoration (order cancelled)`,
        'ORDER',
        orderId,
        'SYSTEM'
      ]);
    }
    
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

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
  const client = await pool.connect();
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
      height,
      amount_per_unit
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

    // Validate amount_per_unit for custom size orders
    if (is_custom_size && (!amount_per_unit || parseFloat(amount_per_unit) <= 0)) {
      return res.status(400).json({
        success: false,
        error: 'Amount per unit is required for custom size orders and must be greater than 0'
      });
    }

    // Calculate raw material requirements
    const materialRequirements = await calculateRawMaterialRequirements(product_id, quantity, amount_per_unit);
    
    // Check if there are insufficient materials
    const insufficientMaterials = materialRequirements.requirements.filter(req => !req.sufficient);
    
    if (insufficientMaterials.length > 0) {
      const warningMessages = insufficientMaterials.map(req => 
        `Insufficient ${req.material_name}: Need ${req.total_required} ${req.unit}, but only have ${req.current_stock} ${req.unit}`
      );
      
      return res.status(400).json({
        success: false,
        error: 'You don\'t have enough materials',
        details: warningMessages,
        insufficient_materials: insufficientMaterials
      });
    }

    await client.query('BEGIN');
    
    // Create the order
    const result = await client.query(
      `INSERT INTO orders (
        customer_id, product_id, delivery_date, quantity, order_unit_price,
        is_custom_size, length, width, height, amount_per_unit
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        customer_id,
        product_id,
        delivery_date,
        parseInt(quantity),
        parseFloat(order_unit_price),
        is_custom_size,
        is_custom_size ? parseFloat(length) : null,
        is_custom_size ? parseFloat(width) : null,
        is_custom_size ? parseFloat(height) : null,
        amount_per_unit ? parseFloat(amount_per_unit) : null
      ]
    );

    // Subtract raw materials from stock
    if (materialRequirements.requirements.length > 0) {
      await subtractRawMaterials(materialRequirements.requirements, result.rows[0].order_id);
    }

    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Order created successfully',
      material_requirements: materialRequirements.requirements
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: err.message
    });
  } finally {
    client.release();
  }
});

// Check raw material requirements for an order (before creating)
router.post('/check-materials', async (req, res) => {
  try {
    const { product_id, quantity, amount_per_unit } = req.body;
    
    if (!product_id || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Product ID and quantity are required'
      });
    }
    
    const materialRequirements = await calculateRawMaterialRequirements(product_id, quantity, amount_per_unit);
    const insufficientMaterials = materialRequirements.requirements.filter(req => !req.sufficient);
    
    res.json({
      success: true,
      data: {
        requirements: materialRequirements.requirements,
        insufficient_materials: insufficientMaterials,
        has_insufficient: insufficientMaterials.length > 0
      }
    });
  } catch (err) {
    console.error('Error checking materials:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to check materials',
      message: err.message
    });
  }
});

// Update order status
router.put('/:id/status', async (req, res) => {
  const client = await pool.connect();
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
    
    await client.query('BEGIN');
    
    // Get current order status before update
    const currentOrderResult = await client.query(
      'SELECT status FROM orders WHERE order_id = $1',
      [id]
    );
    
    if (currentOrderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    const currentStatus = currentOrderResult.rows[0].status;
    
    // Update order status
    const result = await client.query(
      'UPDATE orders SET status = $1 WHERE order_id = $2 RETURNING *',
      [status, id]
    );
    
    // If order is being cancelled, restore raw materials
    if (status === 'Cancelled' && currentStatus !== 'Cancelled') {
      try {
        await restoreRawMaterials(id);
      } catch (restoreErr) {
        console.error('Error restoring materials for cancelled order:', restoreErr);
        // Continue with status update even if material restoration fails
        // This prevents the entire operation from failing
      }
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Order status updated successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating order status:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status',
      message: err.message
    });
  } finally {
    client.release();
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
