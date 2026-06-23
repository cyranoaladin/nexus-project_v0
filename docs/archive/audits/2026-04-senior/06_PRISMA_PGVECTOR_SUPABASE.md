# AXE 6 — Prisma + pgvector + Supabase parallèle

> Audit Senior Nexus Réussite — 2026-04-19
> Repo : `cyranoaladin/nexus-project_v0`, branch `main`

---

## 1. Résumé exécutif

Le produit utilise **5 systèmes de stockage** en parallèle sans arbitrage clair :

| # | Système | Rôle réel | Risque |
|---|---------|-----------|--------|
| 1 | **PostgreSQL via Prisma** | Source de vérité principale (users, sessions, assessments, subscriptions, stages, ARIA, invoices) | Faible |
| 2 | **PostgreSQL via `$executeRawUnsafe` / `$queryRawUnsafe`** | SSN, UAI, DomainScore, SkillScore, progression_history, projection_history, invoice_sequences, directeur/stats | **Élevé** — schéma Prisma incomplet, contourne le client typé |
| 3 | **Supabase (externe)** | Table `maths_lab_progress` — progression Maths 1ère et Terminale | **Critique** — double écriture avec localStorage, aucune reconciliation |
| 4 | **pgvector (PostgreSQL)** | Colonne `embedding_vector` sur `pedagogical_contents` — recherche sémantique ARIA | Modéré |
| 5 | **ChromaDB (FastAPI externe)** | Collection `ressources_pedagogiques_terminale` — RAG bilan + Maths 1ère | **Élevé** — doublon fonctionnel avec pgvector |

En plus, **2 stockages client** :
- **Zustand + localStorage** (`nexus-maths-lab-v2`, `nexus-maths-terminale-lab-v1`) — source de vérité *de facto* pour la progression
- **Fichier disque** (`data/invoices/`) — PDFs factures

**Verdict global** : L'architecture data est fragmentée. La progression élève a **3 sources de vérité divergentes** (localStorage, Supabase, aucune écriture Prisma). Les scores SSN/UAI sont écrits en SQL brut par nécessité historique alors que les modèles Prisma existent déjà. ChromaDB et pgvector se marchent dessus pour le RAG.

---

## 2. Carte des stockages réels

### 2.1 PostgreSQL via Prisma (client typé)

| Concept métier | Tables Prisma | Fichiers principaux |
|---|---|---|
| Utilisateurs, rôles, activation | `users`, `parent_profiles`, `students`, `coach_profiles` | `lib/prisma.ts`, divers API routes |
| Sessions, booking | `sessions`, `session_bookings`, `session_reports` | `app/api/sessions/`, `app/api/coaches/` |
| Subscriptions, crédits | `subscriptions`, `credit_transactions`, `subscription_requests` | `app/api/assistant/` |
| Paiements | `payments`, `clictopay_transactions` | `app/api/payments/` |
| ARIA conversations | `aria_conversations`, `aria_messages` | `lib/aria.ts` |
| Stages | `stages`, `stage_sessions`, `stage_coaches`, `stage_bilans`, `stage_reservations`, `stage_documents` | `app/api/stages/` |
| Badges | `badges`, `student_badges` | `lib/badges.ts` |
| Notifications | `notifications`, `session_notifications`, `session_reminders` | `app/api/notifications/` |
| Invoices | `invoices`, `invoice_sequences` | `lib/invoice/` |
| Trajectoires | `trajectories` | `app/api/student/trajectory/` |
| Entitlements | `entitlements` | `lib/entitlements.ts` |
| Documents | `user_documents` | `app/api/admin/documents/` |

**Source de vérité** : ✅ Oui — référentiel de données principal.

### 2.2 PostgreSQL via SQL brut (`$queryRawUnsafe` / `$executeRawUnsafe`)

165 occurrences dans 36 fichiers. Voici les usages **non-test** :

| Usage | Tables touchées | Fichier | Justifié ? |
|---|---|---|---|
| UPDATE assessments SET ssn | `assessments.ssn` | `lib/core/ssn/computeSSN.ts:192,264` | ❌ Colonne dans le schéma Prisma depuis migration |
| SELECT studentId FROM assessments | `assessments.studentId` | `lib/core/ssn/computeSSN.ts:199` | ❌ idem |
| INSERT INTO progression_history | `progression_history` | `lib/core/ssn/computeSSN.ts:208` | ❌ Modèle `ProgressionHistory` existe dans Prisma |
| SELECT FROM progression_history | `progression_history` | `lib/core/ml/predictSSN.ts:230` | ❌ idem |
| INSERT INTO projection_history | `projection_history` | `lib/core/ml/predictSSN.ts:264` | ❌ Modèle `ProjectionHistory` existe dans Prisma |
| SELECT ssn FROM assessments (AVG, distribution, alerts, groupBy) | `assessments.ssn` | `app/api/admin/directeur/stats/route.ts:72-173` (5×) | ⚠️ Partially — agrégats complexes, mais `ssn` est dans le schéma |
| UPDATE assessments SET assessmentVersion, engineVersion | `assessments` | `app/api/assessments/submit/route.ts:147` | ❌ Colonnes dans le schéma |
| INSERT INTO domain_scores | `domain_scores` | `app/api/assessments/submit/route.ts:179` | ❌ Modèle `DomainScore` existe |
| SELECT ssn, domain, skill FROM assessments/domain_scores/skill_scores | `assessments`, `domain_scores`, `skill_scores` | `app/api/assessments/[id]/result/route.ts`, `/export/route.ts` | ❌ Modèles existent |
| SELECT DISTINCT ON subject, ssn FROM assessments + UPDATE uai | `assessments` | `lib/core/uai/computeUAI.ts:121,143` | ❌ Colonnes dans le schéma |
| INSERT INTO invoice_sequences ... ON CONFLICT | `invoice_sequences` | `lib/invoice/sequence.ts:31` | ⚠️ Justifié — atomic upsert + RETURNING pas supporté par Prisma |
| SELECT 1 (health check) | — | `app/api/health/route.ts:16` | ✅ Justifié — diagnostic |
| pgvector similarity search | `pedagogical_contents` | `lib/aria.ts:59`, `app/api/programme/maths-1ere/rag/route.ts:124` | ✅ Justifié — opérateur `<=>` non supporté par Prisma |

**Bilan** : Sur 12 usages production non-test, **8 sont injustifiés** — les colonnes et modèles Prisma correspondants existent déjà dans `schema.prisma`. Les commentaires `"column may not be in generated client yet"` datent de février 2026. Le `prisma generate` a été exécuté depuis et les modèles sont dans le schéma.

**Cause racine** : Le `TODO [TICKET NEX-42, NEX-43]` dans `submit/route.ts` confirme explicitement que ces raw SQL devaient être remplacés après `prisma generate`. Cela n'a jamais été fait.

### 2.3 Supabase (PostgreSQL externe)

| Table | Concepts | Écriture | Lecture | Fichiers |
|---|---|---|---|---|
| `maths_lab_progress` | Progression Maths 1ère : chapitres, XP, badges, streak, exerciseResults, SRS, diagnostics, hints, temps | API POST (service role) + fallback client direct (anon key) | Client `loadProgressWithStatus` (anon key) | `app/api/programme/maths-1ere/progress/route.ts`, `app/programme/maths-1ere/lib/supabase.ts` |
| `maths_lab_progress` | Progression Maths Terminale (même table !) | API POST (service role) | API GET (service role) | `app/api/programme/maths-terminale/progress/route.ts` |

**Tables commentées mais jamais créées** (SQL en commentaire dans `supabase.ts:172-288`) :
- `themes`, `chapters`, `learning_nodes`, `user_node_progress`
- Ces tables ne sont ni dans Prisma, ni dans Supabase en runtime — elles restent du CdC non implémenté.

**Source de vérité** : ⚠️ Supabase est la source primaire pour la progression Maths, mais localStorage via Zustand est la source *de facto* car elle est lue en premier et Supabase n'est qu'un fallback de persist.

### 2.4 pgvector (extension PostgreSQL)

| Table | Colonne | Dimensions | Index | Fichiers lisant | Fichiers écrivant |
|---|---|---|---|---|---|
| `pedagogical_contents` | `embedding_vector` | 1536 (text-embedding-3-small) | HNSW cosine | `lib/aria.ts:59`, `app/api/programme/maths-1ere/rag/route.ts:124` | Aucun fichier dans le repo — probablement un script d'ingest externe |

Migration : `20260220000000_add_pgvector/migration.sql` — `CREATE EXTENSION IF NOT EXISTS vector`.

**Usage réel** : pgvector est le fallback (Circuit B) quand ChromaDB est indisponible. Il est activement utilisé en runtime pour la recherche sémantique ARIA et le RAG Maths 1ère.

### 2.5 ChromaDB (FastAPI externe — "Ingestor")

| Aspect | Détail |
|---|---|
| URL prod | `http://ingestor:8001` (Docker `infra_rag_net`) |
| URL fallback | `https://rag-api.nexusreussite.academy` (externe) |
| Collection | `ressources_pedagogiques_terminale` |
| API | POST `/search`, POST `/ingest`, GET `/health`, GET `/collections/{name}/stats` |
| Client | `lib/rag-client.ts` |
| Consommateurs | `app/api/programme/maths-1ere/rag/route.ts` (Circuit A), `lib/bilan-generator.ts` (bilan RAG context) |

**Usage réel** : ChromaDB est le circuit primaire (A) pour le RAG. pgvector est le fallback (B). Les deux indexent des contenus pédagogiques mais avec des collections et des modèles d'embedding différents.

### 2.6 Zustand + localStorage

| Store key | Module | Concepts | Fichier |
|---|---|---|---|
| `nexus-maths-lab-v2` (v5) | Maths 1ère | completedChapters, masteredChapters, totalXP, quizScore, combo, streak, badges, SRS, diagnostics, hints, timePerChapter, etc. (21 champs) | `app/programme/maths-1ere/store.ts` |
| `nexus-maths-terminale-lab-v1` (v1) | Maths Terminale | Même structure | `app/programme/maths-terminale/store.ts` |

**Particularité critique** : Les stores Zustand utilisent `persist()` avec localStorage. À l'hydratation, `useProgressionSync.ts` lit depuis Supabase et merge dans Zustand. Mais si Supabase est indisponible, localStorage est la seule source. Les données sont éphémères (si l'utilisateur efface son cache, tout est perdu).

### 2.7 Fichier disque

| Chemin | Concept | Fichier |
|---|---|---|
| `data/invoices/facture_*.pdf` | Factures PDF générées | `lib/invoice/storage.ts` |
| `storage/` (volume Docker) | Documents uploadés | `app/api/admin/documents/route.ts` |

---

## 3. Concepts dupliqués / parallèles (Q2)

| Concept | Stockage A | Stockage B | Stockage C | Conflit possible | Verdict |
|---|---|---|---|---|---|
| **Progression Maths 1ère** | Zustand localStorage (`nexus-maths-lab-v2`) | Supabase `maths_lab_progress` | — | **OUI** : localStorage est lu en premier, Supabase est un write-through avec fallback. Si client échoue à écrire et que l'utilisateur change de navigateur, les progressions divergent. | **CRITIQUE** — 3 couches sans reconciliation. localStorage = source *de facto*. Supabase = backup async non garanti. |
| **Progression Maths Terminale** | Zustand localStorage (`nexus-maths-terminale-lab-v1`) | Supabase `maths_lab_progress` (même table !) | — | **OUI** : même problème + les deux modules écrivent dans la même table avec `user_id` comme clé. Les payloads sont différents (Terminale a `error_tags`, `bac_checklist_completions`). Si un utilisateur est inscrit en 1ère ET en Terminale, la dernière écriture écrase. | **CRITIQUE** — collision de données inter-niveaux |
| **SSN (Score Standardisé)** | `assessments.ssn` (Prisma schema) | Écrit via `$executeRawUnsafe` | Lu via `$queryRawUnsafe` | Non — même colonne, mais contourne le typage Prisma | **DETTE** — supprimer le raw SQL |
| **Progression SSN historique** | `progression_history` (Prisma model) | Écrit/lu via `$queryRawUnsafe` uniquement | — | Non — mais le modèle Prisma n'est jamais utilisé via le client typé | **DETTE** — migrer vers Prisma client |
| **Projections SSN** | `projection_history` (Prisma model) | Écrit/lu via `$queryRawUnsafe` uniquement | — | Non — même problème | **DETTE** — migrer vers Prisma client |
| **DomainScore / SkillScore** | Prisma models `DomainScore`, `SkillScore` | Écrits via `$executeRawUnsafe` dans submit | Lus via `$queryRawUnsafe` dans result/export | Non — mais contourne le client typé | **DETTE** — migrer vers Prisma client |
| **UAI** | `assessments.uai` (Prisma schema) | Écrit via `$executeRawUnsafe` | — | Non | **DETTE** |
| **Embeddings pédagogiques** | pgvector `pedagogical_contents.embedding_vector` | ChromaDB `ressources_pedagogiques_terminale` | — | **OUI** : même concept (contenus pédagogiques indexés), modèles d'embedding différents, collections non synchronisées | **ARCHITECTURE** — deux systèmes vectoriels pour un même besoin |
| **Badges Maths** | Zustand localStorage `badges: string[]` | Prisma `student_badges` (table relationnelle) | — | **OUI** : les badges gagnés dans le cockpit Maths sont dans localStorage/Supabase. Les badges persistés dans `student_badges` viennent d'un autre flux. Aucun pont entre les deux. | **PERTE DE DONNÉES** — badges non durables |

---

## 4. Prisma vs SQL brut (Q4)

### 4.1 Inventaire complet des usages production

| # | Fichier | Opération | Table(s) | Justifié | Raison si non |
|---|---------|-----------|----------|----------|---------------|
| 1 | `lib/core/ssn/computeSSN.ts:192` | `$executeRawUnsafe` UPDATE ssn | `assessments` | ❌ | `ssn` est dans le schéma Prisma |
| 2 | `lib/core/ssn/computeSSN.ts:199` | `$queryRawUnsafe` SELECT studentId | `assessments` | ❌ | `studentId` est dans le schéma |
| 3 | `lib/core/ssn/computeSSN.ts:208` | `$executeRawUnsafe` INSERT | `progression_history` | ❌ | Modèle `ProgressionHistory` existe |
| 4 | `lib/core/ssn/computeSSN.ts:264` | `$executeRawUnsafe` UPDATE ssn (batch) | `assessments` | ❌ | idem #1 |
| 5 | `lib/core/ml/predictSSN.ts:230` | `$queryRawUnsafe` SELECT | `progression_history` | ❌ | idem #3 |
| 6 | `lib/core/ml/predictSSN.ts:264` | `$executeRawUnsafe` INSERT | `projection_history` | ❌ | Modèle `ProjectionHistory` existe |
| 7 | `lib/core/uai/computeUAI.ts:121` | `$queryRawUnsafe` DISTINCT ON | `assessments` | ⚠️ | `DISTINCT ON` non supporté Prisma, mais `ssn` l'est |
| 8 | `lib/core/uai/computeUAI.ts:143` | `$executeRawUnsafe` UPDATE uai | `assessments` | ❌ | `uai` dans le schéma |
| 9 | `app/api/assessments/submit/route.ts:147` | `$executeRawUnsafe` UPDATE assessmentVersion, engineVersion | `assessments` | ❌ | Colonnes dans le schéma |
| 10 | `app/api/assessments/submit/route.ts:179` | `$executeRawUnsafe` INSERT | `domain_scores` | ❌ | Modèle `DomainScore` existe |
| 11 | `app/api/assessments/[id]/result/route.ts` | 4× `$queryRawUnsafe` SELECT ssn, domains, skills, cohort | Multiple | ❌ | Modèles existent |
| 12 | `app/api/assessments/[id]/export/route.ts` | 4× `$queryRawUnsafe` | Multiple | ❌ | idem |
| 13 | `app/api/admin/directeur/stats/route.ts` | 5× `$queryRawUnsafe` AVG, distribution, groupBy | `assessments` | ⚠️ | Agrégats complexes justifient SQL pour certains, `ssn` column OK |
| 14 | `lib/invoice/sequence.ts:31` | `$queryRaw` INSERT ON CONFLICT RETURNING | `invoice_sequences` | ✅ | Atomic upsert + RETURNING pas supporté |
| 15 | `lib/aria.ts:59` | `$queryRaw` pgvector similarity | `pedagogical_contents` | ✅ | Opérateur `<=>` pgvector non supporté Prisma |
| 16 | `app/api/programme/maths-1ere/rag/route.ts:124` | `$queryRaw` pgvector | `pedagogical_contents` | ✅ | idem |
| 17 | `app/api/health/route.ts:16` | `$queryRaw SELECT 1` | — | ✅ | Health check standard |

### 4.2 Helper centralisé

`lib/db-raw.ts` fournit `dbExecute()` et `dbQuery()` avec validation anti-injection. Mais **presque aucun fichier de production ne l'utilise** — le code appelle directement `prisma.$executeRawUnsafe`.

### 4.3 Cause racine confirmée

Les fichiers `submit/route.ts:155-159` et `result/route.ts` contiennent explicitement :

> `TODO [TICKET NEX-42]: Remove this try/catch after migrate deploy on production. Once 20260217_learning_graph_v2 is applied and npx prisma generate regenerates the client, switch to typed Prisma fields`

La migration `20260217_learning_graph_v2` **a été appliquée** (elle est dans le dossier migrations). Les modèles `ProgressionHistory`, `ProjectionHistory`, `DomainScore`, `SkillScore` et les colonnes `ssn`, `uai`, `studentId`, `assessmentVersion`, `engineVersion` sont **tous dans `schema.prisma`**. Le `prisma generate` a été exécuté (les relations sont déclarées dans le schéma). Les raw SQL sont donc de la **dette technique résiduelle** — le refactoring promis par NEX-42/NEX-43 n'a jamais été fait.

---

## 5. Supabase : rôle réel (Q3)

### 5.1 Architecture observée

```
┌─────────────────────────────────────────────────────────────┐
│ Navigateur                                                  │
│                                                             │
│   Zustand persist (localStorage)                            │
│   ┌─────────────────────────────────┐                       │
│   │ nexus-maths-lab-v2  (21 champs) │ ← Source de facto     │
│   └──────────┬──────────────────────┘                       │
│              │                                              │
│   useProgressionSync.ts                                     │
│   ┌──────────▼─────────────────┐                            │
│   │ 1. hydrate() → Supabase    │  Lecture client (anon key) │
│   │    ↓ merge into Zustand    │                            │
│   │ 2. subscribe → debounce    │                            │
│   │    ↓ save via API route    │  Écriture primaire          │
│   │    ↓ fallback → Supabase   │  Écriture fallback (anon)  │
│   │ 3. beforeunload → beacon   │  Écriture urgente (API)    │
│   └────────────────────────────┘                            │
│                                                             │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ API Route (Next.js server)       │
│ POST /api/programme/maths-1ere/  │
│      progress                    │
│                                  │
│ ① Auth check (NextAuth)          │
│ ② createClient(url, serviceRole) │
│ ③ Supabase upsert                │
│    maths_lab_progress             │
│    ON CONFLICT user_id            │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ Supabase PostgreSQL (externe)    │
│ Table: maths_lab_progress        │
│ RLS: auth.uid() = user_id        │
└──────────────────────────────────┘
```

### 5.2 Problèmes identifiés

**P1 — Double écriture sans reconciliation** :
- La route API écrit vers Supabase via `serviceRoleKey` (bypass RLS).
- Le fallback client écrit directement vers Supabase via `anon key` (soumis au RLS).
- L'hydratation lit depuis Supabase, mais le merge dans Zustand ne fait que des `??` (ne prend la valeur distante que si la locale est `null/undefined`). Si les deux ont des valeurs non-null mais différentes, **localStorage gagne toujours**.

**P2 — Collision Maths 1ère / Terminale** :
- Les deux modules écrivent dans la **même table** `maths_lab_progress` avec `user_id` comme clé unique.
- Les payloads sont légèrement différents (Terminale a `error_tags`, `bac_checklist_completions`, pas de `diagnostic_results`, `time_per_chapter`, etc.).
- Un élève inscrit aux deux programmes verra ses données de Terminale écrasées par celles de 1ère (ou vice-versa) selon l'ordre de dernière écriture.

**P3 — Perte de progression** :
- Si Supabase est down ou non configuré (`.env` manquant), l'API renvoie `{ ok: true, persisted: false, mode: 'local-only' }` — **sans erreur côté client**. L'utilisateur pense que sa progression est sauvegardée. S'il change de navigateur, tout est perdu.
- Le fallback `saveProgress()` avec `anon key` peut échouer silencieusement.
- Le beacon `sendBeacon` sur `beforeunload` envoie vers l'API route (qui elle-même écrit vers Supabase). Si le serveur n'a pas le temps de traiter avant le timeout, les dernières actions sont perdues.

**P4 — Pas de synchronisation bidirectionnelle** :
- Il n'y a pas de mécanisme de conflit (last-write-wins brut).
- Pas de version vector, pas de timestamp de comparaison.

### 5.3 Questions Supabase — Réponses

| Question | Réponse |
|---|---|
| Quelles tables ? | `maths_lab_progress` uniquement (les tables `themes`, `chapters`, `learning_nodes`, `user_node_progress` sont en commentaire SQL, jamais créées) |
| Écritures API serveur ? | POST `/api/programme/maths-1ere/progress` et `.../maths-terminale/progress` — via `serviceRoleKey` |
| Écritures client directes ? | Oui — `saveProgress()` dans `supabase.ts:128` avec `anon key` (fallback si API échoue) |
| Si l'API échoue ? | Fallback vers client Supabase direct. Si ça aussi échoue, données queued dans `pendingPayloadRef` pour retry. Mais le retry ne survient que si Zustand change à nouveau. |
| Si Supabase diverge de Prisma ? | Il n'y a **aucun pont** entre Supabase et PostgreSQL/Prisma. Ce sont deux mondes séparés. La progression Maths n'existe pas dans Prisma. |
| Cache, backend annexe, ou source primaire ? | **Backend annexe** — Supabase sert de persistance externe pour la progression Maths, pendant que localStorage est la source de vérité immédiate. |

---

## 6. pgvector : usage réel (Q5)

### 6.1 Tables vectorielles

| Table | Colonne | Type | Dimensions | Index | Migration |
|---|---|---|---|---|---|
| `pedagogical_contents` | `embedding_vector` | `vector(1536)` | 1536 (text-embedding-3-small) | HNSW cosine (`pedagogical_contents_embedding_idx`) | `20260220000000_add_pgvector` |

C'est la **seule table vectorielle** dans PostgreSQL.

### 6.2 Services qui l'utilisent

| Fichier | Opération | Contexte |
|---|---|---|
| `lib/aria.ts:59` | `$queryRaw` SELECT similarity | Recherche RAG ARIA — fallback si pas de résultats textuels |
| `app/api/programme/maths-1ere/rag/route.ts:124` | `$queryRaw` SELECT similarity | Circuit B (fallback) — quand ChromaDB est down |

### 6.3 Qui écrit les embeddings ?

**Aucun fichier du repo n'écrit dans `embedding_vector`**. La fonction `generateEmbedding()` dans `lib/aria.ts` génère des vecteurs mais ne les persiste jamais. L'ingestion se fait probablement via le service FastAPI externe (ingestor) ou un script hors-repo.

### 6.4 Relation avec ChromaDB

| Aspect | pgvector | ChromaDB |
|---|---|---|
| Localisation | Même PostgreSQL que Prisma | Service Docker séparé (`ingestor:8001`) |
| Modèle embedding | `text-embedding-3-small` (OpenAI, 1536d) | `nomic-embed-text` (via Ollama, dimensions ?) |
| Collection/Table | `pedagogical_contents` | `ressources_pedagogiques_terminale` |
| Priorité | Fallback (Circuit B) | Primaire (Circuit A) |
| Synchronisation | Aucune | Aucune |
| Contenus | Même concept : contenus pédagogiques | Même concept |

**Verdict** : Les deux systèmes indexent des contenus pédagogiques mais avec des modèles d'embedding différents, des seuils de similarité différents (0.4 vs 0.5), et aucune synchronisation. C'est un **doublon fonctionnel** qui complique le debug et la maintenance.

### 6.5 Colonne `embedding` legacy

`pedagogical_contents.embedding` est un champ `Json @default("[]")` — c'est l'ancien stockage d'embeddings avant pgvector. Il est conservé pour compatibilité mais n'est lu nulle part dans le code de production.

---

## 7. Migrations / cohérence schéma (Q6)

### 7.1 Tables dans le schéma Prisma vs réalité

| Table | Dans Prisma | Dans migrations | Dans code runtime |
|---|---|---|---|
| `progression_history` | ✅ `ProgressionHistory` | ✅ `20260217_learning_graph_v2` | Écrit/lu via raw SQL uniquement |
| `projection_history` | ✅ `ProjectionHistory` | ✅ `20260217_learning_graph_v2` | Écrit/lu via raw SQL uniquement |
| `domain_scores` | ✅ `DomainScore` | ✅ `20260217_learning_graph_v2` | Écrit via raw SQL, lu via raw SQL |
| `skill_scores` | ✅ `SkillScore` | ✅ `20260217_learning_graph_v2` | Écrit via raw SQL, lu via raw SQL |
| `maths_lab_progress` | ❌ | ❌ | Supabase externe — pas dans PostgreSQL local |
| `themes`, `chapters`, `learning_nodes`, `user_node_progress` | ❌ | ❌ | Commentaire SQL dans `supabase.ts` — jamais créées |

### 7.2 Colonnes ajoutées par migration mais lues/écrites en raw SQL

| Colonne | Table | Migration | Dans Prisma | Utilisée via client typé ? |
|---|---|---|---|---|
| `ssn` | `assessments` | `20260217` | ✅ | ❌ — raw SQL uniquement |
| `uai` | `assessments` | `20260217` | ✅ | ❌ — raw SQL uniquement |
| `studentId` | `assessments` | `20260217` | ✅ | Mixte — Prisma include + raw SQL |
| `assessmentVersion` | `assessments` | `20260217` | ✅ | ❌ — raw SQL uniquement |
| `engineVersion` | `assessments` | `20260217` | ✅ | ❌ — raw SQL uniquement |
| `embedding_vector` | `pedagogical_contents` | `20260220` | ✅ (`Unsupported("vector")`) | ❌ — raw SQL (justifié : opérateur pgvector) |

### 7.3 Conclusion migrations

Toutes les tables et colonnes critiques sont dans le schéma Prisma et dans les migrations. Le problème n'est pas un schéma incomplet — c'est que le code n'a **jamais été refactoré** pour utiliser le client typé après l'application des migrations.

---

## 8. Findings classés par sévérité

### P0 — Critique

| # | Finding | Impact | Fichiers |
|---|---------|--------|----------|
| F16 | **Double source de vérité progression** : localStorage Zustand est la source *de facto*, Supabase est un backup async non garanti. Changement de navigateur = perte de progression. | Perte de données élève | `store.ts`, `useProgressionSync.ts`, `supabase.ts`, `progress/route.ts` |
| F17 | **Collision Maths 1ère / Terminale** : les deux modules écrivent dans `maths_lab_progress` avec `user_id` comme clé unique. Un élève bi-inscrit voit ses données écrasées. | Corruption silencieuse | `maths-1ere/progress/route.ts`, `maths-terminale/progress/route.ts` |

### P1 — Élevé

| # | Finding | Impact | Fichiers |
|---|---------|--------|----------|
| F18 | **8 usages raw SQL injustifiés** : SSN, UAI, DomainScore, SkillScore, ProgressionHistory, ProjectionHistory écrits/lus via `$executeRawUnsafe` alors que les modèles Prisma existent. Contourne le typage, la validation, et les hooks. | Dette technique, risque d'injection réduit (paramétré), mais maintenance lourde | `computeSSN.ts`, `predictSSN.ts`, `computeUAI.ts`, `submit/route.ts`, `result/route.ts`, `export/route.ts` |
| F19 | **ChromaDB et pgvector en doublon fonctionnel** : deux systèmes vectoriels indexent des contenus pédagogiques avec des modèles d'embedding différents, sans synchronisation. | Architecture confuse, résultats de recherche incohérents selon le circuit actif | `lib/aria.ts`, `lib/rag-client.ts`, `rag/route.ts` |
| F20 | **Badges Maths non persistés en base Prisma** : les badges gagnés dans le cockpit sont dans localStorage/Supabase (`badges: string[]`). La table `student_badges` dans Prisma contient un autre jeu de badges. | Perte de badges, incohérence avec dashboard élève | `store.ts`, schema `StudentBadge` |

### P2 — Modéré

| # | Finding | Impact | Fichiers |
|---|---------|--------|----------|
| F21 | **`db-raw.ts` non utilisé** : le helper centralisé avec validation anti-injection existe mais n'est utilisé par aucun fichier de production. | Standard de sécurité contourné | `lib/db-raw.ts` vs tous les fichiers raw SQL |
| F22 | **Supabase mode `local-only` silencieux** : quand les env vars Supabase manquent, l'API renvoie `200 { ok: true, persisted: false }`. Le client ne distingue pas succès et échec de persistence. | Fausse assurance de sauvegarde | `maths-terminale/progress/route.ts:70-71` |
| F23 | **`embedding` legacy non nettoyé** : colonne `Json` dans `pedagogical_contents` jamais lue, mais toujours dans le schéma avec `@default("[]")`. | Confusion schéma | `schema.prisma:507` |

### P3 — Faible

| # | Finding | Impact | Fichiers |
|---|---------|--------|----------|
| F24 | **Ingestion pgvector hors-repo** : aucun code dans le repo n'écrit dans `embedding_vector`. Le processus d'alimentation est invisible. | Opérationnel non documenté | — |
| F25 | **Tables Supabase CdC non créées** : `themes`, `chapters`, `learning_nodes`, `user_node_progress` restent en commentaire SQL. | Confusion documentation | `supabase.ts:172-288` |

---

## 9. Décision d'architecture cible (Q7)

### 9.1 Source de vérité — Progression

**Décision** : PostgreSQL/Prisma doit devenir la source de vérité unique.

Plan :
1. Créer un modèle `MathsProgress` dans `schema.prisma` avec toutes les colonnes de `maths_lab_progress` + une colonne `level` (PREMIERE, TERMINALE) pour éviter la collision.
2. L'API route écrit dans PostgreSQL via Prisma (pas Supabase).
3. Le hook `useProgressionSync` lit/écrit via l'API route (pas le client Supabase).
4. Zustand localStorage reste comme cache local immédiat, mais n'est plus la source de vérité.
5. Supabase est retiré du flux d'écriture.

### 9.2 Source de vérité — SSN / Projection

**Décision** : Utiliser exclusivement les modèles Prisma typés.

Plan :
1. Remplacer tous les `$executeRawUnsafe` / `$queryRawUnsafe` sur `assessments.ssn`, `assessments.uai`, `assessments.studentId`, `assessments.assessmentVersion`, `assessments.engineVersion` par des appels `prisma.assessment.update()`.
2. Remplacer les INSERT/SELECT raw sur `progression_history`, `projection_history`, `domain_scores`, `skill_scores` par `prisma.progressionHistory.create()`, etc.
3. Fermer les tickets NEX-42, NEX-43.
4. Conserver le raw SQL pour : invoice_sequences (atomic upsert), pgvector (opérateur `<=>`), health check, et `DISTINCT ON` dans `computeUAI.ts`.

### 9.3 Conserver Supabase ?

**Décision** : **Non**. Supprimer Supabase du flux de progression.

Justification :
- Supabase n'apporte rien que PostgreSQL/Prisma ne fasse déjà.
- Il crée une double écriture dangereuse.
- Les RLS Supabase ne sont pas alignées avec NextAuth (user IDs différents potentiellement).
- Le fallback client direct bypass l'authentification serveur.

Transition : Migrer les données `maths_lab_progress` de Supabase vers le nouveau modèle Prisma, puis retirer les dépendances Supabase.

### 9.4 Conserver ChromaDB ET pgvector ?

**Décision** : **Fusionner sur pgvector** à terme, mais ChromaDB acceptable transitoirement.

Justification :
- pgvector est déjà dans le même PostgreSQL, pas de service externe à maintenir.
- ChromaDB nécessite un service Docker séparé + FastAPI ingestor + réseau `infra_rag_net`.
- Mais ChromaDB est le circuit primaire en prod avec du contenu déjà ingéré — le retirer immédiatement casserait le RAG.

Plan transitoire :
1. Documenter explicitement que ChromaDB = primaire, pgvector = fallback.
2. Aligner les modèles d'embedding (un seul modèle pour les deux).
3. À terme, migrer tout le contenu ChromaDB vers pgvector et retirer le service ingestor.

### 9.5 Couches à supprimer / fusionner

| Action | Couche | Priorité |
|---|---|---|
| **Supprimer** | Supabase (client + API route) — migrer vers Prisma | P0 |
| **Supprimer** | Raw SQL injustifié (8 usages) — migrer vers client Prisma typé | P1 |
| **Fusionner** | ChromaDB → pgvector (à terme) | P2 |
| **Borner** | Zustand localStorage = cache local, pas source de vérité | P0 |
| **Documenter** | Process d'ingestion pgvector (actuellement invisible) | P3 |
| **Nettoyer** | Colonne `embedding` legacy, SQL commenté CdC Supabase | P3 |

---

## 10. Prompt Windsurf dédié — LOT 5

```
Contexte : Nexus Réussite repo local (/home/alaeddine/Bureau/nexus-project_v0).
Audit 2026-04-19 — LOT 5 Base de données : Supabase exit + raw SQL cleanup.
Voir docs/AUDIT_SENIOR_2026-04-19/06_PRISMA_PGVECTOR_SUPABASE.md.

═══ SOUS-LOT 5a — P0 : Supabase exit + modèle Prisma progression ═══

1. Créer un modèle dans prisma/schema.prisma :

   model MathsProgress {
     id        String   @id @default(cuid())
     userId    String
     user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     level     String   // "PREMIERE" ou "TERMINALE"

     completedChapters  String[]  @default([])
     masteredChapters   String[]  @default([])
     totalXp            Int       @default(0)
     quizScore          Int       @default(0)
     comboCount         Int       @default(0)
     bestCombo          Int       @default(0)
     streak             Int       @default(0)
     streakFreezes      Int       @default(0)
     lastActivityDate   String?
     dailyChallenge     Json      @default("{}")
     exerciseResults    Json      @default("{}")
     hintUsage          Json      @default("{}")
     badges             String[]  @default([])
     srsQueue           Json      @default("{}")
     diagnosticResults  Json?
     timePerChapter     Json?
     formulaireViewed   Boolean   @default(false)
     grandOralSeen      Int       @default(0)
     labArchimedeOpened Boolean   @default(false)
     eulerMaxSteps      Int       @default(0)
     newtonBestIterations Int?
     printedFiche       Boolean   @default(false)
     // Terminale-specific
     errorTags          Json?
     hintPenaltyXp      Int?
     bacChecklistCompletions Int?

     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt

     @@unique([userId, level])
     @@map("maths_progress")
   }

2. Ajouter relation sur User : mathsProgress MathsProgress[]

3. npx prisma migrate dev --name add_maths_progress

4. Réécrire app/api/programme/maths-1ere/progress/route.ts :
   - POST : prisma.mathsProgress.upsert({ where: { userId_level: { userId, level: 'PREMIERE' } }, ... })
   - GET  : prisma.mathsProgress.findUnique({ where: { userId_level: { userId, level: 'PREMIERE' } } })
   - Supprimer toute référence Supabase

5. Idem pour app/api/programme/maths-terminale/progress/route.ts avec level: 'TERMINALE'

6. Réécrire app/programme/maths-1ere/hooks/useProgressionSync.ts :
   - Hydratation : fetch GET /api/programme/maths-1ere/progress
   - Sync : fetch POST /api/programme/maths-1ere/progress
   - Supprimer le fallback saveProgress() vers Supabase
   - Supprimer l'import de supabase.ts

7. Supprimer ou vider app/programme/maths-1ere/lib/supabase.ts

8. Tests : ajouter dans __tests__/api/programme.maths-1ere.progress.route.test.ts :
   - POST avec payload valide → 200 + persisted in DB
   - POST sans auth → 401
   - GET avec données existantes → 200 + data
   - GET sans données → 200 + null

═══ SOUS-LOT 5b — P1 : Raw SQL → Prisma client typé ═══

Remplacer tous les raw SQL injustifiés par des appels Prisma typés :

1. lib/core/ssn/computeSSN.ts :
   - L192: prisma.assessment.update({ where: { id: assessmentId }, data: { ssn: result.ssn } })
   - L199: prisma.assessment.findUnique({ where: { id: assessmentId }, select: { studentId: true } })
   - L208: prisma.progressionHistory.create({ data: { studentId, ssn: result.ssn } })
   - L264: (batch) même pattern avec update

2. lib/core/ml/predictSSN.ts :
   - L230: prisma.progressionHistory.findMany({ where: { studentId }, orderBy: { date: 'asc' }, select: { ssn: true, date: true } })
   - L264: prisma.projectionHistory.create({ data: { studentId, ssnProjected, confidenceIndex, modelVersion, inputSnapshot } })

3. lib/core/uai/computeUAI.ts :
   - L143: prisma.assessment.update({ where: { id: a.id }, data: { uai: result.uai } })
   - L121: garder raw SQL pour DISTINCT ON (justifié)

4. app/api/assessments/submit/route.ts :
   - L147: prisma.assessment.update({ where: { id }, data: { assessmentVersion, engineVersion } })
   - L179: prisma.domainScore.create({ data: { assessmentId, domain, score } })

5. app/api/assessments/[id]/result/route.ts + export/route.ts :
   - Remplacer les SELECT raw par prisma.assessment.findUnique({ include: { domainScores: true, skillScores: true } })

6. Supprimer les TODO NEX-42, NEX-43 et les try/catch de fallback

7. Faire passer db-raw.ts dans les rares cas justifiés restants (invoice, pgvector)

═══ SOUS-LOT 5c — P2 : Nettoyage ═══

1. Supprimer la colonne legacy embedding Json dans schema.prisma :
   - Garder embedding_vector Unsupported("vector")?
   - Supprimer embedding Json @default("[]")
   - Migration: ALTER TABLE pedagogical_contents DROP COLUMN IF EXISTS embedding

2. Supprimer le SQL commenté dans supabase.ts (tables CdC non créées)

3. Documenter dans un fichier docs/ARCHITECTURE_DATA.md :
   - Source de vérité : PostgreSQL/Prisma
   - RAG : ChromaDB (primaire) + pgvector (fallback)
   - Progression : MathsProgress (Prisma) + localStorage (cache)
   - Badges : à synchroniser entre Zustand et student_badges

Contraintes :
- Ne pas modifier la prod
- npx prisma migrate dev doit passer
- npm run build → 0 erreurs
- npm test → pas de régressions
- Chaque sous-lot = 1 commit séparé
```
