# Packaging Management System - Backend

A Node.js Express backend for the packaging management system with PostgreSQL database.

## Features

- **Customer Management**: CRUD operations for customers with search functionality
- **Product Management**: CRUD operations for products with pricing
- **Order Management**: Create and track orders with status updates
- **Payment Tracking**: Record advance and final payments with reference numbers
- **Order Unit Price**: Stores the unit price at the time of ordering (separate from current product price)

## Database Schema

### Orders Table
The `orders` table includes an `order_unit_price` column that stores the unit price at the time of ordering. This is important because:

- **Product prices may change over time**
- **Order prices should remain fixed** once the order is placed
- **Historical accuracy** for reporting and invoicing

### Required Database Migration

**IMPORTANT**: Before running the application, you must add the `order_unit_price` column to your orders table:

```sql
-- Connect to your database and run this migration
\c db_packaging;

-- Add the order_unit_price column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_unit_price NUMERIC(10,2);

-- Update existing orders to use the product's base_price as their order_unit_price
UPDATE orders 
SET order_unit_price = p.base_price 
FROM products p 
WHERE orders.product_id = p.product_id 
AND orders.order_unit_price IS NULL;

-- Make the column NOT NULL for future orders
ALTER TABLE orders ALTER COLUMN order_unit_price SET NOT NULL;
```

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the backend directory:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=db_packaging
   DB_USER=postgres
   DB_PASSWORD=1234
   PORT=5000
   ```

3. **Run the database migration** (see above)

4. **Start the server:**
   ```bash
   # Windows
   npm run start:win
   
   # Linux/Mac
   npm run start:unix
   ```

## API Endpoints

### Customers
- `GET /api/customers` - Get all customers
- `GET /api/customers/search?q=query` - Search customers
- `GET /api/customers/:id` - Get customer by ID
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Orders
- `GET /api/orders` - Get all orders with customer and product details
- `GET /api/orders/customer/:customerId` - Get orders by customer
- `GET /api/orders/:id` - Get order by ID with payments
- `GET /api/orders/status/:status` - Get orders by status
- `POST /api/orders` - Create new order (**requires order_unit_price**)
- `PUT /api/orders/:id/status` - Update order status
- `PUT /api/orders/:id` - Update order details
- `DELETE /api/orders/:id` - Delete order (if no payments exist)

### Payments
- `POST /api/payments` - Record payment
- `GET /api/payments/order/:orderId/summary` - Get payment summary for order

## Order Creation

When creating a new order, the API now requires the `order_unit_price` field:

```json
{
  "customer_id": 1,
  "product_id": 1,
  "delivery_date": "2024-01-15",
  "quantity": 5,
  "order_unit_price": 150.00,
  "is_custom_size": false,
  "length": null,
  "width": null,
  "height": null
}
```

This ensures that the order price is locked in at the time of creation, regardless of future product price changes.

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed error description"
}
```

## Development

The server runs on `http://localhost:5000` by default. Make sure your frontend is configured to connect to this URL.

## Database Connection

The application uses connection pooling for efficient database operations. Connection settings can be configured in `config/database.js`.