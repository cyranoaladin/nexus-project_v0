# Lot 9 — RC manifest validation

## Verdict

`ACCEPTÉ AVEC RÉSERVES`

## Synthèse

Lot 9 ne modifie pas le produit. Il ajoute une validation mécanique du manifeste RC Lot 8 et du plan de commits Lot 8, puis prépare une checklist de revue humaine avant commit.

## Matrice API

- `P0=0`
- `P1=6`
- `P2=144`
- `OK=28`
- Total : `178` routes

Les 6 P1 restent visibles :

- `/api/payments/clictopay/webhook`
- `/api/assessments/submit`
- `/api/bilan-gratuit`
- `/api/lamis/teacher-report`
- `/api/stages/[stageSlug]/inscrire`
- `/api/student/activate`

## Cohérence manifeste / plan de commits

Test ajouté :

```bash
__tests__/scripts/release-candidate-manifest-consistency.test.ts
```

Résultat ciblé :

```bash
npm run test:unit -- --runInBand __tests__/scripts/security-audit-scripts-regression.test.ts __tests__/scripts/release-candidate-manifest-consistency.test.ts
```

Résultat : `2` suites passées, `14` tests passés.

Points validés :

- chaque fichier `Include RC` est couvert exactement une fois par un commit proposé ;
- aucun fichier `Exclude` n'est inclus dans un commit ;
- aucun fichier `Needs human review` n'est inclus dans un commit ;
- les classifications `__tests__`, `e2e`, `scripts/security`, `scripts/go-live`, `scripts/maintenance` sont verrouillées ;
- `rapport_audit_2_07_2026.md` reste exclu ;
- aucun `.env*`, `.next`, `node_modules`, `test-results` ou `playwright-report` n'est inclus ;
- les 6 P1 restent visibles.

## Runtime

Les preuves runtime restent non exécutées :

- `NEXUS_HEALTH_AUTH_ABSENT`
- `RL_PROBE_NOT_ALLOWED`
- `DATABASE_URL_ABSENT`
- `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED`

## Décision

- Release candidate : `RC_READY_FOR_HUMAN_REVIEW`
- Bêta contrôlée : `BETA_CONTROLEE_ALLOWED_WITH_RESERVES`
- Bêta élargie : `BETA_ELARGIE_BLOCKED`
- Go-live large : `GO_LIVE_LARGE_BLOCKED`

## Gates finales

| Gate | Statut | Résultat |
| --- | --- | --- |
| `npm run typecheck` | OK | `tsc --noEmit` sans erreur |
| `npm run lint` | OK | Commande terminée avec code `0`; warnings existants dans le seuil configuré |
| `npm run test:unit -- --runInBand` | OK | `539` suites passées sur `540`, `1` skipped ; `6521` tests passés sur `6525`, `4` skipped |
| `npm run build` | OK | Build Next.js terminé ; `142` pages statiques générées ; assets standalone copiés |
| `node scripts/security/audit-api-guards.mjs` | OK | `178` routes écrites dans `docs/security/API_GUARD_INVENTORY.md` |
| `node scripts/go-live/generate-api-security-matrix.mjs` | OK | `P0=0`, `P1=6`, `P2=144`, `OK=28` |
| `npm run audit:site-map` | OK | `292` routes, `413` edges, `0` link finding, `13` orphan entries |
| `npm run check:no-hardcoded` | OK | `0` hardcoded values outside canonical sources |
| `npm run check:docs-archive` | OK | Aucun audit/report historique à la racine `docs/` |
| `npm run check:bundle-weight` | OK | Toutes les routes dans baseline + `5 kB` |
| Playwright public | OK | `24` tests passés |
| Playwright assessment token | OK | `1` test passé |

## Réserves

- Redis/Upstash non prouvé en staging/production.
- Test `429` runtime non exécuté.
- Dry-run DB ContactLead non exécuté.
- Les 6 P1 restent ouverts et doivent faire l'objet d'une décision humaine avant toute ouverture plus large.
