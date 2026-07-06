# Lot 9 — Checklist revue humaine RC

## À vérifier avant commit

- [ ] Les 6 P1 sont encore visibles.
- [ ] Aucun `.env` n'est inclus.
- [ ] `rapport_audit_2_07_2026.md` est exclu.
- [ ] `docs/audits/audit-nexus-reussite.md` est décidé explicitement.
- [ ] Les scripts d'audit sont acceptés avec les tests de régression.
- [ ] Aucun artefact `.next`, `node_modules`, `test-results`, `playwright-report` n'est inclus.
- [ ] ClicToPay reste disabled.
- [ ] Le paiement carte n'est pas annoncé publiquement.
- [ ] Le flux assessment public ne révèle pas de token ou email en query/HTML.
- [ ] ContactLead retention reste en dry-run par défaut.
- [ ] Aucun `--apply` production n'est prévu.
- [ ] Les commits proposés sont validés dans l'ordre.

## Commit 1 — chore(go-live): update security inventory and matrices

- [ ] Fichiers relus
- [ ] Tests relancés
- [ ] Risques acceptés

## Commit 2 — fix(api-security): close admin and role guard gaps

- [ ] Fichiers relus
- [ ] Tests relancés
- [ ] Risques acceptés

## Commit 3 — fix(public-funnel): lead-only bilan and assessment token binding

- [ ] Fichiers relus
- [ ] Tests relancés
- [ ] Risques acceptés

## Commit 4 — fix(runtime): rate-limit probe and business-config gate

- [ ] Fichiers relus
- [ ] Tests relancés
- [ ] Risques acceptés

## Commit 5 — fix(payments): keep clictopay disabled and fail closed

- [ ] Fichiers relus
- [ ] Tests relancés
- [ ] Risques acceptés

## Commit 6 — chore(maintenance): add contact-lead retention dry-run

- [ ] Fichiers relus
- [ ] Tests relancés
- [ ] Risques acceptés

## Commit 7 — test(security): add no-leak, idor, token and audit regressions

- [ ] Fichiers relus
- [ ] Tests relancés
- [ ] Risques acceptés

## Commit 8 — test(e2e): protect public assessment route

- [ ] Fichiers relus
- [ ] Tests relancés
- [ ] Risques acceptés

## Commit 9 — docs(go-live): add evidence and go-no-go registers

- [ ] Fichiers relus
- [ ] Tests relancés
- [ ] Risques acceptés

## Artefacts Lot 9 à décider

- [ ] Inclure `__tests__/scripts/release-candidate-manifest-consistency.test.ts` dans le commit tests si la validation mécanique devient une gate RC permanente.
- [ ] Inclure les preuves Lot 9 dans le commit docs go-live si la revue humaine s'appuie dessus.
