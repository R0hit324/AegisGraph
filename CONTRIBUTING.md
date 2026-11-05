# Contributing to AegisGraph

Thanks for helping build AegisGraph. This project is developed in a strict
phase-by-phase workflow where security and testing are part of *every* change.

## Ground rules

1. **Stay in focus of the current phase.** Do not implement features that belong
   to a later phase. No fake data, no placeholder results pretending to be real
   findings, no invented metrics.
2. **Security before convenience.** Validate all external inputs, use
   parameterized queries, never hardcode secrets, prefer secure defaults.
3. **No secrets committed.** Configuration lives in `.env` (git-ignored).
   `.env.example` holds placeholders only.
4. **Tests are mandatory.** A change without tests is incomplete. Bug fixes are
   only accepted with a regression test.

## Branch workflow

```text
main            → always working, all checks green
git checkout -b feature/<phase>-<short-description>
```

Commits: short imperative subject line, describe *why* in the body when useful.

## Development workflow

```powershell
# 1. Start the local stack
docker compose up --build -d

# 2. Backend quality gates (E:\AegisGraph\backend)
.venv\Scripts\Activate.ps1
ruff check app tests
ruff format --check app tests
mypy app
pytest

# 3. Frontend quality gates (E:\AegisGraph\frontend)
npm ci
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

On Linux/macOS use the same commands with `source .venv/bin/activate`.

## Definition of done (per change)

- [ ] Functionality tests written and passing.
- [ ] Security review of the change (entry points, inputs, trust boundaries).
- [ ] Security tests added where relevant.
- [ ] Regression tests re-run after the change.
- [ ] `ruff`, `mypy`, ESLint, tsc pass.
- [ ] Frontend production build succeeds.
- [ ] Documentation updated (README/docs/SECURITY.md where applicable).
- [ ] No debug output, no suppressed errors, no fake results.

## Reporting bugs and security issues

- Bugs: GitHub Issues with reproduction steps and expected vs. actual behavior.
- Security vulnerabilities: **responsibly**, via the process in `SECURITY.md`.
  Never in public issues.

## Style

- Backend: Python with `ruff` (lint + format) and `mypy` (type checking where
  practical). Type hints required for public interfaces.
- Frontend: TypeScript strict mode, ESLint + Prettier formatting.
- Keep modules small, service-layer logic out of API routes, and preserve the
  directory conventions in the repository `README.md`.
