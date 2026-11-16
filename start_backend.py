import os
import subprocess
import sys

os.environ['APP_ENV'] = 'test'
os.environ['APP_VERSION'] = '0.2.0-demo'
os.environ['APP_SECRET_KEY'] = 'demo-secret-key-live-run-e4a1f2b9c7d8'
os.environ['DATABASE_URL'] = 'sqlite:///E:/AegisGraph/backend/demo.db'
os.environ['ALLOWED_ORIGINS'] = 'http://localhost:3000'
os.environ['PYTHONPATH'] = r'E:\AegisGraph\backend'

proc = subprocess.Popen(
    [r'\.venv\Scripts\python.exe', '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'],
    cwd=r'E:\AegisGraph\backend',
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
)

# Print first 10 lines
for _ in range(10):
    line = proc.stdout.readline().decode('utf-8', errors='replace')
    print(line, end='')
    if not line.strip():
        break

print(f"\nProcess running PID={proc.pid}")
print("Visit: http://127.0.0.1:8000")
print("Press Ctrl+C to stop")

# Wait for process
proc.wait()