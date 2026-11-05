# AegisGraph

**Unified Attack Surface Discovery & Website Security Assessment Platform**

AegisGraph is a professional cybersecurity platform that is being built phase by
phase. When complete, it will let authorized operators define asset scopes,
discover public-facing assets, assess website security configuration, correlate
external vulnerability intelligence, calculate explainable risk priorities, and
visualize the relationships between assets — with **every finding backed by
collected evidence**.

> **Current status: Phase 1 — Project Foundation (complete).**
> AegisGraph is a **localhost-first, self-hosted** application. All data stays
> in your local PostgreSQL database unless *you* explicitly configure an
> external service that transmits data.

---

## 1. Planned capabilities (not yet implemented unless stated)

| Capability | Status |
|---|---|
| Application foundation (FastAPI + React + PostgreSQL) | ✅ Phase 1 |
| Local deployment via Docker Compose | ✅ Phase 1 |
| Health / readiness monitoring | ✅ Phase 1 |
| Database persistence, migrations, backup & restore | ✅ Phase 1 |
| Application shell (navigation, overview, connection status) | ✅ Phase 1 |
| Scope & organization management | Planned (Phase 2) |
| Asset inventory & discovery (DNS, HTTP, certificate data) | Planned (Phase 3) |
| Website security assessment | Planned (Phase 4) |
| Findings management | Planned (Phase 5) |
| External intelligence (CISA KEV, OSV, …) | Planned (Phase 6) |
| Asset relationship graph | Planned (Phase 7) |
| Risk prioritization | Planned (Phase 8) |
| Reporting | Planned (Phase 9) |
| Authentication & user management | Planned (later phase) |

Navigation items visible in the UI are honest placeholders — each states which
phase will make it operational. No simulated data, fake scan results, or
invented metrics exist anywhere in the application.

## 2. Architecture overview

```text
┌────────────────┐    HTTP /api/v1    ┌────────────────┐    psycopg     ┌──────────────┐
│   Frontend     │ ─────────────────▶ │    Backend     │ ─────────────▶ │  PostgreSQL  │
│ React + Vite   │                    │  FastAPI       │                │  volume-     │
│ nginx (3000)   │                    │  uvicorn(8000) │                │  persisted   │
└────────────────┘                    └────────────────┘                └──────────────┘
        browser  ◀──── /api/v1/health (status + database + version) ──────┘
```

- `frontend/` — React 19 + TypeScript + Vite + Tailwind CSS v4. Static build
  served by an unprivileged nginx container with an SPA fallback.
- `backend/` — FastAPI + Pydantic v2 settings + SQLAlchemy 2.x + Alembic.
  Rules-based routes: thin handlers, service layer, centralized error
  envelope (`{"error": {"code", "message"}}`), JSON structured logging.
- `db` — PostgreSQL 17, port not published to the host by default, persistent
  Docker volume `aegisgraph_pgdata`.

Detailed notes: [`docs/architecture/overview.md`](docs/architecture/overview.md).

## 3. Technology stack (verified versions)

| Layer | Technology | Version |
|---|---|---|
| Frontend | React | 19.3.1 |
| | TypeScript | 6.0.3 |
| | Vite | 8.3.6 |
| | Tailwind CSS | 4.3.4 |
| | React Router | 7.18.5 |
| | Vitest / Testing Library | 5.1.0 / 16.3.3 |
| Backend | Python | 3.13 (3.13.15 locally verified) |
| | FastAPI | 0.162.0 |
| | Pydantic / pydantic-settings | 2.14.3 / 2.16.2 |
| | SQLAlchemy / Alembic | 2.1.8 / 1.20.1 |
| | psycopg (PostgreSQL driver) | 3.3.8 |
| | Pytest / ruff / mypy | 9.2.0 / 0.17.3 / 2.4.1 |
| Database | PostgreSQL (Docker) | 17.5-alpine |
| Runtime | Docker / Compose | 29.7.2 / v5.5.1 |

All runtime dependencies are pinned in `backend/requirements.txt` and
`frontend/package-lock.json`.

## 4. Project directory structure

```text
AegisGraph/
├── frontend/                 # React SPA (Vite build → unprivileged nginx)
│   ├── src/                  # app/, components/, layouts/, pages/, services/, hooks/, styles/
│   ├── tests/                # Vitest + React Testing Library suites
│   ├── Dockerfile, nginx.conf
│   └── package.json
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── api/              # /api/v1 router + routes (health)
│   │   ├── config/           # validated settings (pydantic-settings)
│   │   ├── core/             # logging, centralized exceptions
│   │   ├── database/         # engine, session lifecycle, Base
│   │   ├── models/           # ORM models (Phase 1: app_metadata only)
│   │   ├── schemas/          # request/response models (Pydantic)
│   │   ├── services/         # health check service
│   │   └── main.py           # application factory
│   ├── migrations/           # Alembic (env.py + versions/)
│   ├── tests/                # pytest suites (unit + security tests)
│   ├── Dockerfile
│   └── requirements.txt
├── docs/
│   ├── architecture/         # design notes
│   ├── development/          # developer workflow & quality gates
│   └── security/             # security-related documentation
├── scripts/
│   ├── backup-database.ps1   # Windows backup (authoritative)
│   ├── restore-database.ps1  # Windows restore (destructive, confirmed)
│   ├── backup-database.sh    # Linux/macOS backup
│   └── restore-database.sh   # Linux/macOS restore (destructive, confirmed)
├── docker-compose.yml        # frontend + backend + db with healthchecks
├── .env.example              # configuration template (copy to .env)
├── README.md                 # this file
├── SECURITY.md               # vulnerability reporting, security baseline
├── CONTRIBUTING.md           # phase-by-phase contributing rules
└── LICENSE                   # MIT
```

## 5. Prerequisites

- **Docker Desktop** (Docker Engine + Compose v2 plugin)
  - Windows: [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
  - macOS: same link (Apple Silicon supported) or `brew install --cask docker`
  - Linux: `sudo apt-get install docker.io docker-compose-plugin` (or
    Engine + compose plugin from Docker's repository)
- **Git**
- Optional (for local, non-Docker development only): Python 3.13, Node.js ≥ 20

## 6. Installation & quick start

### Windows PowerShell

```powershell
# 1. Clone / extract the repository
git clone <repository-url> AegisGraph
cd AegisGraph

# 2. Create your environment configuration
Copy-Item .env.example .env
notepad .env            # review — dev defaults are safe for localhost

# 3. Start everything
docker compose up --build -d

# 4. Verify
docker compose ps
```

### Linux / macOS (bash)

```bash
git clone <repository-url> AegisGraph
cd AegisGraph

cp .env.example .env
nano .env

docker compose up --build -d
docker compose ps
```

### Access points

| What | URL |
|---|---|
| Frontend application | <http://localhost:3000> |
| Backend API | <http://localhost:8000> |
| API documentation (Swagger) | <http://localhost:8000/docs> |
| Health endpoint | <http://localhost:8000/api/v1/health> |

> **Note for this machine (Known Issue):** if another development server also
> listens on `localhost:3000` (IPv6 `:::3000`), use
> <http://127.0.0.1:3000> — AegisGraph binds `127.0.0.1:3000` (IPv4) explicitly.
> Once the other server is stopped, plain `localhost` resolves to AegisGraph.

## 7. Stopping & restarting

```powershell
docker compose stop       # stop containers (data retained)
docker compose start      # start again (data retained)
docker compose down       # stop + remove containers (DATA RETAINED — no -v!)
```

**Never** run `docker compose down -v` in normal shutdown: the `-v` flag
removes the PostgreSQL volume and **deletes all collected data**. Use it only
for a deliberate destructive reset.

## 8. Database persistence

- Data is stored in the Docker volume `aegisgraph_aegisgraph_pgdata`.
- `stop` / `start` / `restart` / `down` + `up` all preserve data (verified in
  Phase 1 testing).
- Migrations run automatically each backend start (`alembic upgrade head`);
  they are idempotent and safe on restart.

## 9. Database backup & restore

Backup files are written to `backups/` (git-ignored — treat them as sensitive).

### Windows PowerShell

```powershell
# Backup (creates backups\aegisgraph_backup_<timestamp>.sql)
powershell -ExecutionPolicy Bypass -File scripts\backup-database.ps1

# Restore (DESTRUCTIVE — asks you to type RESTORE first)
powershell -ExecutionPolicy Bypass -File scripts\restore-database.ps1 `
    -BackupPath .\backups\aegisgraph_backup_<timestamp>.sql
# Add -Force to skip the typed confirmation.
```

### Linux / macOS

```bash
./scripts/backup-database.sh

./scripts/restore-database.sh backups/aegisgraph_backup_<timestamp>.sql   # asks for confirmation
./scripts/restore-database.sh backups/aegisgraph_backup_<timestamp>.sql --force
```

Both scripts read database identification from `.env`, run the dump/restore
*inside* the database container (no credentials cross the wire and none are
printed), and verify the file header after writing/restore.

## 10. API documentation

Interactive OpenAPI (Swagger UI): <http://localhost:8000/docs>
ReDoc: <http://localhost:8000/redoc>
Machine-readable schema: <http://localhost:8000/openapi.json>

Phase 1 endpoints:

- `GET /` — application metadata
- `GET /api/v1/health` — `{status, application, version, environment, database, timestamp}`; 200 when healthy, 503 when the database is unreachable
- `GET /api/v1/health/live` — liveness (in-process only)
- `GET /api/v1/health/ready` — readiness (all dependencies reachable)

## 11. Troubleshooting

| Symptom | Cause & fix |
|---|---|
| `docker compose up` refuses to start (missing config) | `.env` missing. Run `Copy-Item .env.example .env` (or `cp .env.example .env`). |
| Backend restarts, log shows `DATABASE_URL … Field required` | `.env` not loaded by Compose — run `docker compose` from the repository root. |
| `localhost:3000` shows another application | Another dev server owns IPv6 `:::3000`. Use `http://127.0.0.1:3000` or stop the other project. |
| Backend unhealthy | `docker logs aegisgraph-backend` for the exact failure; usually DB not yet ready (wait, healthcheck retries 5×). |
| Port 8000 already in use on host | Change the left-hand value in `docker-compose.yml` (`127.0.0.1:8000:8000` → `127.0.0.1:8001:8000`) and set `VITE_API_BASE_URL=http://localhost:8001` before rebuild. |
| Persistent DB corruption | Deliberate destructive reset: `docker compose down -v && docker compose up --build -d`, or restore a backup. |
| Database access wanted from host tools | Uncomment the `127.0.0.1:5432:5432` mapping in `docker-compose.yml` (note: another local PostgreSQL may already own host port 5432 — adjust the port then). |

## 12. Security considerations

- The database is **not** published to the host network by default.
- Every host port published by this stack binds explicitly to `127.0.0.1`.
- Frontend `VITE_*` variables are compiled into public browser JavaScript —
  only `VITE_API_BASE_URL` (public URL) is ever set that way.
- Production guard: with `APP_ENV=production` the backend refuses to start on
  the development secret or an empty CORS allowlist.
- There is **no authentication yet in Phase 1**. Do not expose AegisGraph
  beyond your own machine until that phase lands.

Full security policy, responsible disclosure, and the current
implemented/not-implemented control matrix: **[SECURITY.md](SECURITY.md)**.

## 13. Development (running without Docker)

```powershell
# Backend (Windows PowerShell)
Copy-Item .env.example .env
# Point DATABASE_URL at localhost for non-container runs:
#   DATABASE_URL=postgresql+psycopg://<user>:<pw>@localhost:5432/aegisgraph
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm ci
npm run dev        # http://localhost:3000
```

Linux/macOS use `source .venv/bin/activate` instead.

## 14. Quality gates (run before every change)

```powershell
# Backend, from backend\
.\.venv\Scripts\python.exe -m ruff check app tests migrations
.\.venv\Scripts\python.exe -m ruff format --check app tests migrations
.\.venv\Scripts\python.exe -m mypy app
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m pip_audit -r requirements.txt

# Frontend, from frontend\
npm run lint
npx tsc --noEmit
npm run test
npm run build
npm audit --omit=dev
```

Details: [`docs/development/developer-guide.md`](docs/development/developer-guide.md).

## 15. Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)** — security-first workflow, hard
phase boundaries, mandatory tests, and the definition of done.

## 16. License

MIT — see **[LICENSE](LICENSE)**.
