param($Port=8000)

Write-Host "Starting AegisGraph backend on port $Port ..." -ForegroundColor Green

$env:APP_ENV = "test"
$env:APP_VERSION = "0.2.0-demo"
$env:APP_SECRET_KEY = "demo-secret-key-live-run-e4a1f2b9c7d8"
$env:DATABASE_URL = "sqlite:///E:/AegisGraph/backend/demo.db"
$env:ALLOWED_ORIGINS = "http://localhost:3000"
$env:PYTHONPATH = "E:\AegisGraph\backend"

$python = "E:\AegisGraph\.venv\Scripts\python.exe"
$module = "uvicorn.app.main"
$host = "127.0.0.1"
$args = @("--port", $Port)

Write-Host "Starting server..." -ForegroundColor Cyan
& $python -m $module --host $host --port $Port 2>&1 | Write-Host

Write-Host "Server running at http://$host:$Port" -ForegroundColor Green
Write-Host "Press CTRL+C to quit" -ForegroundColor DarkYellow

# Wait indefinitely
Do {
    Start-Sleep 1
} Until ($false)