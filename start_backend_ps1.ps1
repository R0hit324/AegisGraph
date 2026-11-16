param([int]$Port=8000)

# Set environment variables
$env:APP_ENV = "test"
$env:APP_VERSION = "0.2.0-demo"
$env:APP_SECRET_KEY = "demo-secret-key-live-run-e4a1f2b9c7d8"
$env:DATABASE_URL = "sqlite:///E:/AegisGraph/backend/demo.db"
$env:ALLOWED_ORIGINS = "http://localhost:3000"
$env:PYTHONPATH = "E:\AegisGraph\backend"

Write-Host "Starting AegisGraph backend on port $Port ..." -ForegroundColor Green

& ".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port $Port