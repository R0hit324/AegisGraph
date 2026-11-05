# AegisGraph Security Notes — Phase 1

The authoritative security policy and disclosure process lives in
[`SECURITY.md`](../../SECURITY.md). This document explains *why* the Phase 1
controls were chosen and where their boundaries are.

## Trust boundaries of the current deployment

```text
Internet ──X── ✗ not exposed
Your machine ── localhost listeners only:
   127.0.0.1:3000 → frontend container (nginx, UID 101)
   127.0.0.1:8000 → backend container (uvicorn, UID 10001)
   (db container has NO published host port; reachable only from the
    Compose internal network)
```

## Controls and their rationale

1. **Fail-closed configuration.** `GET /api/v1/**` cannot start half-valid:
   missing `DATABASE_URL`, wildcard CORS, invalid origin scheme, or a
   production deployment on the dev secret abort startup with explicit,
   actionable errors (tested in `test_config_validation.py`).
2. **Explicit CORS allowlist.** Origins are parsed from a CSV env value;
   wildcards (`*`, `*/*`) are rejected by validator, and requests from
   unlisted origins receive no `Access-Control-Allow-Origin` header
   (tested against the live stack and in `test_cors_security.py`).
3. **Safe error responses.** Central handlers return a fixed envelope
   without stack traces or SQL text; the detail goes to structured logs
   (`test_error_handling.py` asserts sensitive content appears nowhere in
   client responses).
4. **Least privilege containers.** Backend UID 10001, frontend UID 101
   (nginx-unprivileged); neither may install packages at runtime or write
   outside its workspace.
5. **No secret-bearing frontend artifacts.** The production bundle was
   string-scanned for credential markers; only the public
   `VITE_API_BASE_URL` is embedded. Configuration guard-tests also reject
   the accidental presence of `VITE_` secrets going forward (build-time
   constants are limited by code review + tests).
6. **Host port policy.** Every published port is bound to `127.0.0.1`
   explicitly, including the *optional* database mapping.
7. **Dependency pinning & audits.** Runtime deps are pinned exactly
   (`requirements.txt`, `package-lock.json`); audits were run at Phase 1
   release (backend: no known vulnerabilities; frontend production deps:
   clean; one dev-only moderation finding documented in the Phase 1 report).

## Not yet present (do not assume otherwise)

- Authentication / authorization / sessions — the application has no user
  accounts yet. This is why localhost-first is mandatory.
- SSRF-safe outbound transport, DNS pinning, redirect validation,
  rate limiting, audit logging, tenant isolation — arrive with the modules
  that create those exposures.
- At-rest encryption for findings/reports.

Each future phase must extend this list with the controls it introduces and
prove them with tests before merging — the acceptance pattern used in
Phase 1 (test files listed in `docs/development/developer-guide.md`) is the
template.
