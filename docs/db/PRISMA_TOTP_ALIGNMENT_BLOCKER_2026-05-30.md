# Blocage Prisma/TOTP — Alignement schema/migrations

## Résumé
- Le chantier STMG est localement validé mais la QA connectée est bloquée.
- Cause : `schema.prisma` contient des champs TOTP non migrés.
- Base QA issue des migrations : colonnes TOTP absentes.
- Prisma Client : attend ces colonnes.
- Erreur : `users.totpSecret does not exist`.

## Champs concernés
- `totpSecret`
- `totpEnabledAt`
- `totpBackupCodes`
- `totpLastUsedAt`

## Impact
- `npm run test:e2e:setup` échoue au seed.
- `scripts/create-stmg-students.ts` refuse l’écriture.
- Création des comptes élèves STMG bloquée.
- QA navigateur connectée bloquée.

## Options
### Option A — Revert TOTP
- Revenir au schéma sans TOTP.
- Avantage : débloque QA rapidement.
- Inconvénient : reporte 2FA admin.

### Option B — Migration TOTP séparée
- Créer une migration Prisma dédiée.
- Appliquer sur QA.
- Tester seed.
- Puis traiter prod avec protocole DB séparé.
- Avantage : aligne le schéma.
- Inconvénient : nécessite procédure DB rigoureuse.

## Recommandation
Ne pas traiter TOTP dans la feature STMG.
Créer un lot séparé :
`chore(db): align TOTP schema and migrations`.

## Interdits
- Pas de `prisma db push`.
- Pas de création élèves avant alignement.
- Pas de migration mélangée à STMG.
