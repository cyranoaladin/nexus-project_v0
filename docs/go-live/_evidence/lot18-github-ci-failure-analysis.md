# Lot 18 — GitHub CI failure analysis

## PR

- PR : `#58`
- URL : `https://github.com/cyranoaladin/nexus-project_v0/pull/58`
- Branche : `feat/lot4-accessors-runtime`
- Etat : draft

## Checks GitHub

Le check `E2E Tests` echoue sur GitHub Actions.

Les checks suivants passent :

- Security Scan
- Lint
- TypeScript Type Check
- Integration Tests
- Production Build
- Unit Tests

`CI Success` echoue comme job de synthese car `E2E Tests` echoue.

## Cause racine

Le test `e2e/real/pages/04-bilan-gratuit.spec.ts` attendait encore :

```ts
expect(body.parentId).toBeTruthy();
expect(body.studentId).toBeTruthy();
```

Ces assertions sont obsoletes depuis la decision lead-only/RGPD : l'API publique `/api/bilan-gratuit` ne doit pas exposer d'IDs internes parent/eleve.

## Correction retenue

Ne pas modifier l'API.

Corriger le test E2E pour verifier :

- `success === true`.
- `message` present.
- absence des champs sensibles.
- redirection vers `/bilan-gratuit/confirmation`.
- chargement visible de la confirmation.

## Verification locale

Le test unitaire API/RGPD passe et prouve le contrat serveur.

Le test E2E CI-config local ne peut pas terminer la soumission sans DB E2E locale ; il echoue sur `HTTP 500` cause `PrismaClientInitializationError` vers `127.0.0.1:5435`, pas sur l'ancienne assertion `parentId/studentId`.
