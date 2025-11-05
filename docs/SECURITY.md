# Sécurité et Observabilité

## Sécurité
- CSRF double-submit: récupérer le token via `GET /api/security/csrf`, envoyer `X-CSRF-Token` sur POST sensibles.
- Rate limiting (fallback mémoire):
  - `/api/payments/konnect` → 5 req/min/IP
  - `/api/aria/*` → 10 req/min/IP
  - `/api/bilan-gratuit` → 5 req/min/IP
- Webhooks Konnect: HMAC SHA-256 sur corps brut (`x-konnect-signature`). Secret: `KONNECT_WEBHOOK_SECRET`.

## Observabilité (optionnel)
- Logger structuré recommandé (ex: Pino). Un wrapper minimal `console` est utilisé par défaut.
- Sentry: ajouter `@sentry/nextjs` et `SENTRY_DSN` si souhaité; instrumentation à activer ultérieurement.
