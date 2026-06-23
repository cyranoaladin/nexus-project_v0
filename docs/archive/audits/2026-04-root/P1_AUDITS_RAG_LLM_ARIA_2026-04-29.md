# P1 Audit - RAG / LLM / ARIA

**Date:** 2026-04-29
**Status:** ✅ AUDITED (documented architecture)

## RAG (Retrieval-Augmented Generation)

### Architecture
- **Backend:** ChromaDB (canonical RAG backend)
- **Embedding:** nomic-embed-text (768d)
- **API:** Ingestor API (FastAPI) on infra-ingestor-1:8001
- **Network:** infra_rag_net
- **Status:** pgvector disabled for RAG product (F26)

### Client
- **File:** `lib/rag-client.ts`
- **Endpoints:** POST /search, POST /ingest, GET /health, GET /collections
- **Features:** Semantic search, metadata filters, collection stats
- **Ingestion:** Out-of-repo (F24) - operated by external FastAPI service

### Security
- **Access:** Internal network only (infra_rag_net)
- **Authentication:** Not documented in client (assumed internal)
- **Rate Limiting:** Not documented in client

## LLM (Large Language Model)

### Architecture
- **Provider:** Ollama (local)
- **Server:** infra-ollama-1 on infra_rag_net (port 11434)
- **Models:** qwen2.5:32b, llama3.2:latest, nomic-embed-text:latest

### Client
- **File:** `lib/ollama-client.ts`
- **Features:** Chat, generate, streaming
- **Configuration:** Temperature, max tokens, JSON mode

### Security
- **Access:** Internal network only (infra_rag_net)
- **Model Selection:** Configurable via environment
- **Rate Limiting:** Not documented in client

## ARIA (AI Assistant)

### Architecture
- **Provider:** OpenAI (with fallback to Ollama)
- **RAG Integration:** ChromaDB search via rag-client.ts
- **Prompt System:** ARIA_SYSTEM_PROMPT (pedagogical assistant)

### Client
- **File:** `lib/aria.ts`
- **Features:** Knowledge base search, conversation history, subject-specific responses
- **Entitlement:** Server-side checks in app/api/aria/chat/route.ts

### Security Assessment
- **Authentication:** Server-side role check (ELEVE only)
- **Entitlement:** Feature guard + subscription check
- **RAG Rights:** Server-side only (client-side TODO is P1 UX improvement)
- **Rate Limiting:** Not documented

## Risk Assessment

**P1 Risk:** Low to Medium
- RAG/LLM services are internal network only
- Server-side security checks are in place
- Rate limiting not documented (potential DoS risk)
- No external API exposure (internal network)

## Recommendations

**Post-Merge Actions:**
1. Document rate limiting strategy for RAG/LLM services
2. Add authentication/authorization documentation for Ingestor API
3. Implement client-side ARIA rights check (P1 UX improvement)
4. Monitor RAG/LLM service health in production

**Priority:** P1 (for go-live premium 100%)
**Blocking:** No (for P0 merge)

## Status

**P0 Merge:** ✅ NOT BLOCKED
**Go-Live Premium 100%:** ⚠️ REQUIRES DOCUMENTATION + MONITORING
