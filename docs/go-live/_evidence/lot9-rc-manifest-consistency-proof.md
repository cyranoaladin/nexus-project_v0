# Lot 9 — RC manifest consistency proof

## Résultat

`PASSED`

## Fichiers Include RC

`281`

## Fichiers Exclude

`1`

## Fichiers Needs human review

`1`

## Fichiers non couverts par un commit

Aucun.

## Fichiers couverts plusieurs fois

Aucun.

## Fichiers Exclude inclus par erreur

Aucun.

## Needs human review inclus

Aucun.

## Règles verrouillées par test

- `__tests__/**` doit être `Tests unitaires`.
- `e2e/**` doit être `Tests E2E`.
- `scripts/security/**` doit être `Scripts audit`.
- `scripts/go-live/**` doit être `Scripts go-live`.
- `scripts/maintenance/**` doit être `Scripts maintenance`.
- `rapport_audit_2_07_2026.md` doit rester `Exclude`.
- Aucun `.env*`, `.next/**`, `node_modules/**`, `test-results/**`, `playwright-report/**` ne doit être `Include RC`.
- Les 6 P1 doivent rester visibles dans `docs/go-live/api-security-matrix.full.md`.

## Test exécuté

```bash
source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run test:unit -- --runInBand __tests__/scripts/security-audit-scripts-regression.test.ts __tests__/scripts/release-candidate-manifest-consistency.test.ts
```

Résultat : `2` suites passées, `14` tests passés.

## Décision

`RC_READY_FOR_HUMAN_REVIEW`
