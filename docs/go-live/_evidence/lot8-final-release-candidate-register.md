# Lot 8 — Registre final release candidate

| Domaine | Statut | Preuve | Décision |
|---|---|---|---|
| P0 | 0 | matrice | OK |
| P1 | 6 | matrice | bêta contrôlée seulement |
| Scripts audit | ACCEPTED | tests scripts | garder P1 visibles |
| Manifest RC | CLEAN | `lot8-release-candidate-file-manifest-clean.md` | RC_READY_FOR_HUMAN_REVIEW |
| Commit plan | READY | `lot8-release-candidate-commit-plan-clean.md` | RC_READY_FOR_HUMAN_REVIEW |
| Runtime Redis | NOT_PROVEN | variables absentes ou non exécutées | BETA_ELARGIE_BLOCKED |
| 429 runtime | NOT_PROVEN | variables absentes ou non exécutées | BETA_ELARGIE_BLOCKED |
| ContactLead DB dry-run | NOT_PROVEN | variables absentes ou non exécutées | GO_LIVE_LARGE_BLOCKED |
| ClicToPay | DISABLED | routes/docs | manual payment |
| Worktree | READY_FOR_HUMAN_COMMIT | `283` entrées classées, `281` Include RC, `1` Exclude, `1` Needs human review | commit manuel seulement |
| Gates finales | OK | Typecheck, lint, unit, build, audits, checks, Playwright public et assessment | RC_READY_FOR_HUMAN_REVIEW |

## Décision finale Lot 8

- `RC_READY_FOR_HUMAN_REVIEW`
- `BETA_CONTROLEE_ALLOWED_WITH_RESERVES`
- `BETA_ELARGIE_BLOCKED`
- `GO_LIVE_LARGE_BLOCKED`
