# Legacy shell scripts

These scripts were located at the repository root with **zero productive references**
in code, CI, or documentation as of 2026-04-27 (Lot A cleanup). They are preserved
here for **manual developer reference** only.

| Script | Purpose (best-guess from content) | Status |
|---|---|---|
| `fix-db-infra.sh` | Ad hoc DB infrastructure repair | unused |
| `push.sh` | Local git push helper | unused — devs should use `git push` directly |
| `start_server.sh` | Old-fashioned server starter | superseded by `start-production.sh` (which IS referenced in `scripts/mega-e2e-validation.ts`) |
| `test-with-middleware-swap.sh` | Run tests with a middleware variant | unused |
| `verify_all.sh` | Aggregate verification | unused |

If any of these become useful again:

1. Add a productive reference (CI, package.json script, doc).
2. Move them out of `scripts/legacy/` to a meaningful location (`scripts/db/`, `scripts/dev/`, etc.).
3. Update this file accordingly.

Otherwise, they may be deleted in a future cleanup pass.
