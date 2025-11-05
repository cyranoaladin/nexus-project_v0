# ARIA Service (Nexus Réussite)

Service FastAPI dédié à l'orchestration des agents pédagogiques ARIA. La structure initiale inclut :

- Orchestrateur minimal (graph + router)
- Agents stub (diagnostic, planner, RAG, grader)
- Clients mémoire/outils (Mongo, Qdrant, Redis, MinIO, LaTeX, RAG)
- Scripts d'ingestion RAG et de seeds
- Configuration docker-compose pour l'exécution locale

## Démarrage rapide

```bash
cp .env.example .env
# Éditer l'environnement avec vos secrets (voir documentation)
make build
make up
```

Pour indexer un corpus minimal :

```bash
mkdir -p corpus/Terminale/recurrence
printf "# Récurrence\n\nPrincipe..." > corpus/Terminale/recurrence/rappels.md
make ingest
```

Endpoints exploratoires :

```bash
curl http://localhost:8088/health
```
