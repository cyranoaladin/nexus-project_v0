# LLM / RAG Pipeline

## Contrat LLM_MODE
- `LLM_MODE=live` (défaut)
- `LLM_MODE=stub`
- `LLM_MODE=off`

Preuves code:
- `lib/assessments/generators/index.ts` (`getLlmMode`, commentaire contractuel)
- `lib/env-validation.ts` (`LLM_MODE` optionnel, description)

### Effets runtime
- `live`: appel Ollama réel.
- `stub`: bilans déterministes pour tests/staging.
- `off`: pas de génération; assessment marqué `COMPLETED` avec `errorCode=LLM_GENERATION_SKIPPED`.

Preuves code:
- `lib/assessments/generators/index.ts` (branches `llmMode`)

> **ATTENTION**
> Off/stub doivent être activés uniquement par variable d’environnement (CI/E2E/staging). Le défaut code est `live`.

## Endpoints LLM/RAG (env-first)
- Ollama URL: `OLLAMA_URL`, fallback prod `http://ollama:11434`, fallback dev `http://localhost:11434`.
- RAG v2 URL: `RAG_API_BASE_URL`, sans fallback. Les credentials distincts
  sont `RAG_BFF_SERVICE_TOKEN`, `RAG_ENGINE_API_KEY` (`rag:search`) et une
  identité académique signée. Voir `docs/RAG_ARCHITECTURE.md`.

Preuves code:
- `lib/ollama-client.ts` (`getOllamaUrl`)
- `lib/aria/infrastructure/rag/rag-engine-client.ts`

## Pipeline bilan (diagnostic)
```mermaid
sequenceDiagram
  participant U as User
  participant API as /api/bilan-pallier2-maths
  participant S as Scoring
  participant G as generateBilans
  participant O as ollamaChat
  participant DB as diagnostics

  U->>API: POST diagnostic
  API->>S: compute scoring
  API->>DB: save SCORED
  API->>DB: set GENERATING
  API->>G: generateBilans
  G->>O: 3 audiences
  G->>DB: ANALYZED + markdown
  O-->>API: fail possible
  API->>DB: FAILED + errorCode
```

Preuves code:
- `app/api/bilan-pallier2-maths/route.ts`
- `lib/bilan-generator.ts`
- `lib/ollama-client.ts`

## Stratégie de dégradation
- Diagnostic: fallback template (`generateFallbackBilans`) + statut `FAILED` + message explicite.
- Assessment: en cas échec LLM, résultat reste consommable (`COMPLETED`) avec `generationStatus` et message indisponibilité.

Preuves code:
- `lib/bilan-generator.ts`
- `lib/assessments/generators/index.ts`
- `app/api/assessments/[id]/result/route.ts`

## Champs DB / API à suivre
- Diagnostic: `status`, `errorCode`, `retryCount`, `studentMarkdown`, `parentsMarkdown`, `nexusMarkdown`, `ragUsed`, `ragCollections`.
- Assessment: `status`, `errorCode`, `retryCount`, `domainScores`, `studentMarkdown`, `parentsMarkdown`, `nexusMarkdown`.

Preuves code:
- `prisma/schema.prisma` (models `Diagnostic`, `Assessment`)
