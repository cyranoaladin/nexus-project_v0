# Lot 6 — Staging, release candidate et go/no-go

## Verdict

ACCEPTÉ AVEC RÉSERVES.

Lot 6 ne ferme pas les réserves runtime majeures. Il confirme que la base locale reste saine, que les preuves d'exploitation sont prêtes à être exécutées, mais que les conditions de bêta élargie et de go-live large ne sont pas réunies sans credential healthcheck, test 429 réel et dry-run ContactLead DB non production.

## Synthèse

- `P0=0` maintenu.
- `P1=6` maintenus, non maquillés.
- `P2=144`, `OK=28`, total `178` routes API au démarrage Lot 6.
- Redis/Upstash staging/production : NON PROUVÉ.
- Test 429 runtime staging/production : NON EXÉCUTÉ.
- ContactLead dry-run DB non production : NON EXÉCUTÉ.
- ClicToPay : `DISABLED`, paiement carte interdit.
- BusinessConfig : gate production codée/testée, preuve runtime authentifiée non obtenue.
- Worktree release candidate : audité et classé, aucun diff `.env`.
- Gates finales Node 20 : OK.
- Playwright critique public + assessment : OK sur port isolé `3012`.

## Décision

| Périmètre | Décision |
| --- | --- |
| Bêta contrôlée | AUTORISÉE AVEC RÉSERVES, volume limité, monitoring humain et paiement manuel |
| Bêta élargie | INTERDITE tant que Redis/Upstash + 429 runtime + dry-run ContactLead DB ne sont pas prouvés |
| Go-live large | INTERDIT tant que les 6 P1 ne sont pas acceptés par décision humaine formelle et que les preuves runtime restent absentes |

## Preuves Lot 6

- `docs/go-live/_evidence/lot6-redis-upstash-authenticated-proof.md`
- `docs/go-live/_evidence/lot6-rate-limit-429-runtime-proof.md`
- `docs/go-live/_evidence/lot6-contact-lead-retention-db-dry-run.md`
- `docs/go-live/_evidence/lot6-release-candidate-worktree-audit.md`
- `docs/go-live/_evidence/lot6-final-go-no-go-register.md`
- `docs/go-live/_evidence/lot6-staging-release-candidate-command-log.md`

## Gates finales

| Gate | Résultat |
| --- | --- |
| Typecheck | OK |
| Lint | OK, warnings sous seuil |
| Tests unitaires | OK, `537` suites passées, `6507` tests passés |
| Build | OK |
| API guard inventory | OK, `178` routes |
| Matrice API | OK, `P0=0`, `P1=6`, `P2=144`, `OK=28` |
| Site map | OK, `292` routes, `0` link finding |
| Hardcoded pricing | OK |
| Docs archive | OK |
| Bundle weight | OK |
| Playwright public | OK, `24 passed` |
| Playwright assessment token | OK, `1 passed` |

## Prochain lot recommandé

Lot 7 doit être humainement assisté : fournir un credential healthcheck temporaire, autoriser une fenêtre de test 429 staging, fournir une DB non production pour dry-run ContactLead, puis refaire la décision bêta élargie. Aucun durcissement fonctionnel supplémentaire ne doit remplacer ces preuves.
