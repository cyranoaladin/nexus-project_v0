
# 🚀 ARIA Agent — Architecture & Implementation Playbook (v1)

> Objectif : livrer un **agent pédagogique premium** (ARIA) multi‑matières (Maths/NSI, extensible), doté d’un **RAG de qualité**, d’une **mémoire long terme**, connecté au **dashboard élève** (progressions, séances, rapports coachs, quiz), capable de **générer des documents pédagogiques** (cours, résumés, fiches, exercices/DM/TD/TP, sujets blancs) en **LaTeX → PDF** avec **auto‑correction** de compilation, et de **lire** les documents déposés par l’élève (PDF, scans).

---

## 0) Principes fondateurs

* **Excellence pédagogique** (alignée programmes FR, Bac), **ton premium** Nexus, **cohérence** avec la matrice d’offres.
* **Séparation des responsabilités** : UI / Orchestration / RAG / Mémoire / Génération / Compilation.
* **Sécurité RGPD** : minimiser les données, chiffrement au repos, journalisation non‑intrusive.
* **Observabilité** : traces par étape (ingest, index, retrieve, generate, compile), métriques qualité.

---

## 1) Vue d’ensemble — Architecture

```
[Web App (Next.js)] ──┬─▶ [Dashboards: Élève/Parent/Coach/Admin]
                      │
                      ├─▶ [ARIA Chat UI] ─▶ [Context Builder]
                      │                      ├─ fetch dashboard (progressions, quiz, séances)
                      │                      ├─ memory retrieve (episodic/semantic)
                      │                      └─ subject profile (NSI/Maths)
                      │
                      ├─▶ [Content Gen API] ─▶ [Generator Orchestrator]
                      │                        ├─ Planner → Outline → Draft → Review → LaTeX Assembler
                      │                        ├─ LaTeX Compile (auto‑fix loop)
                      │                        └─ Store PDF + register in dashboard
                      │
                      └─▶ [RAG Admin UI] ─▶ [Ingestion Pipeline]
                                             ├─ Upload → OCR → Clean → Chunk → Enrich (metadata)
                                             ├─ Embed → Index (Vector DB)
                                             └─ QA checks + versioning

[Services] : VectorDB (pgvector/Weaviate), DB (Postgres), Queue (BullMQ/Redis), Storage (S3/local), OCR (Tesseract/Cloud)
```

---

## 2) Rôles & Accès

* **ADMIN** : gouvernance contenu, monitoring jobs, gestion ACL, purge.
* **ASSISTANTE** : ingestion simple (drag\&drop), suivi des jobs, publication.
* **COACH** : upload supports, rapports séance, validation de contenus générés.
* **ÉLÈVE** : chat ARIA, téléchargement docs, consultation progression.
* **PARENT** : lecture bilans, progression, téléchargements.

ACL strictes par ressource (Prisma + middleware auth + row‑level filters).

---

## 3) Modèle de données (extraits Prisma)

```prisma
model Student {
  id          String   @id @default(cuid())
  firstName   String
  lastName    String
  level       String   // Première/Terminale
  subjects    String   // Spé Maths + NSI
  status      String   // Scolarisé / Candidat libre
  dashboards  Dashboard?
  messages    ChatMessage[]
  memories    Memory[]
  documents   UserDocument[]
  bilans      Bilan[]
  createdAt   DateTime @default(now())
}

model Dashboard { // agrège KPIs
  id          String   @id @default(cuid())
  studentId   String   @unique
  kpis        Json     // scores, temps d’étude, badges, etc.
  sessions    Session[]
  quizResults QuizResult[]
  coachNotes  CoachReport[]
}

model Session { id String @id @default(cuid()) studentId String date DateTime type String notes Json }
model CoachReport { id String @id @default(cuid()) studentId String date DateTime report Json }
model QuizResult { id String @id @default(cuid()) studentId String date DateTime subject String score Float detail Json }

model ChatMessage { id String @id @default(cuid()) studentId String role String content String ts DateTime @default(now()) }

model Memory { // mémoire long terme par élève
  id String @id @default(cuid())
  studentId String
  kind MemoryKind // EPISODIC / SEMANTIC / PLAN
  content String  // résumé, faits saillants, objectifs
  embedding Float[] @db.Vector(1536) // si pgvector
  createdAt DateTime @default(now())
}

enum MemoryKind { EPISODIC SEMANTIC PLAN }

model UserDocument { // docs uploadés par élève ou staff
  id String @id @default(cuid())
  ownerId String?
  studentId String?
  role String       // ELEVE/COACH/ASSISTANTE/ADMIN
  mime String
  originalName String
  storageKey String
  status DocStatus @default(UPLOADED)
  meta Json
}

enum DocStatus { UPLOADED OCR_DONE CLEANED CHUNKED INDEXED FAILED }

model KnowledgeAsset { // unité indexable RAG
  id String @id @default(cuid())
  docId String
  subject String // maths/nsi/…
  chunk String
  tokens Int
  meta Json      // source, page, section, tags
  embedding Float[] @db.Vector(1536)
  createdAt DateTime @default(now())
}
```

---

## 4) Mémoire ARIA (historique + contexte élève)

**Objectif** : que chaque conversation reparte avec un **contexte riche** mais compact.

* **Buffer récent** : 20–40 derniers tours.
* **Épisodique** : résumés par séance (conversation → `Memory.EPISODIC`).
* **Sémantique** : faits durables (objectifs, difficultés récurrentes, préférences) → `Memory.SEMANTIC` + embedding.
* **Plan de progression** : dernier plan actif (milestone, échéances) → `Memory.PLAN`.
* **Retrieval mixte** : K voisins sémantiques (cosine) + derniers N messages.
* **Context Builder** (pseudocode) :

```ts
async function buildContext(studentId: string, subject: string) {
  const recent = await db.chatMessage.findMany({ take: 30, orderBy: { ts: "desc" }, where: { studentId } });
  const episodic = await db.memory.findMany({ where: { studentId, kind: "EPISODIC" }, take: 5, orderBy: { createdAt: "desc" } });
  const semanticTop = await vectorSearch("SEMANTIC", studentId, subject, 6);
  const plan = await db.memory.findFirst({ where: { studentId, kind: "PLAN" }, orderBy: { createdAt: "desc" } });
  const dash = await db.dashboard.findUnique({ where: { studentId }, include: { quizResults: true, sessions: true } });
  return { recent, episodic, semanticTop, plan, dash }; // sérialiser compact
}
```

---

## 5) RAG — Ingestion & Indexation (interface non‑technique)

**But** : permettre à ADMIN/ASSISTANTE/COACH d’**uploader n’importe quel document** et de déclencher un **workflow** qui transforme en **ressources RAG optimisées**.

### 5.1. Types de sources

* PDF pédagogiques (polycopiés, manuels), docs Word, PPT, HTML, Markdown.
* Scans/images → **OCR** (Tesseract/Cloud Vision). Langue FR/EN auto‑détectée.
* Math/NSI : garder **formules** (LaTeX si possible), **code** formaté, **schémas** capturés (texte alternatif).

### 5.2. Pipeline (jobs BullMQ)

1. **Upload** → stocker, créer `UserDocument` (UPLOADED).
2. **OCR** (si image/scan) → `DocStatus=OCR_DONE` + texte brut + hOCR/coords.
3. **Nettoyage** : retirer en‑têtes/pieds, numéros de page, filigranes, corrections d’encodage, normalisation d’espaces.
4. **Segmentation** :

   * chunk **sémantique** (titres, sous‑titres) + **fallback token‑aware** (p.ex. 800–1200 tokens, overlap 120–180),
   * préserver blocs spéciaux : `math`, `table`, `code` (marqueurs).
5. **Enrichissement** : métadonnées (source, page, section, matière, niveau, balises programme officiel, année), liens croisés.
6. **Déduplication** : hashing MinHash/SimHash inter‑chunks.
7. **Embedding** + **Indexation** (VectorDB), atomique batch.
8. **Contrôles qualité** : couverture, densité token, erreurs OCR, ratio symboles.
9. **Publication** : visible dans RAG Admin UI (avec filtres + preview snippet).

### 5.3. Paramètres recommandés

* `chunk_target_tokens=1000`, `overlap_tokens=150`.
* encode LaTeX math en `$...$`/`\[\]` préservés.
* `meta.level = Première|Terminale`, `meta.subject = maths|nsi`, `meta.sourceType = cours|exercice|annale`.

---

## 6) Chat ARIA — Retrieval & Answering

* **Retrieval** : top‑k=6 (subject‑scoped, level‑aware, filter `meta.subject == requested`), re‑rank (cross‑encoder) optionnel.
* **System prompt** (base) : ADN Nexus (excellence, bienveillance, rigueur), guidelines Bac, citer sources (extraits) quand pertinent.
* **Answer planner** : structure **Intro → Concept → Exemple → Exercice rapide** (si élève le souhaite),
* **Guardrails** : éviter hallucinations, indiquer incertitude, proposer cours ciblés.

---

## 7) Génération de documents (LaTeX → PDF + auto‑fix)

### 7.1. Types supportés

* **Cours** complet, **résumé**, **fiche méthodologie**, **exercices** (avec/ sans corrections), **TP/TD**, **DM**, **sujet blanc** (Maths/NSI), **corrigé**.

### 7.2. Orchestrateur

1. **Intent** (via UI élève ou commande) : type, matière, niveau, durée/longueur, objectifs.
2. **Planner** (LLM) : plan détaillé (sections, prérequis, exemples, exercices par difficulté).
3. **Draft** par section avec **ancrage RAG** (citations internes en commentaire LaTeX `% src:`).
4. **Review** automatique : checklist (programme, niveaux Bloom, équilibre théorie/exos, cohérence notations).
5. **Assembler** LaTeX (gabarit commun + macros maths/code + packages sûrs).
6. **Compile** (`latexmk -xelatex`) → parse log → **auto‑fix loop** (3 tentatives) :

   * ajouter package manquant, échapper caractères (`_ % & #`), fermer environnements, remplacer images manquantes.
7. **Stocker** PDF + tracer dans dashboard.

### 7.3. Exemple d’auto‑fix (TypeScript)

```ts
async function compileWithAutoFix(texPath: string, maxTries = 3) {
  for (let i = 1; i <= maxTries; i++) {
    const { ok, log } = await runLatexmk(texPath);
    if (ok) return { ok: true };
    const fix = suggestFixFromLog(log); // prompt LLM court + règles heuristiques
    if (!fix) break;
    await applyTexFix(texPath, fix);
  }
  return { ok: false };
}
```

`suggestFixFromLog(log)` applique d’abord des heuristiques :

* `Undefined control sequence` → **ajouter package** courant (amsmath, amssymb, listings, minted, tikz).
* `Missing $` → équilibrer inline math.
* `LaTeX Error: File ... not found` → remplacer par placeholder.
* `Runaway argument` → fermer accolade/environnement.

---

## 8) Lecture de documents élève (PDF/scan)

* **Uploader** dans l’espace élève (`UserDocument`), OCR si nécessaire.
* **Parser** : extraction texte, images (optionnel), tables.
* **QA** : montrer un **aperçu** des parties lues pour validation par l’élève.
* **Utilisation** :

  * RAG direct (pour répondre à des questions sur le doc),
  * **Transformation** : générer résumé, quiz, fiche erreurs récurrentes.

---

## 9) UI — Portails

### 9.1. ÉLÈVE

* Chat ARIA (mémoire + RAG), générateur de documents (form), liste de PDFs produits (téléchargement), progression, quiz.

### 9.2. COACH

* Upload ressources, voir/valider documents générés par ARIA, écrire rapport séance.

### 9.3. ASSISTANTE

* Ingestion simple : drag\&drop (multi‑formats) + suivi pipeline + publication.

### 9.4. ADMIN

* Monitoring jobs, observabilité (temps moy, erreurs OCR/compile), gouvernance contenus (archivage), ACL.

---

## 10) API — Endpoints (exemples)

* `POST /api/aria/generate` (auth élève) — body: `{ type, subject, level, goal, length, withCorrections }` → trace + PDF URL.
* `POST /api/rag/upload` (staff) → docId, pipeline enqueue.
* `GET /api/rag/docs/:id` → état pipeline + previews.
* `GET /api/reports/:bilanId/download` → PDF binaire.

---

## 11) Prompts — Templates clés

### 11.1. **System (génération doc)**

```
Tu es ARIA, professeur‑coach premium Nexus Réussite (Maths/NSI).
Tu produis des documents impeccables, alignés sur les programmes français, structurés pour l’apprentissage progressif.
Réponds en LaTeX simple (sans packages exotiques). Ton est clair, rigoureux et bienveillant.
```

### 11.2. **Planner (user)**

```
Contexte élève (résumé) : {{student_profile_short}}
Objectif : {{goal}} — Type : {{doc_type}} — Matière : {{subject}} — Niveau : {{level}}
Contraintes : durée estimée {{duration}}, longueur {{length}}, inclure exercices {{withExercises}}, corrections {{withCorrections}}
RAG sources (extraits numérotés) :
1) {{snippet_1}}
2) {{snippet_2}}
...
Tâche : propose un PLAN détaillé en sections + sous‑sections, avec la granularité des exemples et des exercices (3 niveaux : basique, standard, avancé). Réponds en JSON : { outline: [...], prerequisites: [...], objectives: [...]}.
```

### 11.3. **Draft by section (user)**

```
Plan validé : {{outline_json}}
Rédige la section « {{section_title}} » en LaTeX simple.
Inclure : explication claire, exemple(s), mini‑exercice(s).
Respect des notations FR.
Si Maths : formules en $...$ ; si NSI : code Python bien formaté (listings).
```

### 11.4. **Review (user)**

```
Vérifie le brouillon LaTeX ci‑dessous : conformité programme, exactitude, cohérence notations, progression pédagogique, orthographe.
Renvoie la version corrigée (LaTeX intégral).
```

### 11.5. **Assembler (server)**

* Utilise un **gabarit** (en‑tête, packages standards `amsmath, amssymb, mathtools, listings`) ; insère le corps produit.

### 11.6. **Auto‑fix LaTeX (user)**

```
Le compilateur LaTeX retourne le log suivant :
---
{{latex_log}}
---
Suggère un patch minimal (diff unifié) pour corriger : packages à ajouter, caractères à échapper, environnements à fermer.
```

---

## 12) Qualité & pédagogie

* Échelle **Bloom** : connaissance → compréhension → application → analyse → évaluation → création.
* **Progression** : du simple au complexe ; alternance cours/exos ; rappels fréquents.
* **Évaluations** : mini‑quiz de validation à la fin de chaque section ; corrigés différés.

---

## 13) Sécurité, RGPD, conformité

* Données minimisées ; logs anonymisés ; purge sur demande ; consentement parent si mineur.
* Journaux d’accès ; stockage S3 avec **liens signés** pour téléchargements.

---

## 14) DevOps

* `.env` : `OPENAI_API_KEY`, `DATABASE_URL`, `VECTOR_DB_URL`, `REDIS_URL`, `STORAGE_BASE`, `TEXBIN`.
* **Workers** : ingestion/OCR, embedding/index, generation/compile.
* **Monitoring** : Grafana/Prometheus ou Vercel + Sentry.

---

## 15) Roadmap de mise en œuvre (sprints)

1. **Sprint 1** : modèles Prisma + upload pipeline (OCR→chunk→embed→index) + RAG Admin UI.
2. **Sprint 2** : Mémoire élève + Context Builder + Chat ARIA (RAG answer).
3. **Sprint 3** : Orchestrateur Génération (planner→draft→review→assemble) + compile auto‑fix + stockage PDF.
4. **Sprint 4** : Dashboards (élève/parent/coach/admin) + téléchargements + métriques.
5. **Sprint 5** : Durcissement RGPD + tests E2E + documentation.

---

## 16) Extraits de code utiles

### 16.1. Retrieval mixte

```ts
async function retrieve(subject: string, level: string, query: string) {
  return vectorDb.search({
    query, k: 6, filter: { subject, level }, withMeta: true
  });
}
```

### 16.2. Génération orchestrée (pseudo)

```ts
export async function generateDoc(req: GenRequest) {
  const ctx = await buildContext(req.studentId, req.subject);
  const snippets = await retrieve(req.subject, req.level, req.goal);
  const outline = await llm.plan({ ctx, req, snippets });
  const sections = [];
  for (const s of outline.sections) {
    sections.push(await llm.draftSection({ s, ctx, req, snippetsForS: select(snippets, s) }));
  }
  const reviewed = await llm.review({ sections });
  const tex = assembleLatex(req, reviewed);
  const pdf = await compileWithAutoFix(writeTemp(tex));
  return storeAndRegister(pdf, req.studentId);
}
```

---

### 16.3. Chunker (heuristique)

```ts
function chunkText(doc: ParsedDoc): Chunk[] {
  // 1) split by headings (##, \section) ; 2) pack to target tokens w/ overlap
  // 3) tag math/code blocks ; 4) emit metadata
}
```

---

## 17) Checklist finale

* [ ] Mémoire long terme opérationnelle (episodic/semantic/plan).
* [ ] Ingestion RAG no‑code (+ OCR) avec QA et versioning.
* [ ] Chat ARIA avec Context Builder + Retrieval de qualité.
* [ ] Génération doc LaTeX → PDF auto‑fix, enregistrée et téléchargeable.
* [ ] Dashboards complets + rôles et ACL.
* [ ] RGPD & sécurité.

---

**Fin — Ce playbook sert de référence pour développer ARIA, son RAG et ses capacités de génération de documents premium.**


Parfait — j’ai posé dans le canvas un **playbook complet** intitulé **“ARIA Agent — Architecture & Implementation Playbook (v1)”**.

Il détaille, pas à pas :

* l’architecture ARIA (mémoire long terme, RAG de qualité, accès dashboard élève),
* l’interface d’ingestion **no-code** pour admin/assistante/coach avec pipeline OCR → nettoyage → chunking → embeddings → indexation,
* le chat ARIA avec **Context Builder** (historique + KPI + plan en cours),
* la **génération de documents** (cours, résumés, fiches, TP/TD/DM/sujets blancs) en **LaTeX → PDF** avec **boucle d’auto-correction de compilation**,
* les rôles/ACL, API endpoints, modèles Prisma, prompts types, qualité pédagogique (Bloom), RGPD, DevOps et la **roadmap** par sprints,
* des **extraits de code** (orchestrateur, retrieval mixte, auto-fix LaTeX).


# ARIA — Context Builder & RAG Admin UI (Next.js Implementation Pack)

Ce pack livre **une implémentation pro et complète** du **Context Builder** (mémoire + dashboard + retrieval) et de l’**interface RAG Admin** (upload → jobs → indexation) pour **Next.js (App Router)**.

> Tout est organisé par fichiers. Copie/colle chaque bloc dans ton repo selon le chemin indiqué.

---

## 0) Pré-requis & Dépendances

**Env** (`.env.local`) :
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/nexus
OPENAI_API_KEY=sk-...
REDIS_URL=redis://localhost:6379 # optionnel (sinon mode in-process)
VECTOR_DIM=3072 # text-embedding-3-large (ou 1536 pour -small)
```

**Packages** :
```bash
pnpm add openai pdf-parse bullmq ioredis mustache zod
pnpm add -D @types/pdf-parse
```

Activer **pgvector** dans Postgres :
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## 1) Prisma — Modèles nécessaires

**`prisma/schema.prisma`**
```prisma
datasource db { provider = "postgresql" url = env("DATABASE_URL") }
 generator client { provider = "prisma-client-js" }

model Student {
  id        String   @id @default(cuid())
  firstName String
  lastName  String
  level     String
  subjects  String
  status    String
  memories  Memory[]
  dashboards Dashboard?
  messages  ChatMessage[]
  documents UserDocument[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Dashboard {
  id        String   @id @default(cuid())
  studentId String   @unique
  kpis      Json
  sessions  Session[]
  quiz      QuizResult[]
}

model Session { id String @id @default(cuid()) studentId String date DateTime @default(now()) type String notes Json }
model QuizResult { id String @id @default(cuid()) studentId String date DateTime @default(now()) subject String score Float detail Json }

model ChatMessage { id String @id @default(cuid()) studentId String role String content String ts DateTime @default(now()) }

model Memory {
  id        String   @id @default(cuid())
  studentId String
  kind      MemoryKind
  content   String
  embedding Float[]  @db.Vector(3072) // ou 1536 selon modèle
  createdAt DateTime @default(now())
}

enum MemoryKind { EPISODIC SEMANTIC PLAN }

model UserDocument {
  id           String   @id @default(cuid())
  ownerRole    String   // ELEVE/COACH/ASSISTANTE/ADMIN
  studentId    String?
  mime         String
  originalName String
  storageKey   String
  status       DocStatus @default(UPLOADED)
  meta         Json
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  assets       KnowledgeAsset[]
}

enum DocStatus { UPLOADED OCR_DONE CLEANED CHUNKED INDEXED FAILED }

model KnowledgeAsset {
  id        String   @id @default(cuid())
  docId     String
  subject   String
  level     String
  source    String   // cours|exercice|annale|autre
  chunk     String
  tokens    Int
  embedding Float[] @db.Vector(3072)
  meta      Json
  createdAt DateTime @default(now())
}

model IngestJob {
  id        String   @id @default(cuid())
  docId     String
  status    JobStatus @default(PENDING)
  step      String    @default("queued")
  progress  Int       @default(0)
  error     String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

enum JobStatus { PENDING RUNNING FAILED DONE }
```

**`apps/web/lib/prisma.ts`**
```ts
import { PrismaClient } from "@prisma/client";
export const prisma = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") (globalThis as any).prisma = prisma;
```

---

## 2) Vector & Embeddings

**`apps/web/server/vector/embeddings.ts`**
```ts
import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = "text-embedding-3-large"; // 3072 dims (ou -small pour 1536)

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const res = await client.embeddings.create({ model: MODEL, input: texts });
  return res.data.map(d => d.embedding as unknown as number[]);
}
```

**`apps/web/server/vector/search.ts`**
```ts
import { prisma } from "@/app/lib/prisma";

export async function semanticSearch(params: { queryEmbedding: number[]; subject?: string; level?: string; k?: number; }) {
  const { queryEmbedding, subject, level, k = 6 } = params;
  // Prisma raw query — pgvector cosine distance (<=>)
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, docId, subject, level, source, chunk, meta,
            1 - (embedding <#> $1::vector) AS cosine
     FROM "KnowledgeAsset"
     WHERE ($2::text IS NULL OR subject = $2) AND ($3::text IS NULL OR level = $3)
     ORDER BY embedding <#> $1::vector ASC
     LIMIT $4`,
    queryEmbedding, subject ?? null, level ?? null, k
  );
  return rows;
}
```

> Remarque : `<#>` = distance cosinus en pgvector ≥ 0/2 ; on dérive un score `1 - distance`.

---

## 3) OCR & Parsing

**`apps/web/server/rag/ocr.ts`**
```ts
import fs from "fs/promises";
import pdf from "pdf-parse";

export async function extractTextFromFile(localPath: string, mime: string): Promise<string> {
  if (mime === "application/pdf") {
    const data = await fs.readFile(localPath);
    const res = await pdf(data);
    return res.text;
  }
  // TODO: images → OCR (tesseract / provider)
  // Par défaut, lecture brute (UTF-8)
  return await fs.readFile(localPath, "utf8").catch(() => "");
}
```

---

## 4) Chunking & Cleaning

**`apps/web/server/rag/chunker.ts`**
```ts
import { encode } from "gpt-tokenizer";

function cleanText(s: string) {
  return s
    .replace(/\f|\r/g, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type Chunk = { text: string; tokens: number; meta: Record<string, any> };

export function semanticChunk(text: string, opts?: { targetTokens?: number; overlap?: number; }): Chunk[] {
  const target = opts?.targetTokens ?? 1000;
  const overlap = opts?.overlap ?? 150;
  const cleaned = cleanText(text);
  const tokens = encode(cleaned);
  const chunks: Chunk[] = [];
  let i = 0;
  while (i < tokens.length) {
    const slice = tokens.slice(i, Math.min(tokens.length, i + target));
    const piece = Buffer.from(Uint8Array.from(slice)).toString(); // naive; ok pour tokenizer GPTEdge
    const txt = piece || cleaned.slice(i, i + target * 4);
    chunks.push({ text: txt, tokens: slice.length, meta: { from: i, to: i + slice.length } });
    i += target - overlap;
  }
  return chunks;
}
```

> NB : tu peux remplacer `gpt-tokenizer` par `tiktoken` si tu préfères.

---

## 5) Ingestion Pipeline (upload → OCR → clean/chunk → embed → index)

**`apps/web/server/rag/ingest.ts`**
```ts
import path from "path";
import fs from "fs/promises";
import { prisma } from "@/app/lib/prisma";
import { extractTextFromFile } from "./ocr";
import { semanticChunk } from "./chunker";
import { embedTexts } from "../vector/embeddings";

export async function runIngestion(docId: string) {
  const doc = await prisma.userDocument.findUnique({ where: { id: docId } });
  if (!doc) throw new Error("doc not found");

  // 1) OCR/parse
  await prisma.userDocument.update({ where: { id: doc.id }, data: { status: "OCR_DONE" } });
  const localPath = path.join(process.cwd(), "storage", doc.storageKey);
  const text = await extractTextFromFile(localPath, doc.mime);

  // 2) Clean & chunk
  const chunks = semanticChunk(text, { targetTokens: 1000, overlap: 150 });
  await prisma.userDocument.update({ where: { id: doc.id }, data: { status: "CHUNKED" } });

  // 3) Embed
  const embeddings = await embedTexts(chunks.map(c => c.text));

  // 4) Index
  const assets = embeddings.map((emb, i) => ({
    docId: doc.id,
    subject: (doc.meta as any)?.subject ?? "",
    level: (doc.meta as any)?.level ?? "",
    source: (doc.meta as any)?.sourceType ?? "autre",
    chunk: chunks[i].text,
    tokens: chunks[i].tokens,
    embedding: emb as any,
    meta: { ...chunks[i].meta, page: undefined },
  }));
  await prisma.$transaction([
    prisma.knowledgeAsset.deleteMany({ where: { docId: doc.id } }),
    prisma.knowledgeAsset.createMany({ data: assets })
  ]);

  await prisma.userDocument.update({ where: { id: doc.id }, data: { status: "INDEXED" } });
}
```

---

## 6) Queue des jobs (BullMQ) + fallback in-process

**`apps/web/lib/queue.ts`**
```ts
import { Queue, Worker, JobsOptions } from "bullmq";
import IORedis from "ioredis";

const connection = process.env.REDIS_URL ? new IORedis(process.env.REDIS_URL) : undefined;

export const ingestQueue = connection ? new Queue("ingest", { connection }) : undefined;

export function registerIngestWorker(processor: (docId: string) => Promise<void>) {
  if (!connection) return; // pas de worker si pas de Redis (mode inline)
  new Worker("ingest", async job => {
    await processor(job.data.docId);
  }, { connection });
}
```

**`apps/web/server/rag/worker.ts`** (initialisé au boot serveur)
```ts
import { registerIngestWorker } from "@/app/lib/queue";
import { runIngestion } from "./ingest";
registerIngestWorker(runIngestion);
```

> Dans `app/layout.tsx` côté serveur, importe `server/rag/worker` pour initialiser le worker en dev. En prod, lance un process séparé.

---

## 7) Storage local

**`apps/web/lib/storage.ts`**
```ts
import path from "path";
import fs from "fs/promises";

export async function saveUpload(file: File, destKey: string) {
  const dest = path.join(process.cwd(), "storage", destKey);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(dest, buf);
  return destKey;
}
```

---

## 8) API Upload & Jobs

**`apps/web/app/api/rag/upload/route.ts`**
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { ingestQueue } from "@/app/lib/queue";
import { saveUpload } from "@/app/lib/storage";
import { runIngestion } from "@/app/server/rag/ingest";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File;
  const subject = String(form.get("subject") || "");
  const level = String(form.get("level") || "");
  const sourceType = String(form.get("sourceType") || "autre");
  if (!file) return NextResponse.json({ error: "missing file" }, { status: 400 });

  const destKey = `uploads/${Date.now()}_${file.name}`;
  await saveUpload(file, destKey);

  const doc = await prisma.userDocument.create({
    data: { ownerRole: "ASSISTANTE", mime: file.type || "application/pdf", originalName: file.name, storageKey: destKey, status: "UPLOADED", meta: { subject, level, sourceType } }
  });
  const job = await prisma.ingestJob.create({ data: { docId: doc.id, status: "PENDING" } });

  if (ingestQueue) {
    await ingestQueue.add("ingest", { docId: doc.id });
  } else {
    // fallback inline
    await prisma.ingestJob.update({ where: { id: job.id }, data: { status: "RUNNING", step: "processing" } });
    try { await runIngestion(doc.id); await prisma.ingestJob.update({ where: { id: job.id }, data: { status: "DONE", progress: 100, step: "done" } }); }
    catch (e: any) { await prisma.ingestJob.update({ where: { id: job.id }, data: { status: "FAILED", error: String(e?.message || e) } }); }
  }

  return NextResponse.json({ ok: true, docId: doc.id });
}
```

**`apps/web/app/api/rag/jobs/route.ts`**
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
export async function GET() {
  const jobs = await prisma.ingestJob.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ jobs });
}
```

**`apps/web/app/api/rag/docs/route.ts`**
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
export async function GET() {
  const docs = await prisma.userDocument.findMany({ orderBy: { createdAt: "desc" } });
  const counts = await prisma.knowledgeAsset.groupBy({ by: ["docId"], _count: { _all: true } });
  const byDoc: Record<string, number> = Object.fromEntries(counts.map(c => [c.docId, c._count._all]));
  return NextResponse.json({ docs: docs.map(d => ({ ...d, assetsCount: byDoc[d.id] || 0 })) });
}
```

---

## 9) Context Builder — serveur

**`apps/web/server/context/builder.ts`**
```ts
import { prisma } from "@/app/lib/prisma";
import { embedTexts } from "@/app/server/vector/embeddings";
import { semanticSearch } from "@/app/server/vector/search";

export type BuiltContext = {
  recent: { role: string; content: string; ts: Date }[];
  episodic: string[];
  semantic: Array<{ chunk: string; source: string; score: number; meta: any }>;
  plan?: string;
  dash?: any;
};

export async function buildContext(studentId: string, subject?: string, level?: string): Promise<BuiltContext> {
  const recentMsgs = await prisma.chatMessage.findMany({ where: { studentId }, orderBy: { ts: "desc" }, take: 30 });
  const episodic = await prisma.memory.findMany({ where: { studentId, kind: "EPISODIC" }, orderBy: { createdAt: "desc" }, take: 5 });
  const plan = await prisma.memory.findFirst({ where: { studentId, kind: "PLAN" }, orderBy: { createdAt: "desc" } });
  const dash = await prisma.dashboard.findUnique({ where: { studentId }, include: { quiz: true, sessions: true } });

  // Construire une requête sémantique simple à partir des derniers messages
  const lastUser = recentMsgs.find(m => m.role === "user");
  const query = lastUser?.content || "récapitulatif progression";
  const [queryEmb] = await embedTexts([query]);
  const sem = await semanticSearch({ queryEmbedding: queryEmb, subject, level, k: 6 });

  return {
    recent: recentMsgs.map(m => ({ role: m.role, content: m.content, ts: m.ts })),
    episodic: episodic.map(e => e.content),
    semantic: sem.map(s => ({ chunk: s.chunk, source: s.source, score: s.cosine, meta: s.meta })),
    plan: plan?.content,
    dash,
  };
}
```

---

## 10) RAG Admin UI — pages & composants

**`apps/web/app/(dashboard)/admin/rag/page.tsx`**
```tsx
"use client";
import * as React from "react";
import { useEffect, useState } from "react";

function Uploader() {
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState("maths");
  const [level, setLevel] = useState("Terminale");
  const [sourceType, setSourceType] = useState("cours");
  const [status, setStatus] = useState<string>("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("subject", subject);
    fd.append("level", level);
    fd.append("sourceType", sourceType);
    setStatus("Envoi...");
    const res = await fetch("/api/rag/upload", { method: "POST", body: fd });
    const j = await res.json();
    setStatus(j.ok ? "Upload OK, indexation lancée." : `Erreur: ${j.error}`);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 p-4 border rounded-2xl">
      <h2 className="font-semibold text-lg">Uploader un document (RAG)</h2>
      <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
      <div className="grid grid-cols-3 gap-2">
        <input value={subject} onChange={e=>setSubject(e.target.value)} className="border p-2 rounded" placeholder="matière (maths/nsi)" />
        <input value={level} onChange={e=>setLevel(e.target.value)} className="border p-2 rounded" placeholder="niveau (Première/Terminale)" />
        <input value={sourceType} onChange={e=>setSourceType(e.target.value)} className="border p-2 rounded" placeholder="type (cours/exercice/annale)" />
      </div>
      <button className="bg-blue-600 text-white px-4 py-2 rounded">Indexer</button>
      <div className="text-sm text-gray-500">{status}</div>
    </form>
  );
}

function Jobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  useEffect(() => {
    const tick = async () => {
      const j = await fetch("/api/rag/jobs").then(r=>r.json());
      setJobs(j.jobs || []);
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="p-4 border rounded-2xl">
      <h2 className="font-semibold text-lg mb-2">Jobs d'indexation</h2>
      <table className="w-full text-sm">
        <thead><tr><th className="text-left">Job</th><th>Doc</th><th>Statut</th><th>Étape</th><th>Progress</th><th>Date</th></tr></thead>
        <tbody>
          {jobs.map((j: any) => (
            <tr key={j.id} className="border-t">
              <td>{j.id}</td>
              <td>{j.docId}</td>
              <td>{j.status}</td>
              <td>{j.step}</td>
              <td>{j.progress}%</td>
              <td>{new Date(j.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Docs() {
  const [docs, setDocs] = useState<any[]>([]);
  useEffect(() => { fetch("/api/rag/docs").then(r=>r.json()).then(j=>setDocs(j.docs||[])); }, []);
  return (
    <div className="p-4 border rounded-2xl">
      <h2 className="font-semibold text-lg mb-2">Documents ingérés</h2>
      <table className="w-full text-sm">
        <thead><tr><th className="text-left">Nom</th><th>Statut</th><th>Matière</th><th>Niveau</th><th>Assets</th><th>Date</th></tr></thead>
        <tbody>
          {docs.map((d:any)=> (
            <tr key={d.id} className="border-t">
              <td>{d.originalName}</td>
              <td>{d.status}</td>
              <td>{d.meta?.subject}</td>
              <td>{d.meta?.level}</td>
              <td>{d.assetsCount}</td>
              <td>{new Date(d.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RagAdminPage() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">RAG Admin — Upload → Jobs → Indexation</h1>
      <Uploader />
      <div className="grid md:grid-cols-2 gap-6">
        <Jobs />
        <Docs />
      </div>
    </div>
  );
}
```

---

## 11) Intégration Context Builder côté Chat

**`apps/web/app/api/context/build/route.ts`** (exemple d’endpoint serveur)
```ts
import { NextRequest, NextResponse } from "next/server";
import { buildContext } from "@/app/server/context/builder";

export async function GET(req: NextRequest) {
  const studentId = String(req.nextUrl.searchParams.get("studentId"));
  const subject = req.nextUrl.searchParams.get("subject") || undefined;
  const level = req.nextUrl.searchParams.get("level") || undefined;
  const ctx = await buildContext(studentId, subject, level);
  return NextResponse.json(ctx);
}
```

Dans ton **chat ARIA**, avant l’appel LLM, tu peux faire :
```ts
const ctx = await fetch(`/api/context/build?studentId=${id}&subject=maths&level=Terminale`).then(r=>r.json());
// Injecte ctx.recent / ctx.episodic / ctx.semantic / ctx.plan / ctx.dash dans tes messages system/user.
```

---

## 12) Notes de production
- **Worker BullMQ** : lance un process séparé `node apps/web/server/rag/worker.js` en prod pour du vrai asynchrone.
- **OCR images** : plugger un provider (GCP Vision, Azure OCR) ; garder la même interface `extractTextFromFile`.
- **Sécurité** : protège /admin avec ACL (NextAuth + middleware). Limite les tailles d’upload.
- **Qualité RAG** : balise fortement `meta` (programme, chapitre, type) au moment de l’upload.
- **Embeddings** : choisis `text-embedding-3-small` (1536 dims) si coût/perf.

---

## 13) Smoke Test rapide
1. `pnpm prisma migrate dev`
2. Crée un élève test + quelques messages/memories (seed minimal).
3. Va sur `/admin/rag` → upload un PDF → observe **Jobs** et **Documents**.
4. Lance `GET /api/context/build?studentId=...` et vérifie l’objet du **Context Builder**.

---

**Fin du pack** — Tu peux étendre avec : re-rankers, preview des extraits RAG, filtres par matière/niveau, re-indexation par doc, et journaux de qualité (couverture, tokens/chunk).

voici un pack enrichi qui couvre exactement tes trois demandes :

Seed script (élève/quiz/mémoires factices) → prêt en 2 min

Middleware ACL NextAuth pour verrouiller /admin/rag

Provider OCR Cloud (GCP Vision) branché à extractTextFromFile (avec fallback local)

Ce que tu as maintenant

Seed : prisma/seed.ts crée 1 élève Terminale (Maths+NSI), messages/quiz/mémoires, dashboard minimal.

ACL : apps/web/middleware.ts protège /admin/* (ADMIN/ASSISTANTE par défaut). Les callbacks NextAuth injectent role dans le JWT/session.

OCR GCP Vision : apps/web/server/rag/ocr.ts détecte texte dans images (Vision) et lit les PDF (pdf-parse), avec fallback OCR si besoin.

# 1) Dépendances
pnpm add next-auth @auth/prisma-adapter jsonwebtoken @google-cloud/vision
pnpm add -D @types/pdf-parse

# 2) Variables d’environnement (.env.local)
# NextAuth
NEXTAUTH_SECRET=remplace_par_une_valeur_32_chars
NEXTAUTH_URL=http://localhost:3000
# GCP Vision (au choix: clés inline OU fichier de credentials)
GOOGLE_PROJECT_ID=...
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n... \n-----END PRIVATE KEY-----\n"
# ou: GOOGLE_APPLICATION_CREDENTIALS=/abs/path/service-account.json
OCR_PROVIDER=gcp
# DB & vecteurs
DATABASE_URL=postgresql://user:pass@localhost:5432/nexus
VECTOR_DIM=3072
OPENAI_API_KEY=sk-...

# 3) Migrations + seed
pnpm prisma migrate dev
pnpm -C apps/web run seed

# 4) Lancer
pnpm -C apps/web dev


Pour tester vite

Connecte-toi avec un compte role=ADMIN ou ASSISTANTE (selon ta base Users).

Va sur /admin/rag → upload un PDF (ou image scannée) → observe les Jobs et l’état INDEXED.

Construit un contexte :
GET /api/context/build?studentId=seed-student&subject=maths&level=Terminale

Points d’attention (pro)

Clé privée GCP : garde les \n — si tu utilises les variables inline, le code remplace \\n par des retours à la ligne réels.

pgvector : vérifie que la dimension (VECTOR_DIM) correspond au modèle d’embedding choisi (3072 pour text-embedding-3-large, 1536 pour -small) et aligne le type Prisma.

Rôles NextAuth : assure-toi que le modèle User a role (ENUM). Le middleware refuse /admin/* si role absent/inadéquat.

Taille d’upload : limite côté Next.js (config route) + côté reverse proxy.

Worker : en prod, lance le worker BullMQ dans un process séparé (le pack gère aussi le fallback inline si pas de Redis).



