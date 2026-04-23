# Architecture RAG — Nexus Réussite

> Date : 2026-04-21 — Version : 1.0 (post-LOT 6 étape 3)
> Statut : ChromaDB = canonique | pgvector = désactivé pour RAG produit

---

## 1. Décision d'architecture (F19)

### 1.1 Canonique : ChromaDB

Le retrieval RAG produit utilise exclusivement **ChromaDB** via le service FastAPI ingestor :

- **Client** : `lib/rag-client.ts` (`ragSearch`, `ragSearchBySubject`, `buildRAGContext`)
- **Endpoint** : `POST /search` sur `RAG_INGESTOR_URL` (env)
- **Modèle embedding** : `nomic-embed-text` (768 dimensions)
- **Collections** :
  - `ressources_pedagogiques_premiere_maths`
  - `ressources_pedagogiques_terminale`
  - `ressources_pedagogiques_nsi_premiere`
  - `ressources_pedagogiques_nsi_terminale`

### 1.2 Désactivé : pgvector

Le champ `embedding_vector` dans `pedagogical_contents` (Prisma) existe encore en DB mais **n'est plus utilisé** par le code applicatif depuis F26 (LOT 6 étape 1).

- **Raison** : double source de vérité avec modèles d'embedding incompatibles (nomic-embed-text 768d vs text-embedding-3-small 1536d)
- **Statut** : Dette technique — suppression du champ prévue hors-scope LOT 6
- **Usage historique** : `lib/aria.ts` (avant F26), fallback maths-1ere/rag (avant F26)

### 1.3 Tableau récapitulatif

| Système | Statut | Usage actif | Modèle | Dimensions |
|---------|--------|-------------|--------|------------|
| ChromaDB | **Canonique** | Oui — tous les flows RAG | nomic-embed-text | 768 |
| pgvector | **Désactivé** | Non — champ existant mais non lu | text-embedding-3-small | 1536 |

---

## 2. Ingestion hors-repo (F24)

### 2.1 ChromaDB — Ingestion externe

L'ingestion des documents dans ChromaDB est **hors-repo** :

- **Service** : `infra-ingestor-1` (Docker sur `infra_rag_net`)
- **Code** : FastAPI externe, non présent dans ce repository
- **Endpoint d'ingestion** : `POST /ingest` (authentifié)
- **Collections gérées** : maths, nsi (première + terminale)
- **Modèle** : `nomic-embed-text` via sentence-transformers

### 2.2 pgvector — Jamais ingéré par ce repo

Le champ `embedding_vector` n'est **jamais écrit** par le code de ce repository :

- Aucune route d'API n'écrit `embedding_vector`
- Le seed Prisma initialise avec `[]` (vecteur vide)
- L'ingestion pgvector (si elle existe) est gérée par un processus externe non documenté ici

### 2.3 Conséquence opérationnelle

La synchronisation ChromaDB ↔ pgvector **n'existe pas**. Ce sont deux corpus disjoints avec des embeddings incompatibles.

---

## 3. Flows RAG dans le codebase

### 3.1 Bilan pré-stage Maths

```
lib/bilan-generator.ts
  → ragSearch({query, k, collection})
  → buildRAGContext(hits)
  → Ollama (llama3.2:latest)
```

### 3.2 ARIA Chat

```
lib/aria.ts / lib/aria-streaming.ts
  → ragSearch({query, filters: {subject}})
  → buildRAGContext(hits)
  → OpenAI (gpt-4o-mini)
```

### 3.3 Cockpit Maths 1ère — RAG Sources

```
app/api/programme/maths-1ere/rag/route.ts
  → ragSearch({query, section})
  → buildRAGContext(hits)
  → JSON response {hits, context, source: 'chroma'}
```

---

## 4. Configuration

### 4.1 Variables d'environnement

| Variable | Description | Défaut dev | Défaut prod |
|----------|-------------|------------|-------------|
| `RAG_INGESTOR_URL` | URL base FastAPI ingestor | `http://ingestor:8001` | `https://rag-api.nexusreussite.academy` |
| `RAG_API_TOKEN` | Token Bearer (prod) | — | Token prod |
| `RAG_SEARCH_TIMEOUT` | Timeout recherche (ms) | `10000` | `10000` |

### 4.2 Fichiers clés

- `lib/rag-client.ts` — Client RAG canonique
- `lib/bilan-generator.ts` — Usage RAG pour bilans
- `lib/aria.ts` — Usage RAG pour ARIA
- `app/api/programme/maths-1ere/rag/route.ts` — Endpoint RAG public

---

## 5. Traçabilité LOT 6

| Finding | Statut | Preuve code |
|---------|--------|-------------|
| F26 — ARIA streaming RAG canonique | ✅ Close | `lib/aria-streaming.ts:28-42` |
| F26 — ARIA pgvector supprimé | ✅ Close | `lib/aria.ts:31` commentaire F26 |
| F28 — ragUsed réel persisté | ✅ Close | `lib/bilan-generator.ts:27`, routes bilan |
| F30 — RAG error explicite | ✅ Close | `lib/bilan-generator.ts:27`, `errorCode: RAG_UNAVAILABLE` |
| F19 — Archi ChromaDB canonique | ✅ Close | Ce document |
| F24 — Ingestion hors-repo doc | ✅ Close | Section 2.1 |

---

## 6. Notes techniques

### 6.1 Pourquoi ChromaDB et pas pgvector ?

- ChromaDB gère nativement la recherche sémantique avec métadonnées
- L'ingestor FastAPI externe est opérationnel et maintenu
- pgvector aurait nécessité une migration complète des embeddings (1536d → 768d)

### 6.2 Pourquoi garder `embedding_vector` en DB ?

- Suppression = migration destructive potentiellement risquée
- Le champ est ignoré par le code — pas d'impact fonctionnel
- Nettoyage différé hors-scope LOT 6

---

## 7. Références

- `docs/AUDIT_SENIOR_2026-04-19/07_RAG_LLM_ARCHITECTURE.md` — Audit initial
- `docs/40_LLM_RAG_PIPELINE.md` — Pipeline LLM/RAG
- `lib/rag-client.ts` — Implémentation client
