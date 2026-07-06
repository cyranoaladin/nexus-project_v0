# Lot 8 — Audit regression scripts securite

## Verdict

`ACCEPTED`

## Tests renforcés

Fichier : `__tests__/scripts/security-audit-scripts-regression.test.ts`

Cas couverts :

- route publique avec mutation + Zod + rate limit reste `P1` ;
- webhook disabled `501` reste `P1` ;
- route staff-looking sans rôle explicite ne devient pas `OK` ;
- route PII authentifiée sans ownership ne devient pas `OK` ;
- route dynamique `[id]` sensible sans ownership reste au-dessus de `OK` ;
- `/api/internal/rate-limit-probe` reste `OK` uniquement comme route interne non-PII ;
- les 6 P1 actuels restent `P1` ;
- le total route files correspond à l’inventaire.

## Commande ciblée

```bash
source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run test:unit -- --runInBand __tests__/scripts/audit-api-guards.classification.test.ts __tests__/scripts/security-audit-scripts-regression.test.ts
```

Résultat : `2` suites passées, `16` tests passés.

## Décision

Les scripts d’audit restent acceptés comme triage statique, avec réserve : ils ne remplacent ni les tests IDOR, ni la preuve runtime Redis/Upstash, ni la décision humaine sur les P1.
