# Bilan Premium — Génération PDF (LaTeX + pdf-lib)

Ce document décrit le pipeline de génération des Bilans Premium dans le projet principal.

## Architecture

- Orchestrateur: `apps/web/server/bilan/orchestrator.ts`
  - Produit les données métier du bilan (via OpenAI en prod; stub en E2E/dev)
- Rendu préférentiel: LaTeX (xelatex/latexmk)
  - Fonction: `tryGeneratePremiumLatexPdf(data)`
  - Template LaTeX: `apps/web/server/bilan/templates/bilan_report.tex`
- Fallback robuste: `pdf-lib` (aucune dépendance AFM/Helvetica)
  - Intégré dans `app/api/bilan/generate/route.ts`

## Endpoints principaux

- `POST /api/bilan/generate?variant=eleve|parent` — Génère un PDF synchrone (LaTeX → pdf-lib)
- `POST /api/bilan/start?variant=eleve|parent` — Lance une génération asynchrone (pdf-lib)
- `GET /api/bilans/:id/status` — Statut du job (queued/running/done/error)
- `GET /api/bilans/:id/download` — Télécharge le PDF du job terminé
- `POST /api/bilan/email/:bilanId?to=email` — Envoi email avec PDF en PJ (SMTP requis)

## Mode Staging (test LaTeX)

- `POST /api/bilan/generate?variant=eleve&forceLatex=1` tente LaTeX, puis bascule sur `pdf-lib` si échec.

## Données & vues

- Le mapping LaTeX (`mapPremiumToTexView`) reste la source de vérité; le fallback `pdf-lib` dessine les sections essentielles (titre, score, axes, timeline) en mode texte.

## Dépendances

- Production LaTeX: `latexmk`, `xelatex` (TeX Live)
- Fallback Node: `pdf-lib`
- Email: `nodemailer` + variables SMTP
