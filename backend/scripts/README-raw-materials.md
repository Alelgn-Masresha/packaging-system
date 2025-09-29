# Raw Materials Database Setup Instructions

## Prerequisites
- PostgreSQL database running
- Database connection configured in `backend/config/database.js`

## Setup Steps

### 1. Run the SQL Script
Execute the SQL script to create the `raw_materials` table and sample data:

```sql
-- Copy and paste the contents of backend/scripts/create-raw-materials-table.sql
-- into your PostgreSQL client (pgAdmin, psql, etc.)
```

### 2. Start the Backend Server
```bash
cd backend
npm start
```

### 3. Test the API
The following endpoints should be available:
- `GET http://localhost:5000/api/raw-materials` - Get all materials
- `GET http://localhost:5000/api/raw-materials/low-stock/all` - Get low stock materials
- `POST http://localhost:5000/api/raw-materials` - Create new material

### 4. Access the Frontend
Navigate to the Inventory Management page in your application to see the real data from the database.

## Sample Data Included
The script includes 8 sample materials:
- Tissue Paper (Paper category)
- A4 Paper (Paper category) - Low Stock
- Transparent Plastic (Plastic category)
- Cardboard Sheets (Paper category)
- Adhesive Tape (Adhesive category)
- Bubble Wrap (Protection category)
- Ink Cartridge (Ink category)
- Staples (Fasteners category)

## Features
- Automatic status calculation (Available/Low Stock/Out of Stock)
- Real-time stock level monitoring
- Category-based organization
- Search and filter functionality
- CRUD operations via API
