# AegisGraph Developer Guide (Phase 1 toolchain)

## Repository setup (development without Docker)

```powershell
# backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt

# frontend
cd ..\frontend
npm ci
```

Linux/macOS: `source .venv/bin/activate`.

## Daily quality gates

| Gate | Command (from respective folder) |
|---|---|
| Backend lint | `python -m ruff check app tests migrations` |
| Backend format check | `python -m ruff format --check app tests migrations` |
| Backend typing | `python -m mypy app` |
| Backend tests | `python -m pytest` |
| Dependency audit | `python -m pip_audit -r requirements.txt` |
| Frontend lint | `npm run lint` |
| Frontend types | `npx tsc --noEmit` |
| Frontend tests | `npm run test` |
| Frontend build | `npm run build` |
| Frontend prod audit | `npm audit --omit=dev` |
| Compose validation | `docker compose config` (repo root) |

All gates must pass before commit. Failures are fixed, never suppressed
(strict warning config is deliberate).

## Test layout & coverage intent

- `backend/tests/`
  - `test_config_validation.py` — fail-closed configuration (wildcard CORS,
    weak production secret, bad database URL, …)
  - `test_health_endpoints.py` — API surface + 503-on-degraded dependency
  - `test_error_handling.py` — no stack traces/SQL/credentials in responses
  - `test_database_session.py` — ORM lifecycle, constraints, rollback
  - `test_cors_security.py` — allowlist behavior, no `allow-credentials`
- `frontend/tests/`
  - `apiClient.test.ts` — URL resolution, error envelopes, no credentials
  - `WelcomePage.test.tsx` — welcome page + honest empty state
  - `AppShell.test.tsx` — navigation, version indicator, honest placeholders
  - `OverviewPage.test.tsx` — loading / online / offline states, no fake data

## Adding a migration

```powershell
cd backend
$env:DATABASE_URL="postgresql+psycopg://aegisgraph:change-me-local-dev-only@localhost:5432/aegisgraph"
.\.venv\Scripts\python.exe -m alembic revision --autogenerate -m "<message>"
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Notes:
- Every new revision requires a matching model change in `app/models`.
- Destructive migrations must preserve a documented downgrade path.
- Container startup runs `alembic upgrade head` automatically; verify locally
  first with a clean database (`docker compose down -v` in a scratch copy).

## Environment variables (Phase 1)

| Variable | Consumer | Notes |
|---|---|---|
| `APP_ENV` | backend | `development` / `production` guard rails |
| `APP_SECRET_KEY` | backend | required strong value in production |
| `APP_VERSION` | backend | reported by health endpoint |
| `LOG_LEVEL` | backend | `DEBUG…CRITICAL` |
| `DATABASE_URL` | backend, alembic | must use `postgresql+psycopg://` |
| `ALLOWED_ORIGINS` | backend | CSV allowlist; wildcard rejected |
| `POSTGRES_*` | db container, scripts | identifiers + password |
| `VITE_API_BASE_URL` | frontend build | PUBLIC value only |

## Debugging the stack

```powershell
docker compose ps                      # service health
docker logs aegisgraph-backend         # JSON application logs
docker compose exec db psql -U aegisgraph -d aegisgraph   # DB shell
docker compose exec backend alembic current               # migration state
```
