# ADR 003 — Backend RAG canonique

## Statut

Accepté — 17 juin 2026

## Contexte

Trois représentations concurrentes du backend RAG coexistent dans le dépôt :

1. `rag-client.ts` → ChromaDB, `nomic-embed-text`, 768 dimensions.
2. `schema.prisma` → `PedagogicalContent.embedding_vector` commenté 1536 dimensions.
3. `.env.production.example` → OpenAI `text-embedding-3-large`, `VECTOR_DIM=3072`.

Ce pluralisme rend l'ingestion incohérente et les recherches non reproductibles.

## Décision

**ChromaDB + `nomic-embed-text` (768d) est le backend RAG canonique.**

### Pourquoi ChromaDB

- Déjà opérationnel en production via `rag-client.ts`.
- Embeddings locaux (pas de dépendance API externe pour l'ingestion).
- Infrastructure dédiée (`infra-ingestor-1`).

### Pourquoi pas pgvector

- `PedagogicalContent.embedding_vector` est partiellement déprécié.
- Pas de pipeline d'ingestion actif vers PostgreSQL.
- Conserver pgvector pourrait créer une divergence silencieuse.

### Pourquoi pas OpenAI embeddings

- Coût d'ingestion et latence pour des milliers de documents pédagogiques.
- Dépendance externe critique pour le RAG.
- `text-embedding-3-large` est 3072d — incompatible avec ChromaDB actuel.

## Conséquences

- `rag-client.ts` est la seule interface autorisée.
- `VECTOR_DIM` reste à 768.
- Le champ `PedagogicalContent.embedding_vector` est marqué **deprecated** ; une migration de nettoyage sera programmée.
- Toute nouvelle source de connaissances passe par l'ingestor ChromaDB.

## Non-objectifs

- Migration vers pgvector ou OpenAI embeddings : non planifiée.
- Double-écriture pgvector/Chroma : non souhaitée.

## Références

- `lib/rag-client.ts`
- `docs/RAG_ARCHITECTURE.md`
- `lib/aria.ts` (commentaire F19+F24+F26)
