# Spécification : Ingestion RAG par URL(s) depuis le dashboard Admin

## Objectif

Depuis la page **Admin → RAG**, permettre à un admin de fournir **une ou plusieurs URL** (HTML/PDF/image). Le système :

1. **récupère** et **détecte** le type (HTML/PDF/IMAGE),
2. **extrait** le texte (readability, PDF parse, OCR),
3. **nettoie & segmente** (chunking),
4. **génère des embeddings** (OpenAI, 1536 dims),
5. **indexe** dans Postgres/**pgvector** (modèles existants),
6. journalise le **job** BullMQ et **expose l’état** dans l’UI.

## Hypothèses

* Stack existante : **Next.js 14 App Router | TypeScript | Prisma/Postgres + pgvector | Redis + BullMQ | OpenAI**.
* Modèles RAG déjà présents ou analogues : `KnowledgeAsset`, `KnowledgeChunk` (embedding `vector(1536)`), `IngestJob`.
* UI admin existante sous `app/(dashboard)/admin/rag/page.tsx`.

---

## 1) Dépendances (installer)

```bash
# Extraction HTML
npm i @mozilla/readability jsdom cheerio

# PDF
npm i pdf-parse

# OCR (dev) - tesseract en binaire est possible, on part sur GCP Vision en prod + tesseract en dev
npm i tesseract.js

# Files/HTTP utilitaires
npm i node-fetch@3 # si besoin, sinon Node 18+ a fetch natif

# BullMQ (+ Redis client si non présent)
npm i bullmq ioredis

# OpenAI embeddings
npm i openai

# Sécurité & utilitaires
npm i sanitize-html
npm i zod
```

> **Remarque** : si `fetch` natif Node est disponible (Node 18+), inutile d’installer `node-fetch`.
> Pour **GCP Vision en prod**, côté backend tu as déjà les SDK/clé ; sinon : `npm i @google-cloud/vision`.

---

## 2) Variables d’environnement

Ajoute à `.env.local` (dev) et `.env` (prod sur VPS) :

```env
# Vector/embeddings
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIM=1536

# OCR provider: "vision" (prod) ou "tesseract" (dev)
OCR_PROVIDER=tesseract
GCP_PROJECT_ID=           # si OCR_PROVIDER=vision
GOOGLE_APPLICATION_CREDENTIALS=/opt/keys/gcp-vision.json

# Limites & sécurité
RAG_MAX_FETCH_MB=25
RAG_ALLOWED_HOSTS=docs.nexusreussite.academy,developer.mozilla.org,wikipedia.org # CSV de domaines autorisés
RAG_DISALLOWED_HOSTS=169.254.169.254,metadata.google.internal # SSRF guard
```

Valide dans `lib/env.ts` (Zod) et **refuse le démarrage en prod** si une clé critique manque.

---

## 3) Arborescence à créer/compléter

```
server/
  rag/
    worker.ts               # Worker BullMQ
    extract.ts              # Fetch + auto-détection (HTML/PDF/IMAGE) + extraction texte
    ocr.ts                  # OCR provider (tesseract dev / GCP Vision prod)
    chunker.ts              # Segmenter en morceaux (tokens simulés)
  vector/
    embeddings.ts           # Appel OpenAI embeddings
    index.ts                # Insertion Prisma + pgvector
lib/
  ssrf.ts                   # Garde SSRF (whitelist/blacklist)
  hash.ts                   # Hash sha256 pour déduplication
  queue.ts                  # (si non existant) initialisation BullMQ + Queue RAG
app/
  api/
    rag/
      ingest-url/route.ts   # POST 1 URL
      ingest-batch/route.ts # POST liste d’URL
  (dashboard)/
    admin/
      rag/page.tsx          # UI admin: champ URL(s), options, suivi jobs
```

---

## 4) Back-end : utilitaires

### 4.1 `lib/ssrf.ts` — garde SSRF & validateur d’URL

```ts
// lib/ssrf.ts
export function isAllowedUrl(input: string): boolean {
  try {
    const u = new URL(input);
    const host = u.hostname.toLowerCase();

    const allowed = (process.env.RAG_ALLOWED_HOSTS || '')
      .split(',').map(x => x.trim().toLowerCase()).filter(Boolean);

    const blocked = (process.env.RAG_DISALLOWED_HOSTS || '')
      .split(',').map(x => x.trim().toLowerCase()).filter(Boolean);

    // Interdire host privé connu
    if (blocked.some(b => host.includes(b))) return false;
    // Si whitelist définie, exiger qu'elle matche
    if (allowed.length > 0 && !allowed.some(a => host.endsWith(a))) return false;

    // Protocoles autorisés
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
```

### 4.2 `lib/hash.ts` — hash sha256 (déduplication)

```ts
// lib/hash.ts
import crypto from 'crypto';
export function sha256(s: string | Buffer): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}
```

### 4.3 `lib/queue.ts` — Queue BullMQ

```ts
// lib/queue.ts
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export const ragQueue = new Queue('rag', { connection });
```

---

## 5) Back-end : extraction/transform

### 5.1 `server/rag/ocr.ts` — OCR provider

```ts
// server/rag/ocr.ts
import { createWorker } from 'tesseract.js';

export async function ocrBufferTesseract(buf: Buffer, lang = 'eng+fra'): Promise<string> {
  const worker = await createWorker(lang);
  const res = await worker.recognize(buf);
  await worker.terminate();
  return res.data.text || '';
}

// GCP Vision (prod)
export async function ocrBufferVision(buf: Buffer): Promise<string> {
  // @google-cloud/vision doit être installé et GOOGLE_APPLICATION_CREDENTIALS défini
  const { ImageAnnotatorClient } = await import('@google-cloud/vision');
  const client = new ImageAnnotatorClient();
  const [result] = await client.textDetection({ image: { content: buf.toString('base64') } });
  const detections = result?.textAnnotations?.[0]?.description ?? '';
  return detections;
}

export async function ocrBuffer(buf: Buffer): Promise<string> {
  const provider = (process.env.OCR_PROVIDER || 'tesseract').toLowerCase();
  return provider === 'vision' ? ocrBufferVision(buf) : ocrBufferTesseract(buf);
}
```

### 5.2 `server/rag/extract.ts` — HTML/PDF/IMAGE vers texte

```ts
// server/rag/extract.ts
import sanitizeHtml from 'sanitize-html';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { ocrBuffer } from './ocr';

const MAX_MB = Number(process.env.RAG_MAX_FETCH_MB || 25);

export type ExtractedDoc = {
  text: string;
  title: string;
  mime: string;
  language?: string | null;
  metadata: Record<string, any>;
};

export async function fetchAsBuffer(url: string): Promise<{ buf: Buffer; type: string }> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const type = res.headers.get('content-type') || 'application/octet-stream';

  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_MB * 1024 * 1024) throw new Error('File too large');

  return { buf: Buffer.from(ab), type };
}

export async function extractFromUrl(url: string): Promise<ExtractedDoc> {
  const { buf, type } = await fetchAsBuffer(url);

  if (type.includes('pdf')) {
    const data = await pdf(buf);
    return asDoc(data.text, 'application/pdf', url, guessTitle(url));
  }

  if (type.startsWith('image/')) {
    const text = await ocrBuffer(buf);
    return asDoc(text, type, url, guessTitle(url));
  }

  // HTML : parse + readability
  const html = buf.toString('utf8');
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const text = article?.textContent || fallbackText(html);

  return asDoc(text, 'text/html', url, article?.title || guessTitle(url));
}

function asDoc(textRaw: string, mime: string, url: string, title?: string): ExtractedDoc {
  const clean = sanitizeHtml(textRaw, {
    allowedTags: [],
    allowedAttributes: {}
  })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    text: clean,
    title: title || 'Untitled',
    mime,
    language: detectFr(clean),
    metadata: { url, fetchedAt: new Date().toISOString() }
  };
}

function fallbackText(html: string): string {
  const $ = cheerio.load(html);
  return $('body').text();
}

function detectFr(s: string): string | null {
  // simple heuristique ; tu peux plugger franc/langdetect plus tard
  return / le | la | les | de | un | une | est | et /i.test(s) ? 'fr' : null;
}

function guessTitle(u: string) { try { return new URL(u).hostname; } catch { return 'Untitled'; } }
```

### 5.3 `server/rag/chunker.ts` — segmentation

```ts
// server/rag/chunker.ts
import crypto from 'crypto';

export function chunkText(s: string, opts = { maxTokens: 900, overlap: 150 }) {
  const max = opts.maxTokens * 4; // ~ chars per token
  const ov = opts.overlap * 4;
  const chunks: { id: string; text: string }[] = [];

  let i = 0;
  while (i < s.length) {
    const end = Math.min(i + max, s.length);
    const slice = s.slice(i, end).trim();
    if (slice) chunks.push({ id: crypto.randomUUID(), text: slice });
    i = end - ov;
    if (i < 0) i = 0;
  }
  return chunks;
}
```

### 5.4 `server/vector/embeddings.ts` — OpenAI embeddings

```ts
// server/vector/embeddings.ts
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function embedChunks(chunks: { text: string }[]) {
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const input = chunks.map(c => c.text);
  const res = await openai.embeddings.create({ model, input });
  return res.data.map(v => v.embedding); // number[][]
}
```

### 5.5 `server/vector/index.ts` — indexer dans Prisma + pgvector

```ts
// server/vector/index.ts
import { prisma } from '@/lib/prisma';

type Params = {
  url: string;
  title: string;
  language?: string | null;
  subject?: string | null;
  level?: string | null;
  userId: string;
  visibility: 'private' | 'public';
  chunks: { id: string; text: string }[];
  vectors: number[][];
  metadata?: any;
};

export async function indexChunks(p: Params) {
  // 1) KnowledgeAsset (doc)
  const asset = await prisma.knowledgeAsset.create({
    data: {
      url: p.url,
      title: p.title,
      language: p.language,
      subject: p.subject ?? undefined,
      level: p.level ?? undefined,
      visibility: p.visibility,
      ownerId: p.userId,
      rawMetadata: p.metadata ?? {}
    }
  });

  // 2) Chunks + embeddings
  const data = p.chunks.map((c, i) => ({
    assetId: asset.id,
    ordinal: i,
    text: c.text,
    embedding: p.vectors[i] as any // Prisma pgvector
  }));

  // Prisma createMany pour accélérer
  await prisma.knowledgeChunk.createMany({ data, skipDuplicates: true });

  return asset.id;
}
```

> **Index pgvector** (si pas encore créé) :

```sql
-- cosine distance
CREATE INDEX IF NOT EXISTS knowledgechunk_embedding_ivfflat
ON "KnowledgeChunk" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ANALYZE "KnowledgeChunk";
```

---

## 6) Back-end : Worker BullMQ

### 6.1 `server/rag/worker.ts`

```ts
// server/rag/worker.ts
import { Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { extractFromUrl } from './extract';
import { chunkText } from './chunker';
import { embedChunks } from '../vector/embeddings';
import { indexChunks } from '../vector/index';
import { sha256 } from '@/lib/hash';

const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export const ragWorker = new Worker('rag', async (job) => {
  const { url, subject, level, userId, visibility } = job.data as {
    url: string; subject?: string|null; level?: string|null; userId: string;
    visibility: 'public' | 'private';
  };

  // Extraction
  const doc = await extractFromUrl(url);
  const contentHash = sha256(doc.text);

  // Option déduplication: si un asset (url+hash) existe déjà → skip
  // (nécessite colonnes hash dans KnowledgeAsset ou table de mapping)
  // TODO: add if you want strict dedup.

  // Chunk + embed
  const chunks = chunkText(doc.text);
  const vectors = await embedChunks(chunks);

  // Index
  const assetId = await indexChunks({
    url, title: doc.title, language: doc.language ?? 'fr',
    subject: subject ?? null, level: level ?? null, userId, visibility,
    chunks, vectors, metadata: doc.metadata
  });

  return { assetId, url, chunks: chunks.length, title: doc.title };
}, { connection });

export const ragQueueEvents = new QueueEvents('rag', { connection });
```

> **Démarrage du worker en dev** :
>
> * Soit **dans le process Next** (edge : attention long-running)
> * Soit **process séparé** : `scripts/start-rag-worker.ts` + `pm2`/`node` dans Docker compose.

Exemple `scripts/start-rag-worker.ts` :

```ts
// scripts/start-rag-worker.ts
import 'dotenv/config';
import { ragWorker } from '../server/rag/worker';

console.log('[rag-worker] started');
ragWorker.on('completed', (job, res) => console.log('[rag-worker] completed', job.id, res));
ragWorker.on('failed', (job, err) => console.error('[rag-worker] failed', job?.id, err));
```

---

## 7) API Routes

### 7.1 `app/api/rag/ingest-url/route.ts` — **1 URL**

```ts
// app/api/rag/ingest-url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ragQueue } from '@/lib/queue';
import { isAllowedUrl } from '@/lib/ssrf';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { url, subject, level, visibility } = body;

  if (!url || typeof url !== 'string') return NextResponse.json({ error: 'url required' }, { status: 400 });
  if (!isAllowedUrl(url)) return NextResponse.json({ error: 'domain not allowed' }, { status: 400 });

  const job = await ragQueue.add('ingest-url', {
    url,
    subject: subject ?? null,
    level: level ?? null,
    userId: session.user.id,
    visibility: visibility === 'public' ? 'public' : 'private'
  });

  return NextResponse.json({ jobId: job.id, status: 'queued' });
}
```

### 7.2 `app/api/rag/ingest-batch/route.ts` — **plusieurs URL**

```ts
// app/api/rag/ingest-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ragQueue } from '@/lib/queue';
import { isAllowedUrl } from '@/lib/ssrf';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { urls, subject, level, visibility } = body;

  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: 'urls[] required' }, { status: 400 });
  }

  const accepted: string[] = [];
  const rejected: { url: string; reason: string }[] = [];

  for (const u of urls) {
    if (typeof u !== 'string' || !isAllowedUrl(u)) {
      rejected.push({ url: String(u), reason: 'invalid or disallowed' });
      continue;
    }
    const job = await ragQueue.add('ingest-url', {
      url: u,
      subject: subject ?? null,
      level: level ?? null,
      userId: session.user.id,
      visibility: visibility === 'public' ? 'public' : 'private'
    });
    accepted.push(String(job.id));
  }

  return NextResponse.json({ queued: accepted.length, jobs: accepted, rejected });
}
```

---

## 8) UI Admin — page RAG

### 8.1 `app/(dashboard)/admin/rag/page.tsx` (extrait)

* **Formulaire** : textarea (une URL par ligne), options `subject/level/visibility`
* **Actions** : “Ingestion 1 URL” ou “Ingestion lot”
* **Tableau jobs** : afficher `queued → processing → completed/failed` (optionnel : `/api/rag/jobs` si tu as déjà une route)

```tsx
// app/(dashboard)/admin/rag/page.tsx
'use client';

import { useState } from 'react';

export default function AdminRagPage() {
  const [urlsText, setUrlsText] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('');
  const [visibility, setVisibility] = useState<'private'|'public'>('private');
  const [result, setResult] = useState<any>(null);

  const singleUrl = urlsText.split('\n').map(s => s.trim()).filter(Boolean)[0] || '';

  async function ingestOne() {
    const res = await fetch('/api/rag/ingest-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: singleUrl, subject, level, visibility })
    });
    setResult(await res.json());
  }

  async function ingestBatch() {
    const urls = urlsText.split('\n').map(s => s.trim()).filter(Boolean);
    const res = await fetch('/api/rag/ingest-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, subject, level, visibility })
    });
    setResult(await res.json());
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Ingestion RAG par URL(s)</h1>

      <div className="grid gap-4">
        <textarea
          className="border rounded p-3 min-h-[140px]"
          placeholder="Collez 1 URL par ligne (http/https)"
          value={urlsText}
          onChange={e => setUrlsText(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-3">
          <input className="border rounded p-2" placeholder="Matière (subject)" value={subject} onChange={e => setSubject(e.target.value)} />
          <input className="border rounded p-2" placeholder="Niveau (level)" value={level} onChange={e => setLevel(e.target.value)} />
          <select className="border rounded p-2" value={visibility} onChange={e => setVisibility(e.target.value as any)}>
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </div>
        <div className="flex gap-3">
          <button onClick={ ingestOne } className="bg-blue-600 text-white px-4 py-2 rounded">Ingestion 1 URL</button>
          <button onClick={ ingestBatch } className="bg-indigo-600 text-white px-4 py-2 rounded">Ingestion lot</button>
        </div>
      </div>

      {result && (
        <pre className="bg-gray-50 border rounded p-3 text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}
```

> Optionnel : composant de **suivi des jobs** si tu exposes `/api/rag/jobs` (list/poll).

---

## 9) Cohérence Prisma (si besoin)

Si ton modèle diffère, assure :

```prisma
model KnowledgeAsset {
  id          String   @id @default(cuid())
  url         String
  title       String
  language    String?
  subject     String?
  level       String?
  visibility  String   @default("private")
  ownerId     String
  rawMetadata Json

  chunks      KnowledgeChunk[]
  createdAt   DateTime @default(now())
}

model KnowledgeChunk {
  id        String   @id @default(cuid())
  assetId   String
  ordinal   Int
  text      String
  embedding Unsupported("vector") // pgvector
  asset     KnowledgeAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)
  @@index([assetId, ordinal])
}
```

Migration SQL (exemple) pour `embedding vector(1536)` :

```sql
ALTER TABLE "KnowledgeChunk" ALTER COLUMN "embedding" TYPE vector(1536);
CREATE INDEX IF NOT EXISTS knowledgechunk_embedding_ivfflat
  ON "KnowledgeChunk" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
ANALYZE "KnowledgeChunk";
```

---

## 10) Tests (dev) — procédure

1. **Redis** & **Postgres** up (`docker-compose.dev.yml`)
2. `npm run dev` + **démarrer le worker** :

   ```bash
   ts-node scripts/start-rag-worker.ts
   # ou
   node --loader ts-node/esm scripts/start-rag-worker.ts
   ```
3. Page **Admin → RAG** : colle 3 URL tests :

   * une page article (HTML),
   * un PDF texte,
   * une image (infographie) pour **OCR**.
4. Vérifie la réponse : `queued`, puis observe les logs worker → `completed`.
5. Contrôle DB : nombre de `KnowledgeChunk` créés, index OK.
6. Requête RAG (ta route de recherche) → pertinence top-k.

---

## 11) Préparation **prod** (VPS)

### 11.1 Docker Compose (services)

* **app** (Next.js)
* **worker** (exécute `node scripts/start-rag-worker.js`)
* **postgres** (pgvector)
* **redis** (BullMQ)
* (**minio** si tu stockes des binaires)

Extrait **worker** :

```yaml
  rag-worker:
    image: nexus/app:latest
    command: ["node","scripts/start-rag-worker.js"]
    env_file:
      - /opt/nexus/.env
    depends_on:
      - redis
      - postgres
    restart: unless-stopped
```

### 11.2 Nginx

* **timeouts** et `client_max_body_size` (PDF lourds)
* **CSP**, HSTS, gzip/brotli
* (SSE concerne surtout ARIA; la route RAG est HTTP classique)

### 11.3 Sécurité & conformité

* **Whitelist** `RAG_ALLOWED_HOSTS`
* **SSRF guard** actif
* **Antivirus** (optionnel) via clamav si tu crains des fichiers malveillants
* Respecte **robots.txt** et droits d’auteur : stocke `url`, `fetchedAt` dans metadata

### 11.4 CI

* **lint/type/tests**
* **npm audit** (fail on low)
* **gitleaks**
* **audit-db** (cohérence DB)
* **job e2e** (Playwright : simuler une ingestion d’URL)

---

## 12) Pièges & bonnes pratiques

* **Déduplication** : utilise `sha256(text)` pour éviter l’index multiple de mêmes contenus.
* **Re-crawl** : CRON (ou job BullMQ) pour vérifier `ETag/Last-Modified` et réindexer si modifié.
* **Chunking** : ajuste `maxTokens/overlap` selon tes prompts RAG.
* **Embeddings** : garde `text-embedding-3-small` (1536) si c’est ton standard actuel.
* **Logs** : masque les PII ; journalise `userId, url, assetId, chunks`.
* **RBAC** : endpoint réservé aux **admin** ; `middleware.ts` doit filtrer l’accès à la page Admin + routes.

---

## 13) (Optionnel) Endpoint jobs pour UI

Si tu veux afficher l’état dans l’UI :

```ts
// app/api/rag/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // TODO: retourner la liste des derniers IngestJob depuis Prisma si tu journalises
  return NextResponse.json({ jobs: [] });
}
```

---

## 14) Résumé “à faire”

1. **Installer** packages.
2. **Créer** fichiers utilitaires (`ssrf.ts`, `hash.ts`, `queue.ts`).
3. **Implémenter** `extract.ts`, `ocr.ts`, `chunker.ts`, `embeddings.ts`, `index.ts`.
4. **Ajouter** `worker.ts` + script `scripts/start-rag-worker.ts`.
5. **Créer** API routes `/api/rag/ingest-url` et `/api/rag/ingest-batch`.
6. **Mettre à jour** l’UI admin `admin/rag/page.tsx`.
7. **Vérifier Prisma** (embedding vector dims/index).
8. **Tester** en dev (3 URL typiques).
9. **Préparer prod** (compose, env, Nginx, CI).
