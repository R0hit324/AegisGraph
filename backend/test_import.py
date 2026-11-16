import sys
sys.path.insert(0, '.')
from app.main import app
print('App imported successfully')
routes = [(r.path, getattr(r, 'methods', 'no methods')) for r in app.routes if hasattr(r, 'path')]
for path, methods in routes[:20]:
    print(f'{path}: {methods}')