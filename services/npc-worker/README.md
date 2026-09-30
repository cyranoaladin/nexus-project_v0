# NPC Worker

Service worker asynchrone pour le Nexus Pedagogy Cockpit.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   API/Web   │────▶│  ai_processing_job (DB)  │────▶│  NPC Worker │
│  (création) │     │   (queue)    │     │ (processor) │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                  │
                                                  ▼
                                           ┌──────────────┐
                                           │ OpenRouter/  │
                                           │ Ollama/Stub  │
                                           └──────────────┘
```

## Modes de fonctionnement

| Mode | Description | Usage |
|------|-------------|-------|
| `live` | Appels réels à OpenRouter (`openai/gpt-5-mini`, `provider.ignore=["chutes"]`) | Production |
| `stub` | Réponses déterministes | Tests, staging |
| `off` | Skip complètement | CI, debugging |

## Jobs supportés

- `VISION_OCR` - Extraction texte depuis images/PDF
- `PEDAGOGICAL_DIAGNOSIS` - Analyse pédagogique complète
- `COMPETENCE_MATRIX` - Matrice de compétences
- `REMEDIATION_ROADMAP` - Plan de remédiation
- `MENTOR_ADVICE` - Conseils personnalisés

## Lancement

```bash
# Mode development (avec hot-reload)
npx ts-node services/npc-worker/index.ts

# Mode production (Docker)
docker-compose -f docker-compose.npc.yml up -d

# Scaling (multiple workers)
docker-compose -f docker-compose.npc.yml up -d --scale npc-worker=3
```

## Monitoring

```bash
# Logs
docker logs -f nexus-npc-worker

# Jobs en cours
docker exec nexus-db psql -U nexus -c "SELECT status, COUNT(*) FROM ai_processing_job GROUP BY status;"
```

## Variables d'environnement

| Variable | Default | Description |
|----------|---------|-------------|
| `NPC_LLM_MODE` | `stub` | Mode de traitement AI |
| `NPC_WORKER_POLL_INTERVAL_MS` | `5000` | Intervalle de polling (ms) |
| `NPC_WORKER_LOCK_DURATION_MS` | `300000` | Durée de lock d'un job (ms) |
| `NPC_MAX_RETRY_ATTEMPTS` | `3` | Nombre max de retries |
| `OPENROUTER_API_KEY` | - | Clé API OpenRouter (endpoint et modèle épinglés dans `lib/npc/config.ts`) |
