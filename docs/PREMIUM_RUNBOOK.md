# PREMIUM RUNBOOK — Bilan PDF

## Pré-requis prod

- OPENAI_API_KEY défini
- TeX installé: `latexmk`, `xelatex`
- SMTP: variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

## Flux standard (synchrone)

1. `POST /api/bilan/generate?variant=eleve|parent`
   - Essaie LaTeX (si TeX dispo), sinon fallback pdf-lib
   - Retourne `application/pdf`

## Flux asynchrone (job)

1. `POST /api/bilan/start?variant=eleve|parent` → `{ id, status: queued }`
2. Poll: `GET /api/bilans/:id/status` → `running|done|error`
3. `GET /api/bilans/:id/download` → PDF
4. Email (option): `POST /api/bilan/email/:id?to=user@example.com`

## Debug staging

- Forcer test LaTeX: `POST /api/bilan/generate?variant=eleve&forceLatex=1`
- Page admin: `/dashboard/admin/debug/pdf`

## Incidents

- LaTeX KO → fallback pdf-lib automatique (aucune dépendance AFM)
- SMTP KO → endpoint email retourne 500; vérifier variables et serveur SMTP
- Grosse charge → privilégier le flux asynchrone (jobs)
