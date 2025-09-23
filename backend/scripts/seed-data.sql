-- Sample data for STEP Packaging & Printing System
-- Run this script in pgAdmin 4 after creating the database and tables

-- Insert sample customers
INSERT INTO customers (name, phone, address) VALUES
('John Doe', '0912345678', 'Addis Ababa, Ethiopia'),
('Jane Smith', '0987654321', 'Bahir Dar, Ethiopia'),
('Mike Johnson', '0911111111', 'Hawassa, Ethiopia'),
('Sarah Wilson', '0922222222', 'Dire Dawa, Ethiopia'),
('Ahmed Hassan', '0933333333', 'Mekele, Ethiopia');

-- Insert sample products
INSERT INTO products (name, standard_size, base_price) VALUES
('Box', '20×10×5', 50.00),
('Label', 'A4', 5.00),
('Bag', 'Medium', 40.00),
('Envelope', 'Standard', 2.00),
('Flyer', 'A5', 1.50);

-- Insert sample orders
INSERT INTO orders (customer_id, product_id, delivery_date, quantity, is_custom_size, length, width, height, status) VALUES
(1, 1, '2024-02-15', 150, false, null, null, null, 'In Progress'),
(2, 2, '2024-02-20', 500, false, null, null, null, 'Pending'),
(3, 3, '2024-02-10', 75, false, null, null, null, 'Completed'),
(1, 1, '2024-01-25', 100, true, 30.0, 20.0, 10.0, 'Delivered'),
(4, 2, '2024-02-18', 200, false, null, null, null, 'In Progress'),
(5, 3, '2024-02-22', 50, false, null, null, null, 'Pending');

-- Insert sample payments
INSERT INTO payments (order_id, amount, payment_date, reference_number, type) VALUES
(1, 3000.00, '2024-01-15', 'REF001234', 'Advance'),
(1, 4500.00, '2024-02-01', 'REF001235', 'Final'),
(3, 3000.00, '2024-01-10', 'REF001236', 'Advance'),
(3, 0.00, '2024-02-10', 'REF001237', 'Final'),
(4, 5000.00, '2024-01-20', 'REF001238', 'Advance'),
(4, 0.00, '2024-01-25', 'REF001239', 'Final'),
(5, 500.00, '2024-02-10', 'REF001240', 'Advance');

-- Optional: Insert sample user (for future authentication)
INSERT INTO users (username, password) VALUES
('admin', '$2b$10$rQZ8K9L2mN3oP4qR5sT6uV7wX8yZ9aB0cD1eF2gH3iJ4kL5mN6oP7qR8sT9uV'); -- password: admin123

-- Verify data insertion
SELECT 'Customers' as table_name, COUNT(*) as record_count FROM customers
UNION ALL
SELECT 'Products', COUNT(*) FROM products
UNION ALL
SELECT 'Orders', COUNT(*) FROM orders
UNION ALL
SELECT 'Payments', COUNT(*) FROM payments
UNION ALL
SELECT 'Users', COUNT(*) FROM users;
