# Comptes de test — Bilan Premium

## SMTP de test

- Utiliser Mailhog (local):
  - `SMTP_HOST=localhost`
  - `SMTP_PORT=1025`
  - `SMTP_FROM=noreply@nexus.local`

## Variables utiles

- `OPENAI_API_KEY` (prod)
- `PDF_RENDERER_FORCE=pdf-lib` (forcer le fallback PDF côté dev/staging si besoin)

## Scénarios rapides

1. Génération synchrone:
   - `POST /api/bilan/generate?variant=eleve` → PDF direct
2. Génération asynchrone:
   - `POST /api/bilan/start?variant=parent` → `{ id }`
   - Poll `GET /api/bilans/:id/status` jusqu’à `done`
   - `GET /api/bilans/:id/download` → PDF
3. Email:
   - `POST /api/bilan/email/:id?to=test@example.com` → vérifier dans Mailhog
