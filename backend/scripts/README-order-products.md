# Order Products Migration Guide

## Overview
This migration adds support for multiple products per order by introducing the `order_products` join table.

## Database Changes

### New Table: `order_products`
Stores the relationship between orders and products with quantity and pricing information.

**Columns:**
- `order_id` - Foreign key to orders
- `product_id` - Foreign key to products
- `quantity` - Quantity of this product
- `order_unit_price` - Unit price at time of order
- `amount_per_unit` - Optional custom amount for raw material calculation

**Primary Key:** `(order_id, product_id)`

### Removed from `orders` table:
- `product_id`
- `quantity`
- `order_unit_price`
- `amount_per_unit`

These columns are now in the `order_products` table.

## Migration Steps

### 1. Create the new table
```sql
\i backend/scripts/create-order-products-table.sql
```

### 2. Backfill existing data (if you haven't dropped columns yet)
```sql
\i backend/scripts/migrate-orders-to-order-products.sql
```

### 3. Drop old columns from orders table
```sql
ALTER TABLE orders 
  DROP COLUMN IF EXISTS product_id,
  DROP COLUMN IF EXISTS quantity,
  DROP COLUMN IF EXISTS order_unit_price,
  DROP COLUMN IF EXISTS amount_per_unit;
```

## API Changes

### GET /orders
**Response:** Each order now includes a `products` array:
```json
{
  "order_id": 1,
  "customer_id": 1,
  "delivery_date": "2024-01-15",
  "products": [
    {
      "product_id": 5,
      "product_name": "Box Type A",
      "quantity": 100,
      "order_unit_price": 5.50,
      "amount_per_unit": null
    },
    {
      "product_id": 7,
      "product_name": "Box Type B",
      "quantity": 50,
      "order_unit_price": 7.25,
      "amount_per_unit": null
    }
  ],
  // Legacy fields for backward compatibility (first product only)
  "product_id": 5,
  "product_name": "Box Type A",
  "quantity": 100,
  "order_unit_price": 5.50
}
```

### POST /orders
**New format (multiple products):**
```json
{
  "customer_id": 1,
  "delivery_date": "2024-01-15",
  "products": [
    {
      "product_id": 5,
      "quantity": 100,
      "order_unit_price": 5.50,
      "amount_per_unit": null
    },
    {
      "product_id": 7,
      "quantity": 50,
      "order_unit_price": 7.25
    }
  ],
  "is_custom_size": false
}
```

**Legacy format (single product, still supported):**
```json
{
  "customer_id": 1,
  "product_id": 5,
  "quantity": 100,
  "order_unit_price": 5.50,
  "delivery_date": "2024-01-15",
  "is_custom_size": false
}
```

### Material Calculations
- The system now calculates material requirements for ALL products in an order
- Stock is checked and deducted for each product's materials
- On cancellation, materials for all products are restored

## Frontend Updates Needed

The frontend needs to be updated to:
1. Handle the `products` array when displaying orders
2. Support adding multiple products when creating an order
3. Calculate totals across all products in an order

## Backward Compatibility

- Legacy single-product API format is still supported for creating orders
- GET responses include legacy fields (`product_id`, `quantity`, etc.) populated with the first product for backward compatibility
- Existing frontend code will continue to work, but won't show multiple products per order until updated

