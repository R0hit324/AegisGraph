# AegisGraph Architecture Overview

Version: Phase 1 · Last updated: 2026-11-05

## Design goals

1. **Local-first & self-hosted** — one codebase, no SaaS assumptions, data in
   a local PostgreSQL volume.
2. **Modular boundaries** — future domain capabilities (discovery, assessment,
   correlation, risk, reports) attach as isolated modules, never as site-wide
   edits.
3. **Security by design** — explicit allowlists, validated configuration,
   non-root containers, no default secrets, safe error envelopes.
4. **Evidence over assumptions** — Phase 1 contains no simulated results, and
   the frontend renders only data returned by real endpoints.

## Runtime topology

```text
[Browser]
   │  http://localhost:3000 (nginx, unprivileged UID 101, static SPA)
   ▼
[frontend container]  ── fetch ──▶  http://localhost:8000/api/v1/** (host-published)
                                        │
                              [backend container]
                              FastAPI / uvicorn, UID 10001
                              lifespan: alembic upgrade head → serve
                                        │ SQL over internal network
                              [db container]
                              postgres:17.5-alpine, no host port,
                              volume aegisgraph_pgdata, healthcheck pg_isready
```

Startup order is enforced by Compose `depends_on: service_healthy`:
db → backend → frontend.

## Backend layering

```text
app/
├── api/v1.py            # versioned router (/api/v1)
│   └── routes/health.py # thin handlers; logic delegated
├── services/            # business logic (health_service.py)
├── schemas/             # Pydantic request/response contracts
├── models/              # SQLAlchemy ORM models (Base adds UTC timestamps)
├── database/            # engine, session factory, get_db dependency
├── config/              # pydantic-settings: strict startup validation
│                        #   - CORS wildcard rejected
│                        #   - production requires strong APP_SECRET_KEY
│                        #   - DATABASE_URL scheme enforced (SQLite only in test env)
└── core/                # JSON struct-logging (secret-scrubbing) + error handlers
```

### Error contract

Every error response is:

```json
{ "error": { "code": "<machine_code>", "message": "<safe message>" } }
```

Validation failures additionally carry a sanitized `details` array. Stack
traces and SQL statements are logged internally (JSON to stdout) and never
returned to clients.

### Health endpoints

| Route | Purpose | Failure behavior |
|---|---|---|
| `GET /api/v1/health` | aggregated health, DB probe | 503 + `database: unavailable` |
| `GET /api/v1/health/live` | liveness (no dependencies) | — |
| `GET /api/v1/health/ready` | readiness probe | 503 when DB unreachable |

The backend container healthcheck uses `/health/live`; Compose readiness
propagation uses `/health/ready`.

## Database

- PostgreSQL 17 (alpine), single volume `aegisgraph_pgdata`.
- Phase 1 schema: `app_metadata` (id, key unique, value, created_at,
  updated_at) — minimal infrastructure to (a) verify the migration workflow,
  (b) record initialization state, (c) give backup/restore real records.
- `alembic upgrade head` runs at container start, idempotent.
- The domain schema (organizations, scopes, assets, observations,
  vulnerabilities, findings, relationships, runs, history, provider runs) is
  intentionally **not** built yet — later phases add migrations.

## Frontend layering

```text
src/
├── app/          # route-agnostic definitions: navigation config, ConnectionContext
├── layouts/      # AppShell (sidebar + topbar + outlet + status pill)
├── pages/        # WelcomePage, app/OverviewPage, app/ModulePlaceholderPage, SettingsPage
├── components/   # Logo, ui/Primitives (Card, Badge, Button, Status…)
├── services/     # apiClient (timeout, typed ApiError), healthService
├── hooks/        # useBackendHealth (poll 30s), useConnection
├── types/        # mirrored API types
└── styles/       # Tailwind v4 @theme tokens — the only raw colors in the app
```

Honesty rules enforced in code and tests:

- The Overview page renders **only** live health data; a guard test asserts no
  fabricated asset/metrics strings exist.
- Placeholder module pages state the delivering phase and are labeled
  `not yet operational`.

## Extension points for later phases (boundaries, not placeholders)

- `backend/app/discovery|assessment|correlation|risk|reports/` directory slots
  will be created when each phase begins, keeping module separation explicit.
- `/api/v1` prefix is versioned: breaking changes add `v2` rather than mutate
  contract-frozen routes.
- `app_metadata` keys are available for infrastructure bookkeeping (e.g.,
  `schema_initialized`), not user data.

## Known deviations / trade-offs (Phase 1)

- `uvicorn.access` switched off: uvicorn access lines are plain text; JSON
  app logs come from `app.*` loggers. Request logging can return as structured
  entries when an audit phase needs it.
- CSP on the frontend container allows `connect-src localhost:8000`; if the
  deployment changes host/port, update `frontend/nginx.conf`.
- Backend runs sync SQLAlchemy + sync pg driver (psycopg3). Asyncio DB would
  be premature for Phase 1; discovery phases can revisit this decision per
  module.
