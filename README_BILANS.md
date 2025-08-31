# Nexus Bilan – Guide rapide

## Variables d'environnement

- OPENAI_API_KEY: clé API OpenAI
- DATABASE_URL: connexion Postgres
- NEXT_PUBLIC_BASE_URL: ex: <http://localhost:3001> (pour les redirections download)
- TEXBIN (optionnel): binaire latexmk/tectonic si non dans PATH

## Flux de génération

1. POST /api/bilans/generate avec `{ studentId, variant: "eleve"|"parent", qcm, volet2 }`
2. Le serveur agrège → appelle OpenAI → rend Mustache (LaTeX) → compile PDF
3. PDF stocké sous `storage/reports/<studentId>/<variant>/bilan.pdf`
4. Récupérer le statut: GET /api/bilans/:id/status
5. Télécharger: GET /api/bilans/:id/download (redirige vers /files/...)

## Dépendances

```bash
npm i -D openai mustache @types/mustache zod
```

Latex: `latexmk` (ou `tectonic`) doit être installé.

## Démo CLI

- Fichier: `generate-bilan-pdf.ts` (exemple minimal – nécessite OPENAI_API_KEY).

## RGPD

- Seules les métadonnées minimales sont persistées.
- Pas de contenus sensibles dans les logs.
