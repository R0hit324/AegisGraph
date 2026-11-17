# AegisGraph — Phase 3 Verification Status

**Date:** November 17, 2026
**Branch:** `master`
**Purpose:** Factual record of what was verified, what could not be verified, and what verification remains. This document supersedes the completion claim in `PHASE3_COMPLETION_REPORT.md` — full Phase 3 completion is **not yet claimed**.

---

## 1. Checks actually executed and their results

All commands were run locally on this machine against the working tree.

### Frontend (`frontend/`)

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | 0 errors (exit 0) |
| Lint | `npm run lint` | 0 problems (exit 0) |
| Unit tests | `npm run test` (vitest) | **7 files, 35/35 tests passed** |
| Production build | `npm run build` | Success — `dist/` built, `index-*.js` 363.69 kB (gzip 107.74 kB) |

### Backend (`backend/`, via local `.venv`)

| Check | Command | Result |
|---|---|---|
| App import | `python -c "import app.main"` (with `DATABASE_URL`, `SECRET_KEY`, `ALLOWED_ORIGINS` env vars set) | OK (exit 0) |
| Test suite | `python -m pytest -q` | **36/36 passed** (config-validation 12, CORS 5, database-session 5, error-handling 4, health 7, phase2-reads 3) |
| Migrations | `alembic upgrade head` inside Docker | All 3 migrations (`0001`–`0003`) applied cleanly against a fresh Postgres 17.5 volume, verified via container logs |

---

## 2. Defects repaired during this verification pass

### Frontend
- `App.tsx`: restored missing `=` in `<Navigate to="/app/overview">`.
- Phase 3 pages (`DiscoveryJobs`, `AssetInventory`, `DiscoveryConfig`, `DiscoveryDashboard`, `AssetDetails`) rewritten onto the established Phase 2 patterns (`OrgPicker` + keyed `useResource`, render-derived fallback org).
- Added `frontend/src/schemas/discovery.ts` mirroring backend Pydantic schemas; rewrote `discoveryService.ts` to the throwing `Promise<T>` contract; fixed Python-isms (`.rsplit`).
- Extended `Primitives.tsx` additively: `Tabs`/`Tab`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableCell`; `Badge.className`; `Button` outline variant + small size; `EmptyState` optional `children`/`description`. Unused `Form`/`Input` drafts were removed to keep the no-duplication rule (pages use the existing `TextInput`/`Field`).
- Tests: session mocks added to `AppShell`/`OverviewPage`/`WelcomePage` tests; `apiClient.test.ts` credentials assertion corrected to `credentials: "include"` (HttpOnly-cookie session architecture).

### Backend
- Migrations `0002`/`0003`: missing `Sequence`/`ForeignKey` imports; duplicate index names (`ix_users_email`, `ix_scopes_domain_pattern` created twice via inline `index=True` + explicit `create_index`); boolean `server_default=sa.text("0"/"1")` → `"true"/"false"`.
- `app/api/v1.py` (module) shadowed the `app/api/v1/` package: replaced by `app/api/v1/__init__.py` aggregator.
- `app/models/discovery.py`: added missing `func` import; removed five `back_populates`/relationship declarations that pointed at properties that never existed (`Organization.discovery_jobs`, `Organization.assets`, `Scope.discovery_jobs`, `Asset.outgoing_relationships`/`incoming_relationships`) and one relationship with no FK (`DiscoveryJob.audit`). These made ORM mapper configuration fail with `InvalidRequestError`. All remaining `back_populates` pairs are verified reciprocal; no application code referenced the removed relationships.
- `app/api/v1/discovery.py`: removed unused schema imports.
- `requirements.txt`: added missing runtime dependencies `bcrypt==5.0.0`, `python-jose==3.5.0`, `python-multipart==0.0.33`.

---

## 3. Docker build and runtime verification — PENDING

`docker compose up -d --build` could **not** be completed on this machine due to infrastructure failures, not code failures:

- Docker Hub connectivity failures: `lookup registry-1.docker.io: getaddrinfow` (DNS) and `net/http: TLS handshake timeout` when pulling `python:3.13-slim` / `node:24-alpine`.
- PyPI connectivity failures: each build attempt failed on a **different random pin** (`psycopg-binary==3.3.8`, `idna==3.20`, `pydantic_core==2.50.4`) with `Could not find a version ... (from versions: none)`. These packages were verified via the PyPI JSON API to exist with Python 3.13 wheels and are not yanked — the failures are transient index connectivity, not missing packages. The backend image built successfully earlier with these same pins.
- Docker Desktop daemon also dropped and was restarted mid-session.

What Docker verification **did** confirm before the network blocked builds:
- `docker compose config --quiet` passes.
- The `db` service reaches `healthy`.
- `alembic upgrade head` runs all migrations cleanly on a fresh volume.
- `app.main` imports (failure points found were fixed iteratively).

**Still outstanding:** a clean `docker compose up -d --build` on a network with stable Docker Hub/PyPI access, followed by `docker compose ps` showing backend healthy, and HTTP checks of `/api/v1/health/live`, `/ready`, and the frontend on port 3000.

---

## 4. Remaining functional and security verification

Not yet executed (requires the running stack or explicit follow-up):

1. **Browser verification** of Phase 3 screens: `/app/discovery/config`, `/app/discovery/jobs`, `/app/discovery/assets`, `/app/discovery/asset-details/:id`, `/app/dashboard`, plus the register/login flow and responsive behavior.
2. **End-to-end API verification** of discovery endpoints against a live backend (job lifecycle: create → run → cancel; asset listing/filtering; observation endpoints). Note: the repository currently contains **no dedicated Phase 3 backend test module** — the 36 passing backend tests cover Phase 1/2 (config, CORS, DB session, errors, health, Phase 2 reads). Phase 3 API coverage rests on the passing import check, migrations, and frontend unit tests.
3. **Security review items** (recommended before sign-off): rate-limit behavior on discovery endpoints, org-boundary enforcement tests for Phase 3 routes, JWT/session expiry against discovery endpoints, and CORS coverage for the discovery router.
4. `pip-audit` / dependency vulnerability scan is recommended after the `requirements.txt` changes (per the file's own policy comment).

---

## 5. Known repository hygiene notes (pre-existing, not touched)

- `backend/demo.db` is a tracked binary artifact committed in an earlier commit (not modified in this pass; candidate for removal from tracking in a future cleanup).
- `PHASE3_COMPLETION_REPORT.md` (committed earlier) describes Phase 3 as complete; this document corrects that claim until the pending Docker runtime and browser verification are done.
