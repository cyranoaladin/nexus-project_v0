# Service de génération PDF ARIA

Ce service FastAPI génère des documents PDF à partir de modèles LaTeX premium personnalisés.

## Prérequis

- Docker (recommandé) ou un environnement Linux avec LaTeX disponible (xelatex/pdflatex).

## Construction et exécution (Docker)

```bash
docker build -t aria-pdf-service ./services/pdf_generator_service

# Port 8000 exposé
docker run --rm -p 8002:8000 aria-pdf-service
```

## Endpoints

- POST /generate: génère un PDF
- GET /health: statut de santé

### Payload /generate (JSON)

```json
{
  "contenu": "Contenu LaTeX ou texte à insérer",
  "type_document": "fiche_revision | cours | generique",
  "matiere": "Mathématiques",
  "nom_fichier": "fiche_revision_2025_08",
  "nom_eleve": "Prénom Nom",
  "options": {}
}
```

## Détails techniques

- Boucle de compilation itérative (xelatex/pdflatex) avec corrections simples.
- Pied de page personnalisé: "Document préparé pour [nom] par l'Assistant IA ARIA".
- Tous les messages et erreurs sont en français.
