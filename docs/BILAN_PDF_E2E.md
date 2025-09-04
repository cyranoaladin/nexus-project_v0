# Bilan PDF — Mode E2E/Dev

## Endpoints

- `GET /api/bilan/pdf/[id]`
  - En E2E/dev, renvoie un PDF stub multi‑pages quand `E2E=1` ou `NEXT_PUBLIC_E2E=1` ou `dev=1`.
  - Sinon, renvoie `302` vers `/api/bilan/pdf?bilanId=...` (redirection relative).

- `GET /api/bilan/pdf` (query: `bilanId`, `variant`, `niveau`, `dev`)
  - En E2E/dev, renvoie un PDF stub multi‑pages quand `E2E=1` ou `dev=1`.
  - En prod, applique les règles d’auth et de résolution du bilan.

## Tests E2E

- Tests API: requièrent directement `/api/bilan/pdf?bilanId=...&variant=...&dev=1`.
- Tests UI: acceptent 302 sur `/api/bilan/pdf/[id]` et basculent sur l’endpoint direct si nécessaire.

## Config Playwright

- Par défaut, Playwright démarre Next sur 3003. Aligner `E2E_BASE_URL=http://localhost:3003`.
- Config alternative `playwright.noserver.config.ts` pour cibler un serveur existant (3000).
