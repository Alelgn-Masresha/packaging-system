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

// Helper function to restore raw materials and product stock when order is cancelled
const restoreOrderItems = async (orderId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get all products for the order from order_products
    const orderProductsResult = await client.query(`
      SELECT op.product_id, op.quantity, op.amount_per_unit, op.order_from_stock
      FROM order_products op
      WHERE op.order_id = $1
    `, [orderId]);
    
    if (orderProductsResult.rows.length === 0) {
      await client.query('COMMIT');
      return;
    }
    
    // For each product, restore based on order type
    for (const op of orderProductsResult.rows) {
      if (op.order_from_stock) {
        // Restore product stock for stock-based orders
        await client.query(
          'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2',
          [parseInt(op.quantity), op.product_id]
        );
      } else {
        // Restore raw materials for manufacturing orders
        const materialsRes = await client.query(`
          SELECT pm.material_id, pm.amount_per_unit, rm.current_stock, rm.unit
          FROM product_materials pm
          JOIN raw_materials rm ON rm.material_id = pm.material_id
          WHERE pm.product_id = $1
        `, [op.product_id]);

        for (const row of materialsRes.rows) {
          // Use custom amount if provided, otherwise product's default
          const perUnit = op.amount_per_unit || parseFloat(row.amount_per_unit);
          if (!perUnit || perUnit <= 0) continue;
          const totalToRestore = perUnit * parseInt(op.quantity);
          const currentStock = parseFloat(row.current_stock);
          const newStock = currentStock + totalToRestore;
          
          await client.query('UPDATE raw_materials SET current_stock = $1 WHERE material_id = $2', [newStock, row.material_id]);
          await client.query(`
            INSERT INTO stock_transactions (
              material_id, transaction_type, quantity, previous_stock, new_stock, 
              reason, reference_type, reference_id, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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

// Get all orders with customer and product details
router.get('/', async (req, res) => {
  try {
    const ordersResult = await pool.query(`
      SELECT 
        o.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.address as customer_address
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      ORDER BY o.order_id DESC
    `);
    
    // Get products for each order
    const orderIds = ordersResult.rows.map(o => o.order_id);
    let productsMap = new Map();
    
    if (orderIds.length > 0) {
      const productsResult = await pool.query(`
        SELECT 
          op.order_id,
          op.product_id,
          op.quantity,
          op.order_unit_price,
          op.amount_per_unit,
          op.is_custom_size,
          op.order_from_stock,
          op.length,
          op.width,
          op.height,
          p.name as product_name,
          p.standard_size,
          p.base_price
        FROM order_products op
        JOIN products p ON op.product_id = p.product_id
        WHERE op.order_id = ANY($1)
      `, [orderIds]);
      
      productsMap = productsResult.rows.reduce((acc, row) => {
        const list = acc.get(row.order_id) || [];
        list.push(row);
        acc.set(row.order_id, list);
        return acc;
      }, new Map());
    }
    
    const ordersWithProducts = ordersResult.rows.map(order => ({
      ...order,
      products: productsMap.get(order.order_id) || [],
      // Legacy fields for backward compatibility (first product)
      product_id: productsMap.get(order.order_id)?.[0]?.product_id || null,
      product_name: productsMap.get(order.order_id)?.[0]?.product_name || null,
      quantity: productsMap.get(order.order_id)?.[0]?.quantity || null,
      order_unit_price: productsMap.get(order.order_id)?.[0]?.order_unit_price || null,
      standard_size: productsMap.get(order.order_id)?.[0]?.standard_size || null,
      base_price: productsMap.get(order.order_id)?.[0]?.base_price || null,
      is_custom_size: productsMap.get(order.order_id)?.[0]?.is_custom_size || false,
      length: productsMap.get(order.order_id)?.[0]?.length || null,
      width: productsMap.get(order.order_id)?.[0]?.width || null,
      height: productsMap.get(order.order_id)?.[0]?.height || null
    }));
    
    res.json({
      success: true,
      data: ordersWithProducts,
      count: ordersWithProducts.length
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
    
    // Get orders with customer details
    const ordersResult = await pool.query(`
      SELECT 
        o.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.address as customer_address
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      WHERE o.customer_id = $1
      ORDER BY o.order_id DESC
    `, [customerId]);
    
    // Get products for each order
    const orderIds = ordersResult.rows.map(o => o.order_id);
    let productsMap = new Map();
    
    if (orderIds.length > 0) {
      const productsResult = await pool.query(`
        SELECT 
          op.order_id,
          op.product_id,
          op.quantity,
          op.order_unit_price,
          op.amount_per_unit,
          op.is_custom_size,
          op.order_from_stock,
          op.length,
          op.width,
          op.height,
          p.name as product_name,
          p.standard_size,
          p.base_price
        FROM order_products op
        JOIN products p ON op.product_id = p.product_id
        WHERE op.order_id = ANY($1)
      `, [orderIds]);
      
      productsMap = productsResult.rows.reduce((acc, row) => {
        const list = acc.get(row.order_id) || [];
        list.push(row);
        acc.set(row.order_id, list);
        return acc;
      }, new Map());
    }
    
    // Create orders with products (using first product for backward compatibility)
    const ordersWithProducts = ordersResult.rows.map(order => ({
      ...order,
      products: productsMap.get(order.order_id) || [],
      // Legacy fields for backward compatibility (first product)
      product_id: productsMap.get(order.order_id)?.[0]?.product_id || null,
      product_name: productsMap.get(order.order_id)?.[0]?.product_name || null,
      quantity: productsMap.get(order.order_id)?.[0]?.quantity || null,
      order_unit_price: productsMap.get(order.order_id)?.[0]?.order_unit_price || null,
      standard_size: productsMap.get(order.order_id)?.[0]?.standard_size || null,
      base_price: productsMap.get(order.order_id)?.[0]?.base_price || null,
      is_custom_size: productsMap.get(order.order_id)?.[0]?.is_custom_size || false,
      length: productsMap.get(order.order_id)?.[0]?.length || null,
      width: productsMap.get(order.order_id)?.[0]?.width || null,
      height: productsMap.get(order.order_id)?.[0]?.height || null
    }));
    
    res.json({
      success: true,
      data: ordersWithProducts,
      count: ordersWithProducts.length,
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
    
    // Get order with customer details
    const orderResult = await pool.query(`
      SELECT 
        o.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.address as customer_address
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      WHERE o.order_id = $1
    `, [id]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    // Get products for this order
    const productsResult = await pool.query(`
      SELECT 
        op.product_id,
        op.quantity,
        op.order_unit_price,
        op.amount_per_unit,
        op.is_custom_size,
        op.order_from_stock,
        op.length,
        op.width,
        op.height,
        p.name as product_name,
        p.standard_size,
        p.base_price
      FROM order_products op
      JOIN products p ON op.product_id = p.product_id
      WHERE op.order_id = $1
    `, [id]);
    
    // Get payments for this order
    const payments = await pool.query(
      'SELECT * FROM payments WHERE order_id = $1 ORDER BY payment_date DESC',
      [id]
    );
    
    const order = orderResult.rows[0];
    const products = productsResult.rows;
    
    res.json({
      success: true,
      data: {
        ...order,
        products: products,
        // Legacy fields for backward compatibility (first product)
        product_id: products[0]?.product_id || null,
        product_name: products[0]?.product_name || null,
        quantity: products[0]?.quantity || null,
        order_unit_price: products[0]?.order_unit_price || null,
        standard_size: products[0]?.standard_size || null,
        base_price: products[0]?.base_price || null,
        is_custom_size: products[0]?.is_custom_size || false,
        length: products[0]?.length || null,
        width: products[0]?.width || null,
        height: products[0]?.height || null,
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
    
    // Get orders with customer details
    const ordersResult = await pool.query(`
      SELECT 
        o.*,
        c.name as customer_name,
        c.phone as customer_phone,
        c.address as customer_address
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      WHERE o.status = $1
      ORDER BY o.order_id DESC
    `, [status]);
    
    // Get products for each order
    const orderIds = ordersResult.rows.map(o => o.order_id);
    let productsMap = new Map();
    
    if (orderIds.length > 0) {
      const productsResult = await pool.query(`
        SELECT 
          op.order_id,
          op.product_id,
          op.quantity,
          op.order_unit_price,
          op.amount_per_unit,
          op.is_custom_size,
          op.order_from_stock,
          op.length,
          op.width,
          op.height,
          p.name as product_name,
          p.standard_size,
          p.base_price
        FROM order_products op
        JOIN products p ON op.product_id = p.product_id
        WHERE op.order_id = ANY($1)
      `, [orderIds]);
      
      productsMap = productsResult.rows.reduce((acc, row) => {
        const list = acc.get(row.order_id) || [];
        list.push(row);
        acc.set(row.order_id, list);
        return acc;
      }, new Map());
    }
    
    // Create orders with products (using first product for backward compatibility)
    const ordersWithProducts = ordersResult.rows.map(order => ({
      ...order,
      products: productsMap.get(order.order_id) || [],
      // Legacy fields for backward compatibility (first product)
      product_id: productsMap.get(order.order_id)?.[0]?.product_id || null,
      product_name: productsMap.get(order.order_id)?.[0]?.product_name || null,
      quantity: productsMap.get(order.order_id)?.[0]?.quantity || null,
      order_unit_price: productsMap.get(order.order_id)?.[0]?.order_unit_price || null,
      standard_size: productsMap.get(order.order_id)?.[0]?.standard_size || null,
      base_price: productsMap.get(order.order_id)?.[0]?.base_price || null,
      is_custom_size: productsMap.get(order.order_id)?.[0]?.is_custom_size || false,
      length: productsMap.get(order.order_id)?.[0]?.length || null,
      width: productsMap.get(order.order_id)?.[0]?.width || null,
      height: productsMap.get(order.order_id)?.[0]?.height || null
    }));
    
    res.json({
      success: true,
      data: ordersWithProducts,
      count: ordersWithProducts.length,
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

// Create new order (supports products array for multiple products per order)
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      customer_id,
      delivery_date,
      is_custom_size = false,
      length,
      width,
      height,
      // New: products array [{product_id, quantity, order_unit_price, amount_per_unit}]
      products,
      // Legacy: single product
      product_id,
      quantity,
      order_unit_price,
      amount_per_unit
    } = req.body;
    
    // Validate required fields
    if (!customer_id || !delivery_date) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID and delivery date are required'
      });
    }
    
    // Build products list from either products array or legacy single product
    const productsList = products && Array.isArray(products) && products.length > 0
      ? products
      : (product_id && quantity && order_unit_price
          ? [{ product_id, quantity, order_unit_price, amount_per_unit }]
          : []);
    
    if (productsList.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one product is required (provide products array or product_id, quantity, order_unit_price)'
      });
    }
    
    // Validate each product
    for (const prod of productsList) {
      if (!prod.product_id || !prod.quantity || !prod.order_unit_price) {
      return res.status(400).json({
        success: false,
          error: 'Each product must have product_id, quantity, and order_unit_price'
        });
      }
      if (parseInt(prod.quantity) <= 0) {
        return res.status(400).json({ success: false, error: 'Quantity must be positive' });
      }
      if (parseFloat(prod.order_unit_price) <= 0) {
        return res.status(400).json({ success: false, error: 'Order unit price must be positive' });
      }
    }
    
    // Validate custom size dimensions if custom size is selected globally
    // (per-product validation happens in product loop above)
    if (is_custom_size && (!length || !width || !height)) {
      // Only validate if using global custom size
      const hasGlobalCustom = productsList.some(p => !p.length && !p.width && !p.height);
      if (hasGlobalCustom) {
      return res.status(400).json({
        success: false,
        error: 'Length, width, and height are required for custom size orders'
      });
    }
    }

    // Calculate raw material requirements for products that are NOT ordered from stock
    const allRequirements = [];
    const stockBasedProducts = [];
    
    for (const prod of productsList) {
      if (prod.order_from_stock) {
        // For stock-based orders, check product stock instead of raw materials
        stockBasedProducts.push(prod);
      } else {
        // For manufacturing orders, check raw material requirements
        const req = await calculateRawMaterialRequirements(prod.product_id, prod.quantity, prod.amount_per_unit);
        allRequirements.push(...req.requirements);
      }
    }
    
    // Check if there are insufficient raw materials for manufacturing orders
    const insufficientMaterials = allRequirements.filter(req => !req.sufficient);
    
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
    
    // Check if there are insufficient product stock for stock-based orders
    const insufficientStockProducts = [];
    for (const prod of stockBasedProducts) {
      const productResult = await client.query(
        'SELECT stock_quantity, name FROM products WHERE product_id = $1',
        [prod.product_id]
      );
      
      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: `Product with ID ${prod.product_id} not found`
        });
      }
      
      const currentStock = parseFloat(productResult.rows[0].stock_quantity) || 0;
      const requiredQuantity = parseInt(prod.quantity);
      const productName = productResult.rows[0].name;
      
      if (currentStock < requiredQuantity) {
        insufficientStockProducts.push({
          product_id: prod.product_id,
          product_name: productName,
          required: requiredQuantity,
          available: currentStock,
          shortfall: requiredQuantity - currentStock
        });
      }
    }
    
    if (insufficientStockProducts.length > 0) {
      await client.query('ROLLBACK');
      const warningMessages = insufficientStockProducts.map(prod => 
        `Insufficient stock for ${prod.product_name}: Need ${prod.required} units, but only have ${prod.available} units in stock (shortfall: ${prod.shortfall} units)`
      );
      
      return res.status(400).json({
        success: false,
        error: 'Insufficient product stock',
        details: warningMessages,
        insufficient_stock_products: insufficientStockProducts
      });
    }

    await client.query('BEGIN');
    
    // Create the order (base order without product-specific fields)
    const result = await client.query(
      `INSERT INTO orders (customer_id, delivery_date) VALUES ($1, $2) RETURNING *`,
      [customer_id, delivery_date]
    );
    
    const orderId = result.rows[0].order_id;
    
    // Insert products into order_products with custom size info per product
    for (const prod of productsList) {
      await client.query(
        `INSERT INTO order_products (order_id, product_id, quantity, order_unit_price, amount_per_unit, is_custom_size, order_from_stock, length, width, height)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          orderId, 
          prod.product_id, 
          parseInt(prod.quantity), 
          parseFloat(prod.order_unit_price), 
          prod.amount_per_unit ? parseFloat(prod.amount_per_unit) : null,
          prod.is_custom_size || is_custom_size || false,
          prod.order_from_stock || false,
          prod.length ? parseFloat(prod.length) : (is_custom_size ? parseFloat(length) : null),
          prod.width ? parseFloat(prod.width) : (is_custom_size ? parseFloat(width) : null),
          prod.height ? parseFloat(prod.height) : (is_custom_size ? parseFloat(height) : null)
        ]
      );
    }

    // Subtract raw materials from stock (for manufacturing orders)
    if (allRequirements.length > 0) {
      await subtractRawMaterials(allRequirements, orderId);
    }
    
    // Subtract from product stock (for stock-based orders)
    for (const prod of stockBasedProducts) {
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2',
        [parseInt(prod.quantity), prod.product_id]
      );
    }

    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      data: { ...result.rows[0], products: productsList },
      message: 'Order created successfully',
      material_requirements: allRequirements
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
    
    // If order is being cancelled, restore raw materials and product stock
    if (status === 'Cancelled' && currentStatus !== 'Cancelled') {
      try {
        await restoreOrderItems(id);
      } catch (restoreErr) {
        console.error('Error restoring items for cancelled order:', restoreErr);
        // Continue with status update even if restoration fails
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

// Update order with products (for edit functionality)
router.put('/:id/products', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { delivery_date, products } = req.body;
    
    await client.query('BEGIN');
    
    // Validate products array
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Products array is required and cannot be empty'
      });
    }
    
    // Validate each product
    for (const product of products) {
      if (!product.product_id || !product.quantity || !product.order_unit_price) {
        return res.status(400).json({
          success: false,
          error: 'Each product must have product_id, quantity, and order_unit_price'
        });
      }
      
      // Check if product exists
      const productCheck = await client.query('SELECT product_id FROM products WHERE product_id = $1', [product.product_id]);
      if (productCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: `Product with ID ${product.product_id} not found`
        });
      }
    }
    
    // Update delivery date if provided
    if (delivery_date) {
      await client.query('UPDATE orders SET delivery_date = $1 WHERE order_id = $2', [delivery_date, id]);
    }
    
    // Delete existing order_products
    await client.query('DELETE FROM order_products WHERE order_id = $1', [id]);
    
    // Restore raw materials from old order_products (if any existed)
    const oldOrderProducts = await client.query(`
      SELECT op.product_id, op.quantity, op.amount_per_unit
      FROM order_products op
      WHERE op.order_id = $1
    `, [id]);
    
    if (oldOrderProducts.rows.length > 0) {
      await restoreRawMaterials(oldOrderProducts.rows, id);
    }
    
    // Insert new order_products and calculate material requirements
    let totalMaterialRequirements = [];
    
    for (const product of products) {
      // Insert order_product
      await client.query(`
        INSERT INTO order_products (order_id, product_id, quantity, order_unit_price, amount_per_unit, is_custom_size, length, width, height)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        id,
        product.product_id,
        product.quantity,
        product.order_unit_price,
        product.amount_per_unit || product.order_unit_price,
        product.is_custom_size || false,
        product.length || null,
        product.width || null,
        product.height || null
      ]);
      
      // Calculate material requirements for this product
      const requirements = await calculateRawMaterialRequirements(
        product.product_id,
        product.quantity,
        product.amount_per_unit
      );
      
      // Add to total requirements
      for (const req of requirements.requirements) {
        const existing = totalMaterialRequirements.find(r => r.material_id === req.material_id);
        if (existing) {
          existing.total_required += req.total_required;
        } else {
          totalMaterialRequirements.push(req);
        }
      }
    }
    
    // Check if we have sufficient materials
    const insufficientMaterials = totalMaterialRequirements.filter(req => !req.sufficient);
    if (insufficientMaterials.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Insufficient raw materials',
        details: insufficientMaterials.map(m => ({
          material: m.material_name,
          required: m.total_required,
          available: m.current_stock,
          unit: m.unit
        }))
      });
    }
    
    // Subtract materials from stock
    await subtractRawMaterials(totalMaterialRequirements, id);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Order updated successfully'
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating order products:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to update order',
      message: err.message
    });
  } finally {
    client.release();
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
