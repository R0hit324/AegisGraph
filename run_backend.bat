@echo off
setlocal
set APP_ENV=test
set APP_VERSION=0.2.0-demo
set APP_SECRET_KEY=demo-secret-key-live-run-e4a1f2b9c7d8
set DATABASE_URL=sqlite:///E:/AegisGraph/backend/demo.db
set ALLOWED_ORIGINS=http://localhost:3000
set PYTHONPATH=E:\AegisGraph\backend
set PORT=8000

:retry
echo Starting AegisGraph backend on port %PORT%...
call .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port %PORT%
if errorlevel 1 (
    echo Port %PORT% is busy, waiting 5 seconds...
    timeout /t 5 /nobreak >nul
    set /a PORT=%%PORT%+1
    if %PORT% GTR 8010 (
        echo No available ports found.
        exit /b 1
    )
    goto retry
)

echo AegisGraph backend started on http://127.0.0.1:%PORT%
echo.
echo Press CTRL+C to quit
timeout /t 3600 /nobreak >nul