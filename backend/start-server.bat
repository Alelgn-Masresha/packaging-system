@echo off
echo Starting STEP Packaging Backend Server...
echo.
echo Make sure you have:
echo 1. PostgreSQL running
echo 2. Database 'db_packaging' created with tables
echo 3. .env file configured with correct database credentials
echo.
echo Press any key to continue...
pause > nul

echo Installing dependencies...
call npm install

echo.
echo Starting server...
echo Server will be available at: http://localhost:5000
echo API endpoints at: http://localhost:5000/api
echo Health check at: http://localhost:5000/api/health
echo.
echo Press Ctrl+C to stop the server
echo.

call npm run dev
