Implémentation ARIA (Context Builder + RAG Admin UI + Bilans + ACL + OCR + PDF)
lire AGENT_ARIA_RAG.md qui est à la racine du projet pour mieux comprendre le contexte et prendre des idées pour l'implémantation

Je décris dans le détail toutes les étapes de développement et de mise au point de l’écosystème **ARIA**. L’objectif est de livrer un **agent éducatif complet** avec :
- un **Context Builder professionnel** (mémoire + dashboard + retrieval),
- une **interface RAG Admin complète** (upload → OCR → chunking → embeddings → indexation),
- une **génération de documents LaTeX → PDF** (auto-fix),
- des **bilans multi-variantes** (Parent, Élève, Admin),
- une **sécurisation NextAuth** (ACL),
- un **seed script complet** pour tests,
- et une **intégration OCR Cloud (GCP Vision)**.

---

## 🎯 Objectifs
1. **Context Builder** : agréger historiques (messages récents, mémoires, dashboard, retrieval).
2. **RAG Admin UI** : ingestion no-code (upload PDF/images → OCR → indexation) + suivi jobs/docs.
3. **Bilans** : génération automatisée (LaTeX→PDF) avec 3 variantes de style (Parent/Élève/Admin).
4. **ACL** : `/admin/*` restreint à `ADMIN`, `ASSISTANTE`, `COACH`.
5. **OCR** : intégration Google Cloud Vision pour scans/images.
6. **Seed** : script peupler DB avec un élève, quiz, mémoires, dashboard, documents factices.
7. **Qualité** : tests unitaires + e2e, logging clair, auto-correction LaTeX.

---

## 🗂️ Étapes à implémenter

### 1. Pré-requis
- `.env.local` avec : `DATABASE_URL`, `OPENAI_API_KEY`, `REDIS_URL`, `NEXTAUTH_SECRET`, `VECTOR_DIM`, `OCR_PROVIDER=gcp`, `GOOGLE_PROJECT_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`.
- Paquets : `openai`, `pdf-parse`, `bullmq`, `ioredis`, `mustache`, `zod`, `@google-cloud/vision`, `next-auth`, `@auth/prisma-adapter`, `jsonwebtoken`.
- Activer **pgvector** : `CREATE EXTENSION vector;`

### 2. Prisma — Schéma
- `User{role}` (enum: ADMIN, ASSISTANTE, COACH, ELEVE, PARENT).
- `Student`, `Dashboard`, `Session`, `QuizResult`, `ChatMessage`, `Memory(kind, embedding)`, `UserDocument`, `KnowledgeAsset`, `IngestJob`, `Bilan` (variant, meta, pdfUrl).

### 3. NextAuth + ACL
- NextAuth (Credentials ou provider choisi).
- Middleware `/admin/*` : restreindre à rôles autorisés.
- Callbacks injectent `role` dans JWT/session.

### 4. Base Libraries
- `lib/prisma.ts` (singleton).
- `lib/storage.ts` (sauvegarde locale → S3 prod).
- `lib/queue.ts` (BullMQ + fallback inline).

### 5. Vector & Embeddings
- `embeddings.ts` : OpenAI (`text-embedding-3-large` ou `-small`).
- `search.ts` : pgvector cosine + filtres (matière/niveau).

### 6. OCR & Parsing
- `ocr.ts` : `pdf-parse` pour PDF textuel → fallback Vision pour scans/images → fallback UTF‑8.
- Supporter PDF scannés page-à-page (optionnel via pdftoppm).

### 7. Chunker
- Chunker token-aware (1000 tokens, overlap 150).
- Nettoyage (espaces, sauts de ligne), préservation LaTeX et code.

### 8. Ingestion Pipeline
- `upload` → créer `UserDocument`+`IngestJob`.
- `ingest.ts` : OCR → chunk → embed → index (insert en DB).
- Worker `worker.ts` : `registerIngestWorker(runIngestion)`.

### 9. API Routes
- `/api/rag/upload` : upload + enqueue job.
- `/api/rag/jobs` : suivi jobs.
- `/api/rag/docs` : liste docs indexés.
- `/api/context/build` : construit contexte élève.
- `/api/bilans/generate` : génère bilan (Parent/Élève/Admin) en PDF.

### 10. Context Builder
- Agréger : derniers messages, mémoires (EPISODIC/PLAN/SEMANTIC), dashboard (quiz, sessions), retrieval (6 chunks pertinents).
- Retourner `{recent, episodic, semantic, plan, dash}`.

### 11. RAG Admin UI (Next.js App Router)
- Page `/admin/rag` :
  - Formulaire upload (matière, niveau, type).
  - Tableau jobs (poll 3s).
  - Tableau docs indexés (statut, chunks, date).

### 12. Génération de Bilans (LaTeX→PDF)
- Gabarit Mustache LaTeX.
- Prompt variant‑aware (Parent/Élève/Admin).
- Auto-fix LaTeX (boucle 3 essais max).
- Stockage PDF + URL téléchargeable.

### 13. Seed Script
- `seed.ts` : créer élève Terminale (Maths+NSI), 4 messages, mémoires, quiz, dashboard.
- Scripts : `"seed": "tsx prisma/seed.ts"`.

### 14. Tests
- **Unitaires** : chunker, embeddings mock, prompt builders.
- **E2E** : upload PDF → INDEXED, GET context.build → contexte valide, génération bilan PDF mock.

---

## ✅ Résultats attendus
- **/admin/rag** fonctionnel (upload, jobs, docs).
- **/api/context/build** renvoie un contexte complet.
- **Bilans** générés en PDF (Parent/Élève/Admin).
- **Seed** : élève prêt à tester.
- **ACL** : sécurité stricte.
- **OCR** : Vision + fallback.
- **Tests** verts.

---

**Fin du prompt** — Cursor doit générer l’intégralité du code et de l’infrastructure décrite pour livrer ARIA complet (Context Builder + RAG Admin UI + Bilans + ACL + OCR).

