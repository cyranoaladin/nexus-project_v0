# AXE 7 — RAG / LLM : ChromaDB vs pgvector, Ollama

> Date : 2026-04-19 — Repo : `cyranoaladin/nexus-project_v0` — Branch : `main`
> Prérequis : AXE 6 (`06_PRISMA_PGVECTOR_SUPABASE.md`) validé.

---

## 1. Résumé exécutif

Le produit exploite **4 moteurs d'IA distincts** sans contrat unifié :

| Moteur | Rôle réel | Localisation |
|--------|----------|--------------|
| **OpenAI** (GPT-4o-mini) | Génération ARIA chat (streaming + non-streaming) | Cloud OpenAI |
| **Ollama** (Qwen 2.5:32b / llama3.2) | Génération bilans pré-stage + bilans assessment | Serveur local Docker |
| **ChromaDB** (via FastAPI ingestor) | Retrieval RAG cockpit Maths 1ère + bilans pré-stage | Serveur local Docker |
| **pgvector** (PostgreSQL) | Retrieval fallback ARIA + fallback RAG route | PostgreSQL intégré |

**Verdict central** : il ne s'agit pas d'une architecture RAG cohérente, mais d'une **migration inachevée** avec **4 couches empilées** sans contrat clair. Le retrieval primaire (ChromaDB) et le fallback (pgvector) utilisent des modèles d'embedding différents et des corpus potentiellement disjoints. La génération LLM est scindée entre OpenAI (ARIA chat) et Ollama (bilans) sans raison architecturale documentée. La traçabilité source côté UI est partielle.

---

## 2. Carte réelle de la stack RAG/LLM

### 2.1 Tableau des surfaces

| Surface produit | Endpoint | Moteur retrieval | Moteur génération | Modèle | Fallback | Preuve |
|----------------|----------|-----------------|-------------------|--------|----------|--------|
| **Cockpit Maths 1ère — RAG Sources** | `POST /api/programme/maths-1ere/rag` | ChromaDB (primaire) → pgvector (fallback) | — (retrieval only) | ChromaDB: `nomic-embed-text` ; pgvector: `text-embedding-3-small` | pgvector si ChromaDB down | `app/api/programme/maths-1ere/rag/route.ts:84-151` |
| **Cockpit Maths 1ère — RAG Flash Card** | Idem (via `/api/programme/maths-1ere/rag`) | Idem | — | Idem | Idem | `app/programme/maths-1ere/components/RAG/RAGFlashCard.tsx:97` |
| **Cockpit Maths 1ère — RAG Remediation** | Idem | Idem | — | Idem | Idem | `app/programme/maths-1ere/components/RAG/RAGRemediation.tsx:141` |
| **Cockpit Maths 1ère — ChapterFooter Sources** | Idem | Idem | — | Idem | Idem | `app/programme/maths-1ere/components/RAGSources.tsx:95` |
| **Examen Blanc — Remediation** | Idem | Idem | — | Idem | Idem | `app/programme/maths-1ere/components/Examen/ExamenBlancView.tsx:805` |
| **Vue Enseignant — Remediation** | Idem | Idem | — | Idem | Idem | `app/programme/maths-1ere/components/Enseignant/TeacherView.tsx:497` |
| **ARIA Chat (non-streaming)** | `POST /api/aria/chat` | pgvector (primaire) → keyword (fallback) | OpenAI (`gpt-4o-mini`) | pgvector: `text-embedding-3-small` | Keyword search si embedding vide | `lib/aria.ts:50-93`, `lib/aria.ts:96-148` |
| **ARIA Chat (streaming)** | `POST /api/aria/chat` (SSE) | Keyword search **uniquement** (pas de pgvector) | OpenAI (`gpt-4o-mini`) | — | Aucun fallback vectoriel | `lib/aria-streaming.ts:28-41` |
| **Bilan pré-stage Maths** | `POST /api/bilan-pallier2-maths` | ChromaDB (via `ragSearch`) | Ollama (`llama3.2:latest`) | ChromaDB: `nomic-embed-text` | Template si Ollama down | `lib/bilan-generator.ts:261-278`, `lib/bilan-generator.ts:216-237` |
| **Bilan pré-stage retry** | `POST /api/bilan-pallier2-maths/retry` | ChromaDB (via `ragSearch`) | Ollama (`llama3.2:latest`) | Idem | Template si Ollama down | `app/api/bilan-pallier2-maths/retry/route.ts:93` |
| **Bilan assessment (universel)** | `POST /api/assessments/submit` → `BilanGenerator.generate()` | **Aucun RAG** | Ollama (`llama3.2:latest`) | — | Template stub si LLM_MODE=stub/off | `lib/assessments/generators/index.ts:234` |
| **ARIA page publique** | `/plateforme-aria` | — | — (démo client) | — | Message statique | `app/plateforme-aria/page.tsx` |

### 2.2 Configuration runtime

| Variable | Valeur dev/docker-compose | Valeur prod | Fichier |
|----------|--------------------------|-------------|---------|
| `OPENAI_API_KEY` | `ollama` ou clé réelle | Clé réelle ou vide | `.env`, `.env.production` |
| `OPENAI_MODEL` | `gpt-4o-mini` | `gpt-4o-mini` | `.env.example:59` |
| `OPENAI_BASE_URL` | Optionnel | Non défini | `lib/aria.ts:7` |
| `OLLAMA_URL` | `http://ollama:11434` | `http://ollama:11434` | `docker-compose.yml:38` |
| `OLLAMA_MODEL` | `llama3.2:latest` (docker) / `qwen2.5:32b` (.env.example) | `llama3.2:latest` | `docker-compose.yml:39`, `.env.example:74` |
| `OLLAMA_TIMEOUT` | `180000` | `180000` | `docker-compose.yml:40` |
| `RAG_INGESTOR_URL` | `http://ingestor:8001` | `https://rag-api.nexusreussite.academy` | `docker-compose.yml:42`, `.env.production:49` |
| `RAG_API_TOKEN` | — | Token hardcodé | `.env.production:48` |
| `RAG_SEARCH_TIMEOUT` | `10000` | `10000` | `docker-compose.yml:43` |
| `LLM_MODE` | `live` | `live` | `.env.example:88` |

**Incohérence modèle Ollama** : `.env.example` dit `qwen2.5:32b`, `docker-compose.yml` force `llama3.2:latest`, `lib/bilan-generator.ts:225` utilise `llama3.2:latest`, `lib/assessments/generators/index.ts:235` hardcode `llama3.2:latest`. La valeur `.env.example` est ignorée en Docker.

---

## 3. ChromaDB vs pgvector (Q2)

### 3.1 Corpus indexés

| Système | Collection / Table | Contenu attendu | Modèle embedding | Dimensions | Preuve |
|---------|-------------------|-----------------|-------------------|------------|--------|
| **ChromaDB** | `ressources_pedagogiques_premiere_maths` | Cours, méthodes, erreurs classiques, exercices Maths 1ère | `nomic-embed-text` (768d) | 768 | `lib/rag-client.ts:4`, `lib/bilan-generator.ts:15` |
| **ChromaDB** | `ressources_pedagogiques_terminale` | Idem pour Terminale | `nomic-embed-text` (768d) | 768 | `lib/rag-client.ts:90` (collection par défaut) |
| **ChromaDB** | `ressources_pedagogiques_nsi_premiere` | NSI 1ère | `nomic-embed-text` (768d) | 768 | `lib/diagnostics/definitions/nsi-premiere-p2.ts:116` |
| **ChromaDB** | `ressources_pedagogiques_nsi_terminale` | NSI Terminale | `nomic-embed-text` (768d) | 768 | `lib/diagnostics/definitions/nsi-terminale-p2.ts:112` |
| **pgvector** | `pedagogical_contents.embedding_vector` | Contenus pédagogiques multi-matières | `text-embedding-3-small` (OpenAI, 1536d) | 1536 | `lib/aria.ts:38-39`, `prisma/migrations/20260220000000_add_pgvector/migration.sql` |

### 3.2 Synchronisation

**Aucune.** Les deux systèmes sont totalement indépendants :
- ChromaDB est alimenté par un **ingestor FastAPI externe** (`infra-ingestor-1` sur `infra_rag_net`). Le code d'ingestion **n'est pas dans ce repo** — il est opérationnel mais invisible.
- pgvector est alimenté par un **processus hors-repo** également : aucune route dans le repo n'écrit `embedding_vector`. Le seed Prisma contient un placeholder (`[]`).
- Les modèles d'embedding sont **incompatibles** : `nomic-embed-text` (768d) ≠ `text-embedding-3-small` (1536d).
- Les seuils de similarité diffèrent : ChromaDB `score_threshold: 0.5`, pgvector `similarity > 0.35` (ARIA) / `> 0.35` (RAG fallback).

### 3.3 Comportement selon les routes

| Route | Primaire | Fallback | Comportement observé |
|-------|---------|----------|---------------------|
| `/api/programme/maths-1ere/rag` | ChromaDB | pgvector | Si ChromaDB timeout/erreur → pgvector. Si pgvector échoue aussi → `{ hits: [], source: 'none' }` |
| `lib/aria.ts` (ARIA non-streaming) | pgvector | Keyword search Prisma | Si embedding vide (pas de clé OpenAI) → keyword fallback. ChromaDB **jamais utilisé** |
| `lib/aria-streaming.ts` (ARIA streaming) | Keyword search **uniquement** | Aucun | pgvector **jamais utilisé** en streaming. ChromaDB **jamais utilisé** |
| `lib/bilan-generator.ts` (bilans) | ChromaDB | Aucun retrieval fallback | Si ChromaDB down → `ragContext = ''`, bilan généré sans contexte RAG |

### 3.4 Verdict

**Migration inachevée + dette critique.**

1. pgvector et ChromaDB couvrent **le même type de contenu** (ressources pédagogiques) mais avec des **embedding models incompatibles**, rendant le fallback sémantiquement incohérent.
2. L'ARIA chat streaming a **régressé** : il n'utilise plus pgvector alors que la version non-streaming le fait.
3. Le bilan generator utilise ChromaDB sans fallback pgvector — une panne ChromaDB produit des bilans **sans contexte pédagogique** sans alerte.
4. Les corpus indexés sont potentiellement disjoints car les processus d'ingestion sont hors-repo et non documentés.

---

## 4. Ollama réel (Q3)

### 4.1 Endpoints qui appellent Ollama

| Endpoint / Module | Fonction | Modèle | Timeout | Format |
|-------------------|----------|--------|---------|--------|
| `lib/bilan-generator.ts` → `generateSingleBilan()` | Bilans pré-stage (3 audiences séquentiellement) | `llama3.2:latest` (env fallback) | 120 000 ms | Markdown libre |
| `lib/assessments/generators/index.ts` → `BilanGenerator.generate()` | Bilans assessment (3 audiences en parallèle) | `llama3.2:latest` (hardcodé) | 120 000 ms (défaut client) | Markdown libre |
| `lib/ollama-client.ts` → `generateWithFallback()` | Génération avec fallback | Configurable | Configurable | Configurable |

### 4.2 Gestion des erreurs

| Scénario | Comportement | Robustesse | Preuve |
|----------|-------------|-----------|--------|
| Ollama down (bilan pré-stage) | `generateFallbackBilans()` — template statique | ✅ Correct | `lib/bilan-generator.ts:307-310` |
| Ollama timeout (bilan pré-stage) | `catch` → `errorCode: OLLAMA_TIMEOUT` → status `FAILED` | ✅ Correct | `app/api/bilan-pallier2-maths/route.ts:179` |
| Ollama empty response | Détecté si `< 50 chars` → throw | ✅ Correct | `lib/bilan-generator.ts:239-241` |
| Ollama down (assessment bilan) | `errorCode: LLM_GENERATION_FAILED` → `COMPLETED` (scoring préservé) | ✅ Exemplaire | `lib/assessments/generators/index.ts:158-170` |
| Ollama down (generateWithFallback) | Health check → message fallback français | ✅ Correct | `lib/ollama-client.ts:203-230` |
| **Aucun retry automatique** (bilan pré-stage) | Échec → `FAILED`, retry manuel via `/retry` | ⚠️ Acceptable | `app/api/bilan-pallier2-maths/retry/route.ts` |

### 4.3 Paramètres critiques

- **Temperature** : `0.5` (bilan pré-stage), `0.7` (assessment bilan, ARIA) — aucune justification documentée pour la différence.
- **Max tokens** : `2048` (pré-stage), `2000` (assessment), `1000` (ARIA) — cohérent.
- **Timeout** : `120000` ms par défaut, `180000` en docker-compose — incohérence.
- **Streaming** : `false` pour tous les appels Ollama. Pas de streaming Ollama côté bilan.
- **JSON mode** : jamais utilisé pour les bilans (Markdown libre). Risque de parsing fragile.
- **Retries** : 0 automatiques. Retry manuel staff-only via `/retry`.

### 4.4 Code mort / mock

- `generateWithFallback()` dans `lib/ollama-client.ts:203-230` est **exporté mais jamais importé** en dehors des tests. Code mort potentiel.
- `LLM_MODE=stub` dans `BilanGenerator` est bien utilisé en tests mais jamais activé en prod (correct).
- `LLM_MODE=off` en e2e (`docker-compose.e2e.yml:62`) — correct.

---

## 5. Qualité produit du RAG — Traçabilité source (Q4)

### 5.1 Surfaces avec traçabilité source

| Surface | Affiche la source ? | Badge moteur | Score affiché | Document visible | Verdict |
|---------|-------------------|-------------|--------------|-----------------|---------|
| `RAGSources.tsx` (ChapterFooter) | ✅ Oui | ✅ `ChromaDB` / `pgvector` / `—` | ✅ Score % | ✅ Document + métadonnées | **Exemplaire** |
| `RAGRemediation.tsx` (Examen/Enseignant) | ✅ Oui | ✅ Source config label | ✅ Score % | ✅ Document + type badge | **Bon** |
| `RAGFlashCard.tsx` (Cockpit) | ❌ Non | ❌ Pas de badge source | ❌ Pas de score | ✅ Document partiel (300 chars) | **Insuffisant** |
| **ARIA Chat** (`aria-chat.tsx`) | ❌ Non | ❌ Aucune traçabilité | ❌ Aucun score | ❌ Texte LLM seul | **Absent** |
| **Bilans pré-stage** (PDF/Markdown) | ❌ Non | ❌ Aucun | ❌ Aucun | ❌ Bilan LLM seul | **Absent** |
| **Bilans assessment** (Markdown) | ❌ Non | ❌ Aucun | ❌ Aucun | ❌ Aucun RAG utilisé | N/A |

### 5.2 Problèmes de traçabilité

1. **`source: 'chroma'` est un label legacy trompeur** — la RAG route retourne `source: 'chroma'` même quand le moteur réel est l'API externe Nexus RAG (qui utilise ChromaDB en interne, certes, mais le label masque l'architecture réelle). Preuve : `app/api/programme/maths-1ere/rag/route.ts:109` — commentaire `// Legacy key used for UI consistency`.

2. **ARIA Chat ne montre aucune source** — Le LLM reçoit le contexte RAG en system prompt (`CONTEXTE NEXUS RÉUSSITE (Sources vérifiées)`) mais la réponse LLM ne les restitue pas. L'utilisateur n'a aucun moyen de vérifier d'où vient l'information.

3. **Bilans pré-stage n'exposent pas les sources RAG** — `ragContext` est injecté dans le prompt LLM, mais les `hits` ne sont pas persistés. Le champ `ragUsed: false` est hardcodé dans la route même quand le RAG fonctionne (`app/api/bilan-pallier2-maths/route.ts:173`).

4. **RAGFlashCard ne distingue pas le moteur** — Le composant ne lit pas `data.source` de la réponse API, perdant l'info ChromaDB vs pgvector.

---

## 6. Cohérence embeddings / indexation (Q5)

### 6.1 Modèles d'embedding utilisés

| Contexte | Modèle | Dimensions | Provider | Preuve |
|----------|--------|-----------|----------|--------|
| ARIA pgvector (query) | `text-embedding-3-small` | 1536 | OpenAI API | `lib/aria.ts:38-39` |
| pgvector column (index) | `text-embedding-3-small` (supposé) | 1536 | Hors-repo | `prisma/migrations/20260220000000_add_pgvector/migration.sql` |
| ChromaDB (ingestor) | `nomic-embed-text` | 768 | Ollama local | `lib/bilan-generator.ts:15` (commentaire) |
| RAG route pgvector fallback (query) | `text-embedding-3-small` | 1536 | OpenAI API | `app/api/programme/maths-1ere/rag/route.ts:120` via `generateEmbedding()` |

### 6.2 Incohérences critiques

1. **pgvector stocke du 1536d, ChromaDB stocke du 768d** — le fallback pgvector après ChromaDB n'est pas un vrai fallback sémantique car les espaces vectoriels sont incompatibles.

2. **pgvector query exige une clé OpenAI** — si `OPENAI_API_KEY` est `'ollama'` ou vide, `generateEmbedding()` retourne `[]` et le fallback pgvector est silencieusement désactivé. Preuve : `lib/aria.ts:33-36`.

3. **Ingestion pgvector hors-repo** — aucun script dans le repo n'écrit `embedding_vector`. Le processus d'indexation est opaquement opéré hors du cycle CI/CD.

4. **Ingestion ChromaDB hors-repo** — le code FastAPI ingestor (`infra-ingestor-1`) est sur un autre repo/infra. Les collections référencées (`ressources_pedagogiques_premiere_maths`, etc.) ne sont créées par aucun code de ce repo.

5. **Colonne `embedding` legacy (Json)** — toujours dans le schéma Prisma (`PedagogicalContent.embedding`), jamais lue à runtime. Confusion avec `embedding_vector`.

6. **HNSW index** — un index HNSW existe sur `embedding_vector` (migration `20260220000000`). Pas de preuve que l'index est correctement paramétré pour les dimensions réelles.

---

## 7. Risques sécurité / confidentialité / robustesse (Q6)

### 7.1 Findings sécurité

| # | Risque | Sévérité | Preuve |
|---|--------|---------|--------|
| **R1** | **RAG route sans RBAC granulaire** — `POST /api/programme/maths-1ere/rag` exige `auth()` mais pas de vérification ELEVE/rôle. Tout utilisateur authentifié (COACH, PARENT, ADMIN) peut interroger le RAG. | **P2** | `app/api/programme/maths-1ere/rag/route.ts:64-67` |
| **R2** | **ARIA chat protégé correctement** — rôle ELEVE + subscription ARIA vérifiés. | ✅ OK | `app/api/aria/chat/route.ts:35-100` |
| **R3** | **RAG_API_TOKEN en clair dans `.env.production`** — déjà signalé F3 AXE 1. | **P0** (connu) | `.env.production:48` |
| **R4** | **Prompts contiennent données PII** — `bilan-generator.ts` injecte nom, prénom, établissement, email, moyenne dans le prompt Ollama. Si Ollama est externe (cloud), fuite potentielle. | **P1** | `lib/bilan-generator.ts:71-72` |
| **R5** | **Pas de fuite corpus entre parcours** — Les RAG queries filtrent par `section` ou `subject`. ChromaDB utilise des collections séparées par matière/niveau. | ✅ OK | `app/api/programme/maths-1ere/rag/route.ts:88`, `lib/diagnostics/definitions` |
| **R6** | **Timeout sans retry** — Une panne ChromaDB produit un bilan sans contexte RAG, sans alerte visible côté staff. | **P2** | `lib/bilan-generator.ts:276-278` |
| **R7** | **`ragUsed: false` hardcodé** — Le champ `ragUsed` dans le diagnostic est toujours `false` même quand le RAG réussit. Staff ne peut pas auditer la qualité RAG. | **P2** | `app/api/bilan-pallier2-maths/route.ts:173` |
| **R8** | **ARIA streaming sans vectoriel** — `lib/aria-streaming.ts:28-41` fait une recherche keyword `contains` (case-sensitive, pas de stemming), qualité retrieval très faible. | **P1** | `lib/aria-streaming.ts:28-41` |
| **R9** | **OpenAI SDK avec `baseURL` optionnel** — Si `OPENAI_BASE_URL` est défini, ARIA peut pointer vers n'importe quel proxy. Pas de validation du endpoint. | **P3** | `lib/aria.ts:7` |

### 7.2 Robustesse réseau

| Dépendance | Timeout | Fallback | Comportement si down |
|-----------|---------|----------|---------------------|
| ChromaDB ingestor | 12 000 ms | pgvector (RAG route seulement) | Bilan sans RAG, cockpit pgvector |
| pgvector (embedding query) | Dépend OpenAI API | Keyword search | ARIA dégrade en keyword |
| OpenAI API (ARIA) | SDK default (non configuré) | Message erreur statique | ARIA retourne erreur |
| Ollama (bilans) | 120 000 ms | Template statique | Bilan template, status FAILED |
| OpenAI API (embedding ARIA) | SDK default | `return []` → keyword | Silencieux |

---

## 8. Findings classés par sévérité

| # | Finding | Sévérité | Effort | LOT |
|---|---------|---------|--------|-----|
| F26 | **ARIA streaming sans retrieval vectoriel** — `aria-streaming.ts` fait du keyword `contains` uniquement, régression vs `aria.ts` qui utilise pgvector | **P1** | S | LOT 6 |
| F27 | **Embeddings incompatibles** — pgvector (`text-embedding-3-small`, 1536d) ≠ ChromaDB (`nomic-embed-text`, 768d). Le fallback pgvector après ChromaDB est sémantiquement incohérent | **P1** | M | LOT 6 |
| F28 | **`ragUsed: false` hardcodé** — le champ diagnostic est toujours `false` même quand RAG réussit. Pas d'audit qualité RAG possible côté staff | **P1** | S | LOT 6 |
| F29 | **PII dans prompts Ollama** — nom, prénom, établissement, email injectés dans le prompt LLM local. Risque si Ollama est externalisé | **P1** | M | LOT 6 |
| F30 | **Bilan sans RAG silencieux** — ChromaDB down → bilan généré sans contexte pédagogique, aucune alerte staff | **P2** | S | LOT 6 |
| F31 | **RAG route sans RBAC rôle** — tout authentifié peut interroger le RAG Maths 1ère (COACH, PARENT, ADMIN). Pas critique mais non conforme | **P2** | S | LOT 6 |
| F32 | **Incohérence modèle Ollama** — `.env.example` = `qwen2.5:32b`, docker-compose = `llama3.2:latest`, code = `llama3.2:latest`. Confusion | **P2** | XS | LOT 6 |
| F33 | **Ingestion embedding hors-repo** — ni pgvector ni ChromaDB n'ont de script d'ingestion dans le repo. Processus invisible | **P2** | M | LOT 6 |
| F34 | **`source: 'chroma'` label legacy** — masque l'architecture réelle (API externe). UI trompeuse | **P3** | S | LOT 6 |
| F35 | **Maths Terminale sans RAG** — pas de route RAG dédiée. Les bilans Terminale utiliseraient ChromaDB via `ragPolicy.collections` mais aucune surface UI RAG | **P3** | M | LOT 6 |
| F36 | **`generateWithFallback()` code mort** — exporté mais jamais importé en prod | **P3** | XS | LOT 6 |

---

## 9. Décision d'architecture cible (Q7)

### 9.1 Moteur retrieval canonique : **ChromaDB (via API ingestor)**

**Garder ChromaDB.** Raisons :
- Collection par matière/niveau déjà en place (4 collections)
- `ragPolicy` dans les `DiagnosticDefinition` pointe vers ChromaDB
- L'API ingestor existe et fonctionne sur le serveur prod
- `nomic-embed-text` (local) évite la dépendance cloud pour l'indexation

**Supprimer pgvector comme moteur retrieval.** Raisons :
- L'embedding est incompatible (1536d vs 768d) → le fallback est sémantiquement faux
- La query pgvector exige une clé OpenAI → dépendance cloud pour le fallback
- Le corpus pgvector n'est pas synchronisé avec ChromaDB
- Le fallback donne une fausse impression de résilience

**Conserver `embedding_vector` comme colonne future** mais ne plus l'utiliser en production tant que l'embedding model n'est pas unifié avec ChromaDB.

### 9.2 Moteur génération canonique

| Surface | Moteur recommandé | Raison |
|---------|-------------------|--------|
| **ARIA Chat** | **OpenAI** (garder) | Streaming natif, latence faible, UX conversationnelle. Mais aligner le retrieval avec ChromaDB. |
| **Bilans pré-stage** | **Ollama** (garder) | Données PII → rester local. Template fallback OK. |
| **Bilans assessment** | **Ollama** (garder) | Cohérent avec bilans pré-stage. |

### 9.3 Plan de convergence

```
ÉTAT ACTUEL                          CIBLE LOT 6
─────────────                        ───────────
ARIA streaming:  keyword search  →   ChromaDB retrieval (via rag-client.ts)
ARIA non-stream: pgvector+keyword →   ChromaDB retrieval (via rag-client.ts)
RAG route:       ChromaDB→pgvector →  ChromaDB only (supprimer fallback pgvector)
Bilans:          ChromaDB seul    →   ChromaDB (garder) + persister ragUsed/ragHits
Embedding:       2 modèles        →   1 modèle (nomic-embed-text via ChromaDB)
Source UI:       partiel           →   badge source sur toutes les surfaces
Ingestion:       hors-repo         →   script d'ingestion intégré au repo (documentation)
```

### 9.4 Endpoints à réécrire

| Endpoint / Module | Changement |
|-------------------|-----------|
| `lib/aria-streaming.ts` | Remplacer `searchKnowledgeBase` (keyword) par `ragSearch` (ChromaDB) |
| `lib/aria.ts` → `searchKnowledgeBase` | Remplacer pgvector+keyword par `ragSearch` (ChromaDB) |
| `app/api/programme/maths-1ere/rag/route.ts` | Supprimer Circuit B (pgvector fallback). Garder ChromaDB seul. |
| `lib/bilan-generator.ts` | Persister `ragUsed`, `ragHitCount`, `ragCollections` dans le diagnostic |
| `app/api/bilan-pallier2-maths/route.ts` | Lire le vrai `ragUsed` au lieu de hardcoder `false` |

### 9.5 Surfaces UI à améliorer

| Surface | Changement |
|---------|-----------|
| `RAGFlashCard.tsx` | Ajouter badge source (déjà dans la réponse API, non lu) |
| `AriaChat` (`aria-chat.tsx`) | Afficher les sources RAG utilisées (nécessite changement API réponse) |
| Bilans (Markdown) | Optionnel : section "Sources consultées" en pied de bilan |

---

## 10. Prompt Windsurf — LOT 6

```
Contexte : Nexus Réussite repo local (/home/alaeddine/Bureau/nexus-project_v0).
Audit 2026-04-19 — LOT 6 RAG/LLM consolidation.
Voir docs/AUDIT_SENIOR_2026-04-19/07_RAG_LLM_ARCHITECTURE.md.

═══ SOUS-LOT 6a — P1 : ARIA retrieval → ChromaDB ═══

1. lib/aria.ts :
   - Remplacer searchKnowledgeBase() par :
     const hits = await ragSearch({ query, section: subject.toLowerCase(), k: 3 });
   - Supprimer generateEmbedding() (plus besoin pour ARIA)
   - Reformater le contexte avec buildRAGContext(hits)
   - Garder la signature generateAriaResponse() inchangée

2. lib/aria-streaming.ts :
   - Remplacer searchKnowledgeBase() par ragSearch() (même pattern que aria.ts)
   - Importer { ragSearch, buildRAGContext } from '@/lib/rag-client'

3. Tests : __tests__/lib/aria.test.ts, aria-streaming.test.ts
   - Mocker ragSearch au lieu de prisma.pedagogicalContent

═══ SOUS-LOT 6b — P1 : Supprimer fallback pgvector RAG route ═══

1. app/api/programme/maths-1ere/rag/route.ts :
   - Supprimer le Circuit B (pgvector fallback) lignes 118-154
   - Supprimer l'import generateEmbedding
   - Si ChromaDB échoue → retourner { hits: [], source: 'none' } directement

2. Corriger le label source :
   - Remplacer source: 'chroma' par source: 'rag-api'
   - Mettre à jour SOURCE_LABEL et SOURCE_COLOR dans RAGSources.tsx et RAGRemediation.tsx

═══ SOUS-LOT 6c — P1 : Persister ragUsed dans diagnostics ═══

1. lib/bilan-generator.ts → generateBilans() :
   - Retourner { eleve, parents, nexus, ragUsed: boolean, ragHitCount: number }

2. app/api/bilan-pallier2-maths/route.ts :
   - Lire ragUsed et ragHitCount depuis le résultat de generateBilans
   - Persister dans prisma.diagnostic.update({ data: { ragUsed, ragCollections } })

3. app/api/bilan-pallier2-maths/retry/route.ts : idem

═══ SOUS-LOT 6d — P2 : UI traçabilité ═══

1. RAGFlashCard.tsx : lire data.source de la réponse API, afficher badge

2. Nettoyage :
   - .env.example : harmoniser OLLAMA_MODEL=llama3.2:latest
   - Supprimer generateWithFallback() de ollama-client.ts (code mort)
   - Ajouter un commentaire dans lib/aria.ts expliquant que pgvector est
     désactivé volontairement (référence audit AXE 7)

═══ SOUS-LOT 6e — P2 : PII dans prompts ═══

1. lib/bilan-generator.ts → prepareLLMContext() :
   - Remplacer le prénom/nom par un placeholder : "ÉLÈVE: [Prénom] [NOM]"
   - Ne pas envoyer l'email
   - Ré-injecter le prénom dans le bilan après génération

2. Même traitement pour le bloc identityBlock dans generateBilans()

Contraintes :
- Ne pas modifier la prod
- npm run build → 0 erreurs
- npm test → pas de régressions
- Chaque sous-lot = 1 commit séparé
```
