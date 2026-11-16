import subprocess
result = subprocess.run(
    [r'E:\AegisGraph\backend\.venv\Scripts\python.exe', '-c', 'import sys; print("\\n".join(sys.path))'],
    capture_output=True, text=True, cwd='E:\AegisGraph\backend'
)
print('STDOUT:', result.stdout)
print('STDERR:', result.stderr)