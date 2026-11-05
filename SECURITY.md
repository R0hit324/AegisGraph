# AegisGraph Security Policy

## 1. Security Principles

AegisGraph is a cybersecurity platform. Its own security posture must match the
quality users expect from such a product:

- **Security from day one.** Every phase of development evaluates security before
  and after implementation — never only in a final audit.
- **Evidence over assumptions.** Findings shown to users must be backed by
  collected data. The same standard applies to this project's own claims.
- **Local-first data ownership.** All collected data stays in a local PostgreSQL
  database unless the user explicitly configures an external service.
- **Least privilege.** Containers run as non-root users where practical, the
  database is not exposed to the host network by default, and host port
  publishing (where enabled) binds to `127.0.0.1` only.
- **Explicit configuration.** CORS is an explicit allowlist (wildcards are
  rejected at startup), secrets are supplied via environment variables, and
  missing or invalid configuration fails fast at startup.
- **Safe errors.** Error responses never include stack traces, database
  credentials, or internal infrastructure details. Exceptions are logged
  internally with full context instead.

## 2. Reporting a Vulnerability (Responsible Disclosure)

**Do not open a public GitHub issue for a suspected security vulnerability.**

Please report privately:

1. Use GitHub's **"Report a vulnerability"** feature (Security tab → Advisories)
   on the repository, **or**
2. Contact the project maintainer directly via the contact channel listed in
   the repository profile.

Please include:

- A description of the issue and its potential impact.
- Reproduction steps or a proof of concept.
- The version/commit you tested against.

We aim to acknowledge reports within 5 business days. Please give us a
reasonable time window to publish a fix before making details public.

## 3. Secret Handling

- Secrets live only in the local `.env` file (git-ignored). `.env.example`
  contains placeholders with safe local dev defaults only.
- Generate a strong secret for `APP_SECRET_KEY`:
  `python -c "import secrets; print(secrets.token_urlsafe(48))"`
- The backend **refuses to start** with the development default secret or an
  empty CORS allowlist when `APP_ENV=production`.
- Frontend build-time variables (`VITE_*`) are **public** — they are compiled
  into the browser bundle. Never place API keys, database passwords, or private
  credentials in them. Only `VITE_API_BASE_URL` (a public URL) is used.
- Backup files (`scripts/`, `backups/`) contain a full copy of your database.
  They are git-ignored; store them on encrypted media if they hold sensitive
  data.
- Do not paste secrets into logs or bug reports. Log output is designed to
  exclude secret configuration values, but be careful with manual debugging.

## 4. Local Deployment Security Posture

What is **implemented** in Phase 1:

| Control | Status |
|---|---|
| Explicit CORS allowlist, wildcard rejected | ✅ Implemented |
| Startup validation of configuration | ✅ Implemented |
| Refuse default secret_key in production | ✅ Implemented |
| Non-root Docker users (backend, frontend) | ✅ Implemented |
| PostgreSQL published ports disabled by default | ✅ Implemented |
| Host-exposed ports bound to `127.0.0.1` | ✅ Implemented |
| Safe error responses (no stack traces / secrets) | ✅ Implemented |
| Structured logs without secrets | ✅ Implemented |
| Pinned dependency versions | ✅ Implemented |
| Automated test suite incl. security tests | ✅ Implemented |

What is **not yet implemented** (Documented future phases — do not assume these
controls exist yet):

- Authentication and authorization (the app currently has **no user
  login**; run it only on a trusted machine).
- Role-based access control and tenant isolation (if hosted deployment is ever
  introduced).
- SSRF-resistant HTTP transport for outbound discovery requests.
- DNS validation and connection pinning (preventing DNS rebinding).
- Redirect validation.
- Rate limiting.
- Audit logging of security-relevant events.
- Timeout/retry policy enforcement for external providers.
- Per-user encryption at rest for collected findings and reports.
- Formal automated dependency vulnerability scanning in CI (check manually via
  `pip-audit` / `npm audit` for now — see Section 6).
- Safe scanning policies for attacking third-party infrastructure.

**Because there is no authentication, do not expose AegisGraph to the network
or the internet.** It is designed strictly for localhost use until
authentication lands in a future phase.

## 5. Data Safety

- Database data persists in the `aegisgraph_pgdata` Docker volume.
- Regular `docker compose down` / `restart` preserves data.
- `docker compose down -v` **removes the volume and all data** — it is reserved
  for destructive reset only.
- Back up with `scripts/backup-database.ps1` (Windows) or
  `scripts/backup-database.sh` (Linux/macOS). Restore requires explicit
  confirmation because it drops the current database.

## 6. Dependency Vulnerability Monitoring

Check dependencies periodically with:

```powershell
# Backend (from backend/):
pip install pip-audit
pip-audit -r requirements.txt

# Frontend (from frontend/):
npm audit
```

Currently known findings at Phase 1 release are documented in the Phase 1
completion report (see `docs/development/phase-1-report.md` if present) and the
main README.

## 7. Found an Issue in the Application Itself?

AegisGraph detects security issues in *other* systems. If you believe the
platform has a configuration or implementation weakness, report it through the
channel in Section 2 with the classification:

`Critical | High | Medium | Low | Informational`
