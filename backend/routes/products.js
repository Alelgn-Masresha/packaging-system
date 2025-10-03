const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Get all products (with materials)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY product_id DESC');
    const products = result.rows;

    // fetch materials for all products in one query
    const ids = products.map(p => p.product_id);
    let materialsMap = new Map();
    if (ids.length > 0) {
      const pmRes = await pool.query(
        'SELECT pm.product_id, pm.material_id, pm.amount_per_unit, rm.material_name, rm.unit FROM product_materials pm JOIN raw_materials rm ON rm.material_id = pm.material_id WHERE pm.product_id = ANY($1)',
        [ids]
      );
      materialsMap = pmRes.rows.reduce((acc, row) => {
        const list = acc.get(row.product_id) || [];
        list.push({ raw_material_id: row.material_id, amount_per_unit: Number(row.amount_per_unit), material_name: row.material_name, unit: row.unit });
        acc.set(row.product_id, list);
        return acc;
      }, new Map());
    }

    const withMaterials = products.map(p => ({ ...p, materials: materialsMap.get(p.product_id) || [] }));

    res.json({ success: true, data: withMaterials, count: withMaterials.length });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      message: err.message
    });
  }
});

// Get product by ID (with materials)
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
    
    const product = result.rows[0];
    const pmRes = await pool.query(
      'SELECT pm.material_id AS raw_material_id, pm.amount_per_unit FROM product_materials pm WHERE pm.product_id = $1',
      [id]
    );
    res.json({ success: true, data: { ...product, materials: pmRes.rows } });
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

// Create new product (supports materials[]; product_materials holds material mapping)
router.post('/', async (req, res) => {
  try {
    const { name, standard_size, base_price, materials } = req.body;
    
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
    
    // Insert product (only core columns)
    const result = await pool.query(
      'INSERT INTO products (name, standard_size, base_price) VALUES ($1, $2, $3) RETURNING *',
      [name, standard_size, parseFloat(base_price)]
    );

    // Optionally insert materials list
    const productId = result.rows[0].product_id;
    if (Array.isArray(materials) && materials.length > 0) {
      for (const m of materials) {
        if (!m.raw_material_id || !m.amount_per_unit) continue;
        // validate each material id
        const check = await pool.query('SELECT material_id FROM raw_materials WHERE material_id = $1', [m.raw_material_id]);
        if (check.rows.length === 0) {
          return res.status(400).json({ success: false, error: `Invalid raw material: ${m.raw_material_id}` });
        }
        await pool.query(
          'INSERT INTO product_materials (product_id, material_id, amount_per_unit) VALUES ($1, $2, $3) ON CONFLICT (product_id, material_id) DO UPDATE SET amount_per_unit = EXCLUDED.amount_per_unit',
          [productId, m.raw_material_id, parseFloat(m.amount_per_unit)]
        );
      }
    }
    
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

// Get only materials for a product
router.get('/:id/materials', async (req, res) => {
  try {
    const { id } = req.params;
    const pmRes = await pool.query(
      'SELECT pm.material_id AS raw_material_id, pm.amount_per_unit FROM product_materials pm WHERE pm.product_id = $1 ORDER BY pm.material_id',
      [id]
    );
    res.json({ success: true, data: pmRes.rows });
  } catch (err) {
    console.error('Error fetching product materials:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch product materials', message: err.message });
  }
});

// Replace product materials list
router.put('/:id/materials', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { materials } = req.body;
    if (!Array.isArray(materials)) {
      return res.status(400).json({ success: false, error: 'materials must be an array' });
    }
    await client.query('BEGIN');
    await client.query('DELETE FROM product_materials WHERE product_id = $1', [id]);
    for (const m of materials) {
      if (!m.raw_material_id || !m.amount_per_unit) continue;
      const check = await client.query('SELECT material_id FROM raw_materials WHERE material_id = $1', [m.raw_material_id]);
      if (check.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: `Invalid raw material: ${m.raw_material_id}` });
      }
      await client.query(
        'INSERT INTO product_materials (product_id, material_id, amount_per_unit) VALUES ($1, $2, $3) ON CONFLICT (product_id, material_id) DO UPDATE SET amount_per_unit = EXCLUDED.amount_per_unit',
        [id, m.raw_material_id, parseFloat(m.amount_per_unit)]
      );
    }
    await client.query('COMMIT');
    const pmRes = await pool.query('SELECT material_id AS raw_material_id, amount_per_unit FROM product_materials WHERE product_id = $1 ORDER BY material_id', [id]);
    res.json({ success: true, data: pmRes.rows, message: 'Materials updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating product materials:', err);
    res.status(500).json({ success: false, error: 'Failed to update product materials', message: err.message });
  } finally {
    client.release();
  }
});

// Backfill materials from legacy columns if they still exist
router.post('/backfill-materials', async (_req, res) => {
  const client = await pool.connect();
  try {
    // Check if legacy columns exist
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name IN ('raw_material_id','amount_per_unit')
    `);
    if (colCheck.rows.length < 2) {
      return res.json({ success: true, message: 'Legacy columns not present. Nothing to backfill.' });
    }

    await client.query('BEGIN');
    // Insert any missing product-material mappings from legacy fields
    await client.query(`
      INSERT INTO product_materials (product_id, material_id, amount_per_unit)
      SELECT p.product_id, p.raw_material_id, p.amount_per_unit
      FROM products p
      WHERE p.raw_material_id IS NOT NULL AND p.amount_per_unit IS NOT NULL
      ON CONFLICT (product_id, material_id) DO UPDATE SET amount_per_unit = EXCLUDED.amount_per_unit
    `);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Backfill completed' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error backfilling product materials:', err);
    res.status(500).json({ success: false, error: 'Backfill failed', message: err.message });
  } finally {
    client.release();
  }
});

// Update product (supports materials[]; product_materials holds material mapping)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, standard_size, base_price, materials } = req.body;
    
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
    
    // Upsert materials
    if (Array.isArray(materials)) {
      // replace current set with provided set
      await pool.query('DELETE FROM product_materials WHERE product_id = $1', [id]);
      for (const m of materials) {
        if (!m.raw_material_id || !m.amount_per_unit) continue;
        const check = await pool.query('SELECT material_id FROM raw_materials WHERE material_id = $1', [m.raw_material_id]);
        if (check.rows.length === 0) {
          return res.status(400).json({ success: false, error: `Invalid raw material: ${m.raw_material_id}` });
        }
        await pool.query(
          'INSERT INTO product_materials (product_id, material_id, amount_per_unit) VALUES ($1, $2, $3) ON CONFLICT (product_id, material_id) DO UPDATE SET amount_per_unit = EXCLUDED.amount_per_unit',
          [id, m.raw_material_id, parseFloat(m.amount_per_unit)]
        );
      }
    }

    res.json({ success: true, data: result.rows[0], message: 'Product updated successfully' });
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

// Add stock to product
router.post('/:id/stock', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be a positive number'
      });
    }
    
    await client.query('BEGIN');
    
    // Check if product exists
    const productCheck = await client.query('SELECT product_id FROM products WHERE product_id = $1', [id]);
    if (productCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    // Get product materials and calculate requirements
    const materialsRes = await client.query(`
      SELECT pm.material_id, pm.amount_per_unit, rm.material_name, rm.current_stock, rm.unit
      FROM product_materials pm
      JOIN raw_materials rm ON rm.material_id = pm.material_id
      WHERE pm.product_id = $1
    `, [id]);
    
    if (materialsRes.rows.length === 0) {
      // Product has no material requirements, just add stock
      await client.query('UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2', [quantity, id]);
      await client.query('COMMIT');
      
      return res.json({
        success: true,
        message: 'Stock added successfully'
      });
    }
    
    // Calculate material requirements
    const requirements = materialsRes.rows.map(row => {
      const totalReq = parseFloat(row.amount_per_unit) * parseInt(quantity);
      const current = parseFloat(row.current_stock);
      return {
        material_id: row.material_id,
        material_name: row.material_name,
        current_stock: current,
        unit: row.unit,
        amount_per_unit: parseFloat(row.amount_per_unit),
        total_required: totalReq,
        sufficient: current >= totalReq
      };
    });
    
    // Check if we have sufficient materials
    const insufficientMaterials = requirements.filter(req => !req.sufficient);
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
    for (const req of requirements) {
      await client.query(
        'UPDATE raw_materials SET current_stock = current_stock - $1 WHERE material_id = $2',
        [req.total_required, req.material_id]
      );
    }
    
    // Add stock to product
    await client.query('UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2', [quantity, id]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Stock added successfully'
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

module.exports = router;
