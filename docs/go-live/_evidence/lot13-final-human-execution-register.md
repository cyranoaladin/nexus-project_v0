# Lot 13 — Final human execution register

Date de décision : 2026-07-06.

| Domaine | Statut | Preuve | Décision |
|---|---|---|---|
| P0 | 0 | `docs/go-live/api-security-matrix.full.md` | OK |
| P1 | 6 | `docs/go-live/api-security-matrix.full.md` | bêta contrôlée seulement |
| Runbook humain | PASSED | `__tests__/scripts/release-candidate-human-commit-runbook.test.ts` : 1 suite passée, 5 tests passés | READY_TO_EXECUTE_MANUALLY |
| Audit Nexus | EXCLUDED | `docs/go-live/_evidence/lot13-audit-nexus-final-status.md` | EXCLUDE_FROM_STANDARD_COMMITS |
| Staging Git | EMPTY | `git diff --cached --name-only` | OK |
| Runtime Redis | NOT_PROVEN | `docs/go-live/_evidence/lot13-runtime-proof-status.md` | BETA_ELARGIE_BLOCKED |
| 429 runtime | NOT_PROVEN | `docs/go-live/_evidence/lot13-runtime-proof-status.md` | BETA_ELARGIE_BLOCKED |
| ContactLead DB dry-run | NOT_PROVEN | `docs/go-live/_evidence/lot13-runtime-proof-status.md` | GO_LIVE_LARGE_BLOCKED |
| Human execution | READY_TO_EXECUTE_MANUALLY | runbook Lot 11 + preuve Lot 13 | READY_TO_EXECUTE_MANUALLY |

## Décisions finales

- `READY_TO_EXECUTE_MANUALLY`
- `BETA_CONTROLEE_ALLOWED_WITH_RESERVES`
- `BETA_ELARGIE_BLOCKED`
- `GO_LIVE_LARGE_BLOCKED`
