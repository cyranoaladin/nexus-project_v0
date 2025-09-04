<!-- markdownlint-disable MD041 MD013 -->
# DEV environment – ARIA & PDF

## Fichiers d'env et priorité

- `.env.local` (développement local) > `.env`.
- Ne commitez jamais vos secrets.

## Variables clés et modes

- `DIRECT_OPENAI_DEV=1`: utilise OpenAI directement côté Node (ARIA) en dev si `OPENAI_API_KEY` est présent.
- `USE_LLM_SERVICE=1`: force l'usage du microservice LLM même en dev.
- `OPENAI_MODEL`: modèle principal; en dev si absent → `gpt-latest` est utilisé.
- `OPENAI_FALLBACK_MODEL`: modèle de secours en cas d'échec du principal.
- `FORCE_PDF_REGEN=1`: ignore les blobs PDF stockés et régénère toujours.
- `E2E=1` et `NEXT_PUBLIC_E2E=1`: mode E2E pour tests (bypass partiels et déterminisme).

## Procédure standard de test

1. `npm run dev` (ou port dédié, ex: `--port 3003`)
2. `npm run smoke:openai`
3. `npm run smoke:aria` (assurez-vous que l’app tourne sur `BASE_URL` adéquat, par défaut `http://localhost:3003`)
4. `npm run smoke:pdf`

## Bonnes pratiques

- Ne pas committer les secrets (`OPENAI_API_KEY`).
- Prévoir une rotation régulière des clés.
- En prod: définir explicitement `OPENAI_MODEL` et (optionnel) `OPENAI_FALLBACK_MODEL`.
