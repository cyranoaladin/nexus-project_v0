# Lot 5 — ContactLead retention dry-run

## Objectif

Prouver que la purge/anonymisation ContactLead est exécutable en dry-run et ne sort pas de PII.

## Dry-run local DB

Commande :

`npx tsx scripts/maintenance/contact-leads-retention.ts`

Résultat : ÉCHEC non destructif.

Cause : DB locale configurée indisponible, impossible de joindre `postgres:5432`.

Impact : aucun `--apply`, aucune écriture, aucune PII affichée.

## Preuve par test fixture

Commande :

`npm run test:unit -- --runInBand __tests__/scripts/contact-leads-retention.test.ts`

Résultat : OK, `1` suite, `3` tests.

Couverture :

- dry-run par défaut ;
- pas d'email/téléphone en clair dans le résultat ;
- effacement parental par hash email ;
- `--apply` explicite requis avant anonymisation.

## Décision

Mécanisme opérationnel présent et testé.

Dry-run réel contre DB locale/staging : À EXÉCUTER quand une DB non production est disponible.

`--apply` production : INTERDIT sans validation humaine explicite.

