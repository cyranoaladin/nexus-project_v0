**Objet : Implémentation complète de l'écosystème ARIA pour Nexus Réussite, du développement à la production sur VPS.**

**Contexte du Projet :**
ARIA (Agent de Renseignement Intellectuel Avancé) est la pierre angulaire de la stratégie pédagogique de Nexus Réussite. Il s'agit d'un système éducatif intelligent complet qui vise à offrir un accompagnement personnalisé, des ressources pédagogiques de haute qualité et une expérience utilisateur premium pour les élèves, leurs parents, les coachs et les administrateurs pédagogiques.

Ce cahier des charges fusionne toutes les spécifications techniques, les exigences fonctionnelles et les directives de déploiement nécessaires pour implémenter ARIA de A à Z, en s'assurant que chaque composant est optimisé pour la performance, la sécurité et la maintenabilité.

---

### **1. Vision et Objectifs Généraux d'ARIA**

ARIA doit incarner l'excellence pédagogique de Nexus Réussite, en étant un outil puissant, fiable et intuitif.

**1.1. Objectifs Clés :**
*   Fournir un agent pédagogique intelligent (professeur IA) disponible 24/7 pour les élèves abonnés.
*   Offrir un accompagnement multi-matières (Maths, NSI, avec extensibilité).
*   Maintenir une mémoire contextuelle à long terme des interactions pour un apprentissage adapté.
*   Générer du contenu pédagogique de qualité professionnelle (cours, résumés, fiches, exercices, sujets d'examen) au format LaTeX/PDF avec auto-correction.
*   Assurer une expérience utilisateur premium et intuitive pour tous les rôles.
*   Permettre une ingestion facile et un accès performant aux documents pédagogiques (RAG).

**1.2. Principes Fondateurs :**
*   **Excellence Pédagogique :** Alignement avec les programmes français du Baccalauréat, ton premium Nexus, cohérence avec la matrice d'offres.
*   **Séparation des Responsabilités :** Modularité claire entre UI, Orchestration, RAG, Mémoire, Génération et Compilation.
*   **Sécurité et RGPD :** Minimisation des données, chiffrement au repos, journalisation non-intrusive, gestion des rôles (ACL).
*   **Observabilité :** Traces détaillées par étape (ingestion, indexation, récupération, génération, compilation), métriques de qualité.

---

### **2. Architecture Technique Unifiée**

**2.1. Stack Technologique Globale :**
*   **Frontend & Backend (Monolithe modulaire) :** Next.js 14+ avec App Router et API Routes (TypeScript strict).
*   **Base de Données :** PostgreSQL avec Prisma ORM et extension `pgvector`.
*   **Cache & Queues :** Redis pour la gestion des queues de traitement asynchrone (BullMQ) et le caching.
*   **IA & ML :** OpenAI API (GPT-4 pour production, GPT-3.5-turbo pour développement, Embeddings `text-embedding-3-large`), Hugging Face Transformers (pour modèles spécialisés locaux), LangChain pour l'orchestration des prompts.
*   **OCR :** Google Cloud Vision API (production) avec fallback Tesseract local (développement).
*   **Stockage des Documents :** Local pour le développement, extensible vers S3/MinIO pour la production.
*   **Animations :** Framer Motion.
*   **Gestion d'état serveur :** React Query (TanStack).

**2.2. Approche des "Microservices" :**
Bien que l'architecture technique soit basée sur Next.js App Router, la logique sera structurée en **services modulaires** distincts au sein du backend Next.js (dossiers `server/rag`, `server/context`, `server/memory`, `server/generation`, etc.) pour maintenir une séparation claire des responsabilités et faciliter la maintenance.

---

### **3. Modèle de Données Détaillé (Prisma `schema.prisma`)**

Implémentez le schéma Prisma suivant, en vous assurant des types, des relations et des indexes.

```prisma
// Fichier : prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// --- Modèles d'Authentification et Utilisateurs ---
model User {
  id          String    @id @default(cuid())
  email       String    @unique
  password    String?   // Hashé avec bcrypt, peut être null si OAuth
  role        UserRole
  // NextAuth
  emailVerified DateTime?
  image         String?
  name          String?
  accounts      Account[]
  sessions      Session[]

  // Relations
  students    Student[]   // Pour les parents
  mailLogs    MailLog[]   // Historique des emails envoyés par cet user
  documents   UserDocument[] // Documents uploadés par cet user

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum UserRole {
  ADMIN      // Accès complet, gouvernance
  ASSISTANTE // Ingestion simple, suivi, publication
  COACH      // Upload supports, rapports, validation
  ELEVE      // Chat ARIA, docs, progression
  PARENT     // Lecture bilans, progression
}

// Nécessaire pour NextAuth
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

// Nécessaire pour NextAuth
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// --- Modèles Pédagogiques et Suivi Élève ---
model Student {
  id          String        @id @default(cuid())
  userId      String        @unique // L'utilisateur associé à l'élève
  user        User          @relation(fields: [userId], references: [id])
  firstName   String
  lastName    String
  level       String        // Première/Terminale
  subjects    String        // Ex: "Spé Maths + NSI"
  status      String        // Scolarisé / Candidat libre
  // Relations
  dashboard   Dashboard?
  messages    ChatMessage[]
  memories    Memory[]
  documents   UserDocument[]
  bilans      Bilan[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

model Dashboard { // Agrège les KPIs de l'élève
  id          String       @id @default(cuid())
  studentId   String       @unique
  student     Student      @relation(fields: [studentId], references: [id])
  kpis        Json         // scores, temps d’étude, badges, etc.
  sessions    StudentSession[] // Renommé pour éviter conflit avec NextAuth Session
  quiz        QuizResult[]
  coachNotes  CoachReport[] // Ajouté pour les rapports de coachs (si applicable)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model StudentSession { // Renommé pour éviter conflit
  id        String   @id @default(cuid())
  dashboardId String
  dashboard Dashboard @relation(fields: [dashboardId], references: [id])
  date      DateTime @default(now())
  type      String   // Ex: "cours", "coaching", "révision"
  notes     Json     // Détails de la session
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model CoachReport {
  id        String   @id @default(cuid())
  dashboardId String
  dashboard Dashboard @relation(fields: [dashboardId], references: [id])
  date      DateTime @default(now())
  report    Json     // Contenu du rapport
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model QuizResult {
  id        String   @id @default(cuid())
  dashboardId String
  dashboard Dashboard @relation(fields: [dashboardId], references: [id])
  date      DateTime @default(now())
  subject   String
  score     Float
  detail    Json     // Détail des questions/réponses
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ChatMessage {
  id        String   @id @default(cuid())
  studentId String
  student   Student  @relation(fields: [studentId], references: [id])
  role      String   // "user" ou "assistant"
  content   String   @db.Text
  ts        DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// --- Système de Mémoire ARIA ---
model Memory {
  id          String     @id @default(cuid())
  studentId   String
  student     Student    @relation(fields: [studentId], references: [id])
  kind        MemoryKind
  content     String     @db.Text // Résumé, faits saillants, objectifs
  embedding   Float[]    @db.Vector(3072) // Ou 1536 selon le modèle d'embedding utilisé
  importance  Float      @default(1.0) // Importance pour le retrieval
  accessedAt  DateTime   @default(now())
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([studentId, kind])
  @@index([accessedAt])
}

enum MemoryKind {
  EPISODIC   // Résumés d'interactions passées (conversations, sessions)
  SEMANTIC   // Connaissances générales durables sur l'élève (objectifs, difficultés récurrentes)
  PLAN       // Le plan de progression actif de l'élève
  PREFERENCE // Préférences d'apprentissage, sujets favoris
}

// --- Gestion des Documents Pédagogiques (RAG) ---
model UserDocument { // Documents uploadés par les utilisateurs (élèves ou staff)
  id           String      @id @default(cuid())
  ownerId      String      // ID de l'utilisateur qui a uploadé
  owner        User        @relation(fields: [ownerId], references: [id])
  studentId    String?     // Si le document est lié à un élève spécifique
  student      Student?    @relation(fields: [studentId], references: [id])
  mime         String
  originalName String
  storageKey   String      // Chemin de stockage (local, S3, etc.)
  status       DocStatus   @default(UPLOADED) // Statut dans le pipeline d'ingestion
  meta         Json        // Métadonnées additionnelles (matière, niveau, source, tags)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  assets       KnowledgeAsset[] // Chunks associés à ce document
  ingestJob    IngestJob?  // Job d'ingestion lié
}

enum DocStatus {
  UPLOADED   // Fichier uploadé, en attente de traitement
  OCR_DONE   // Texte extrait par OCR (si applicable)
  CLEANED    // Contenu nettoyé
  CHUNKED    // Divisé en morceaux
  EMBEDDED   // Embeddings générés
  INDEXED    // Chunks indexés dans la base vectorielle
  FAILED     // Échec du traitement
  PUBLISHED  // Prêt à être utilisé par ARIA
  ARCHIVED   // Archivé
}

model KnowledgeAsset { // Unité indexable pour le RAG (un chunk de document)
  id        String    @id @default(cuid())
  docId     String
  document  UserDocument @relation(fields: [docId], references: [id])
  subject   String    // Matière du chunk (ex: "maths", "nsi")
  level     String?   // Niveau (ex: "Première", "Terminale")
  source    String    // Type de source (ex: "cours", "exercice", "annale", "rapport")
  chunk     String    @db.Text // Le morceau de texte
  tokens    Int       // Nombre de tokens dans le chunk
  embedding Float[]   @db.Vector(3072) // Le vecteur d'embedding du chunk
  meta      Json      // Métadonnées spécifiques au chunk (page, section, tags)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([docId])
  @@index([subject, level])
  @@index([embedding], type: Gin) // Index vectoriel pour pgvector
}

model IngestJob { // Suivi des jobs d'ingestion de documents
  id        String     @id @default(cuid())
  docId     String     @unique
  document  UserDocument @relation(fields: [docId], references: [id])
  status    JobStatus  @default(PENDING) // Statut du job
  step      String     @default("queued") // Étape actuelle du pipeline
  progress  Int        @default(0)       // Progression en pourcentage
  error     String?    @db.Text          // Message d'erreur si échec
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

enum JobStatus {
  PENDING    // En attente de traitement
  RUNNING    // En cours de traitement
  FAILED     // Échec du job
  DONE       // Job terminé avec succès
}

// --- Génération de Bilans (extension) ---
model Bilan {
  id               String    @id @default(cuid())
  userId           String
  user             User      @relation(fields: [userId], references: [id])
  studentId        String?
  student          Student?  @relation(fields: [studentId], references: [id]) // Si le bilan est lié à un élève spécifique
  qcmScores        Json?     // Scores détaillés du QCM
  pedagoProfile    Json?     // Réponses au questionnaire pédagogique
  synthesis        Json?     // Synthèse automatique interne
  offers           Json?     // Offres Nexus recommandées
  reportText       String?   @db.Text // Texte complet du rapport généré par OpenAI
  summaryText      String?   @db.Text // Texte de la synthèse d'une page
  generatedAt      DateTime? // Date de génération du rapport complet
  status           String?   // Statut de génération (ex: "PENDING", "GENERATED", "ERROR")
  variant          String?   // Variante du bilan (ex: "standard", "parent", "eleve")
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  mailLogs         MailLog[] // Historique des envois email de ce bilan
}

model MailLog {
  id           String   @id @default(cuid())
  bilanId      String
  bilan        Bilan    @relation(fields: [bilanId], references: [id])
  userId       String   // Expéditeur (admin/coachs/parent/eleve)
  user         User     @relation(fields: [userId], references: [id])
  variant      String   // "standard" | "parent" | "eleve"
  recipients   String   @db.Text // CSV des emails
  subject      String
  status       String   // "SENT" | "FAILED"
  messageId    String?  // ID SMTP retourné par le provider
  error        String?  @db.Text // Message d’erreur éventuel
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

// --- Modèles de Génération de Contenu Pédagogique ---
model GeneratedDocument {
  id          String     @id @default(cuid())
  studentId   String?    // Si généré pour un élève spécifique
  student     Student?   @relation(fields: [studentId], references: [id])
  title       String
  description String?    @db.Text
  type        String     // Ex: "cours", "resume", "exercice"
  subject     String
  level       String
  contentHtml String?    @db.Text // Version HTML du contenu
  contentLatex String?   @db.Text // Contenu LaTeX généré
  pdfStorageKey String?  // Chemin de stockage du PDF final (local, S3)
  status      String     @default("PENDING") // Statut de génération/compilation
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

```

---

### **4. Configuration de l'Environnement de Développement (Local)**

Cursor, vous devez vous assurer que l'environnement de développement local est fonctionnel et reproduit fidèlement les services essentiels.

**4.1. Prérequis Système (Linux/macOS) :**
*   **Linux (Ubuntu/Debian) :** `sudo apt update && sudo apt upgrade -y && sudo apt install -y git nodejs npm python3 python3-pip python3-venv docker.io docker-compose tesseract-ocr tesseract-ocr-fra ffmpeg`
*   **macOS :** `brew install git node python@3.10 docker tesseract ffmpeg`
*   **Utilisateur Docker :** `sudo usermod -aG docker $USER && newgrp docker`

**4.2. Répertoire de Projet :**
*   Cloner le dépôt GitHub du projet dans `~/projects/aria-agent` ou un emplacement similaire.

**4.3. Variables d'Environnement Locales (`.env.local`) :**
Créez ce fichier à la racine du projet avec les valeurs de développement.

```env
# Mode développement
NODE_ENV=development

# URLs locales
APP_URL=http://localhost:3000
API_URL=http://localhost:3000/api

# Base de données PostgreSQL (via Docker)
POSTGRES_DB=aria_dev
POSTGRES_USER=aria_user
POSTGRES_PASSWORD=dev_password
POSTGRES_HOST=localhost # Pour l'accès depuis l'hôte
POSTGRES_PORT=5432
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"

# Redis (via Docker)
REDIS_URL=redis://localhost:6379

# OpenAI (à remplir avec vos clés)
OPENAI_API_KEY="sk-votre-cle-api-openai-ici"
OPENAI_MODEL="gpt-3.5-turbo" # Utiliser gpt-3.5-turbo en dev pour économiser
EMBEDDING_MODEL="text-embedding-3-small" # Pour 1536 dimensions
VECTOR_DIM=1536 # Correspond à text-embedding-3-small

# Hugging Face (optionnel pour le développement)
HUGGINGFACE_HUB_TOKEN="YOUR_HF_TOKEN"

# GCP Vision (pour l'OCR, si le provider est "gcp")
OCR_PROVIDER=gcp # "gcp" ou "tesseract"
GOOGLE_PROJECT_ID="votre-project-id"
GOOGLE_CLIENT_EMAIL="votre-service-account-email"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..." # Clé privée encodée en base64 si nécessaire, ou chemin vers un JSON
# Ou GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Clés de développement (ne pas utiliser en production)
NEXTAUTH_SECRET="dev-secret-temporaire-pour-le-developpement-de-plus-de-32-chars" # IMPORTANT : doit être long
JWT_SECRET="dev-jwt-secret-temporaire-pour-le-developpement"
CRYPTO_SECRET="dev-crypto-secret-temporaire"

# Configuration développement
DEBUG=true
LOG_LEVEL=debug
DISABLE_RATE_LIMITING=true
```

**4.4. Docker Compose pour le Développement (`docker-compose.dev.yml`) :**
Créez ce fichier à la racine du projet.

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: aria_postgres_dev
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432" # Expose le port pour un accès depuis l'hôte si nécessaire (ex: Prisma Studio)
    volumes:
      - postgres_data_dev:/var/lib/postgresql/data
    networks:
      - aria_network_dev
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: aria_redis_dev
    ports:
      - "6379:6379"
    volumes:
      - redis_data_dev:/data
    networks:
      - aria_network_dev

volumes:
  postgres_data_dev:
  redis_data_dev:

networks:
  aria_network_dev:
    driver: bridge
```

**4.5. Dépendances Node.js (`package.json`) :**
Mettez à jour le `package.json` avec les scripts et dépendances nécessaires.

```json
{
  "name": "aria-agent",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "dev:services": "docker-compose -f docker-compose.dev.yml up",
    "dev:full": "concurrently \"npm run dev:services\" \"npm run dev\"",
    "db:reset": "docker-compose -f docker-compose.dev.yml down -v && docker-compose -f docker-compose.dev.yml up -d && npx prisma migrate dev --name init && npx prisma db seed",
    "db:migrate": "npx prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "npx prisma studio",
    "test:ai": "python3 scripts/test-ai-dev.py",
    "test": "jest",
    "test:e2e": "playwright test",
    "worker": "tsx server/rag/worker.ts", // Pour lancer le worker BullMQ en process séparé en dev/prod
    "queue:ui": "npx bullmq-pro", // Si bullmq-pro est utilisé pour l'interface d'admin de la queue
  },
  "dependencies": {
    "@auth/prisma-adapter": "^2.4.1",
    "@prisma/client": "^5.x.x",
    "@react-pdf/renderer": "^3.x.x",
    "bullmq": "^5.x.x",
    "gpt-tokenizer": "^2.x.x",
    "ioredis": "^5.x.x",
    "langchain": "^0.x.x",
    "langchain-community": "^0.x.x",
    "moviepy": "^1.x.x",
    "mustache": "^4.x.x",
    "next": "14.x.x",
    "next-auth": "^5.x.x-beta",
    "nodemailer": "^6.x.x",
    "openai": "^4.x.x",
    "pdf-parse": "^1.x.x",
    "pgvector": "^1.x.x",
    "react": "18.x.x",
    "react-dom": "18.x.x",
    "tailwind-merge": "^2.x.x",
    "tailwindcss-animate": "^1.x.x",
    "zod": "^3.x.x",
    "@google-cloud/vision": "^4.x.x" // Pour OCR GCP Vision
  },
  "devDependencies": {
    "@types/node": "^20.x.x",
    "@types/react": "^18.x.x",
    "@types/react-dom": "^18.x.x",
    "@types/mustache": "^4.x.x",
    "@types/nodemailer": "^6.x.x",
    "@types/pdf-parse": "^1.x.x",
    "autoprefixer": "^10.x.x",
    "concurrently": "^8.x.x",
    "eslint": "^8.x.x",
    "eslint-config-next": "14.x.x",
    "postcss": "^8.x.x",
    "prisma": "^5.x.x",
    "tailwindcss": "^3.x.x",
    "typescript": "^5.x.x",
    "tsx": "^4.x.x",
    "jest": "^29.x.x",
    "@testing-library/react": "^14.x.x",
    "@testing-library/jest-dom": "^6.x.x",
    "playwright": "^1.x.x"
  }
}
```
*   **Après avoir mis à jour `package.json` :** Exécuter `npm install`.

**4.6. Dépendances Python (`requirements-dev.txt`) :**
Créez ce fichier à la racine du projet, puis installez-les dans l'environnement virtuel Python.

```txt
# Core AI
openai>=1.0.0
langchain>=0.0.300
transformers>=4.34.0
sentence-transformers>=2.2.2

# Document processing (local fallbacks)
pdfplumber>=0.10.0
python-docx>=0.8.11
Pillow>=10.0.0
pytesseract>=0.3.10
pdf2image>=1.16.3
unstructured>=0.10.0

# Utilitaires
python-dotenv>=1.0.0
numpy>=1.24.0
pandas>=2.0.0
tqdm>=4.66.0
```
*   **Après avoir créé `requirements-dev.txt` :**
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate
    python3 -m pip install -r requirements-dev.txt
    ```

**4.7. Scripts de Développement :**
Ces scripts seront ajoutés dans le dossier `scripts/` à la racine du projet.

*   **`scripts/download-dev-models.py` :** Pour télécharger les modèles Hugging Face légers.
    ```python
    #!/usr/bin/env python3
    from huggingface_hub import snapshot_download
    from sentence_transformers import SentenceTransformer
    import os

    dev_models = {
        "embedding": "sentence-transformers/all-MiniLM-L6-v2",  # Petit modèle d'embedding
    }
    print("Téléchargement des modèles de développement...")
    for model_type, model_name in dev_models.items():
        print(f"Téléchargement de {model_name}...")
        model_path = f"./models/{model_type}"
        os.makedirs(model_path, exist_ok=True)
        snapshot_download(repo_id=model_name, local_dir=model_path, local_dir_use_symlinks=False)
        try:
            # Charger pour vérification (SentenceTransformer est plus direct)
            _ = SentenceTransformer(model_path)
            print(f"✓ {model_name} téléchargé avec succès et vérifié.")
        except Exception as e:
            print(f"✗ Erreur lors de la vérification de {model_name}: {str(e)}")
    print("Tous les modèles de développement ont été téléchargés!")
    ```
    *   **Commande :** `python3 scripts/download-dev-models.py`
*   **`scripts/test-ai-dev.py` :** Pour tester les services IA.
    ```python
    #!/usr/bin/env python3
    import openai
    import os
    from dotenv import load_dotenv

    load_dotenv('.env.local') # Charger les variables d'environnement locales

    openai.api_key = os.getenv('OPENAI_API_KEY')

    def test_openai():
        try:
            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": "Bonjour, peux-tu me dire bonjour ?"}],
                max_tokens=50
            )
            print("✓ OpenAI fonctionne:", response.choices[0].message.content)
            return True
        except Exception as e:
            print("✗ OpenAI erreur:", str(e))
            return False

    def test_embeddings():
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer('all-MiniLM-L6-v2') # Utiliser le modèle léger téléchargé
            embeddings = model.encode("Test d'embedding")
            print("✓ Embeddings fonctionnent. Dimension:", embeddings.shape)
            return True
        except Exception as e:
            print("✗ Embeddings erreur:", str(e))
            return False

    if __name__ == "__main__":
        print("Lancement des tests de développement...")
        success = True
        success &= test_openai()
        success &= test_embeddings()
        if success:
            print("✓ Tous les tests AI/ML passent!")
        else:
            print("✗ Certains tests ont échoué")
    ```
    *   **Commande :** `npm run test:ai`

**4.8. Initialisation de la Base de Données :**
```bash
# Lancer les services Docker
docker-compose -f docker-compose.dev.yml up -d

# Exécuter les migrations Prisma et peupler la base de données (si script seed existe)
npm run db:reset
```

---

### **5. Authentification et Contrôle d'Accès (ACL)**

**5.1. NextAuth.js (App Router) :**
*   Implémenter NextAuth.js avec le `CredentialsProvider` et l'adaptateur Prisma.
*   **Fichier :** `apps/web/lib/auth.ts` (ou `auth.ts` dans un dossier approprié).
*   **Callbacks :** Assurez-vous que le rôle de l'utilisateur (`role`) est injecté dans le JWT et la session.

**5.2. Middleware d'ACL :**
*   **Fichier :** `apps/web/middleware.ts`
*   **Logique :** Restreindre l'accès aux routes d'administration (`/admin/*`) aux rôles `ADMIN`, `ASSISTANTE`, `COACH`.

```typescript
// Exemple apps/web/middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/admin")) {
      const allowedRoles = ["ADMIN", "ASSISTANTE", "COACH"]; // Rôles autorisés pour l'admin
      if (!token || !allowedRoles.includes(token.role as any)) {
        return NextResponse.redirect(new URL("/auth/signin", req.url)); // Rediriger si non autorisé
      }
    }
    // Plus de règles si nécessaire
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token, // Autorise si un token est présent
    },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/api/rag/:path*", "/api/context/:path*", "/api/bilan/generate-report-text"], // Protéger les routes admin et API ARIA
};
```

---

### **6. Système RAG Avancé : Ingestion et Indexation**

**6.1. Pipeline d'Ingestion (Service Modulaire : `server/rag/ingest.ts`) :**
Implémentez le pipeline d'ingestion étape par étape. Chaque étape sera une fonction ou une méthode de classe.

```typescript
// Fichier: apps/web/server/rag/ingest.ts

import path from "path";
import fs from "fs/promises";
import { prisma } from "@/app/lib/prisma";
import { extractTextFromFile } from "./ocr";
import { semanticChunk } from "./chunker";
import { embedTexts } from "../vector/embeddings";
import { UserDocument, JobStatus, DocStatus } from "@prisma/client";

// Chemin de stockage local pour les uploads
const STORAGE_ROOT = path.join(process.cwd(), "storage");

export async function runIngestion(docId: string): Promise<void> {
  let doc: UserDocument | null = null;
  let job = null;
  try {
    doc = await prisma.userDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new Error(`Document with ID ${docId} not found.`);

    job = await prisma.ingestJob.upsert({
      where: { docId: doc.id },
      update: { status: JobStatus.RUNNING, step: "démarrage", progress: 0, error: null },
      create: { docId: doc.id, status: JobStatus.RUNNING, step: "démarrage", progress: 0 }
    });
    
    // 1) Extraction de contenu (OCR si nécessaire)
    await prisma.userDocument.update({ where: { id: doc.id }, data: { status: DocStatus.OCR_DONE } });
    await prisma.ingestJob.update({ where: { id: job.id }, data: { step: "extraction", progress: 20 } });
    const localPath = path.join(STORAGE_ROOT, doc.storageKey);
    const text = await extractTextFromFile(localPath, doc.mime);
    if (!text) throw new Error("Aucun texte extrait du document.");

    // 2) Nettoyage et segmentation intelligente
    await prisma.userDocument.update({ where: { id: doc.id }, data: { status: DocStatus.CLEANED } });
    await prisma.ingestJob.update({ where: { id: job.id }, data: { step: "découpage", progress: 40 } });
    const chunks = semanticChunk(text, { targetTokens: 1000, overlap: 150 });
    if (!chunks.length) throw new Error("Aucun morceau de texte (chunk) généré.");
    await prisma.userDocument.update({ where: { id: doc.id }, data: { status: DocStatus.CHUNKED } });
    await prisma.ingestJob.update({ where: { id: job.id }, data: { step: "embeddings", progress: 60 } });

    // 3) Génération d'embeddings
    const embeddings = await embedTexts(chunks.map(c => c.text));
    if (embeddings.length !== chunks.length) throw new Error("Mismatch entre le nombre de chunks et d'embeddings.");

    // 4) Indexation (suppression des anciens et création des nouveaux)
    await prisma.userDocument.update({ where: { id: doc.id }, data: { status: DocStatus.INDEXED } });
    await prisma.ingestJob.update({ where: { id: job.id }, data: { step: "indexation", progress: 80 } });
    
    const assets = embeddings.map((emb, i) => ({
      docId: doc.id,
      subject: (doc.meta as any)?.subject ?? "general",
      level: (doc.meta as any)?.level ?? "all",
      source: (doc.meta as any)?.sourceType ?? "autre",
      chunk: chunks[i].text,
      tokens: chunks[i].tokens,
      embedding: emb as any, // Cast nécessaire pour le type Vector de Prisma
      meta: { ...chunks[i].meta, page: (chunks[i].meta as any)?.page || 0 }, // Assurer une page par défaut
    }));

    await prisma.$transaction([
      prisma.knowledgeAsset.deleteMany({ where: { docId: doc.id } }), // Supprimer les anciens assets
      prisma.knowledgeAsset.createMany({ data: assets }) // Créer les nouveaux
    ]);

    // 5) Mise à jour finale du statut
    await prisma.userDocument.update({ where: { id: doc.id }, data: { status: DocStatus.PUBLISHED } });
    await prisma.ingestJob.update({ where: { id: job.id }, data: { status: JobStatus.DONE, progress: 100, step: "terminé" } });
    logging.info(`Ingestion pipeline completed for document: ${doc.originalName} (${doc.id})`);

  } catch (error: any) {
    logging.error(`Ingestion failed for document ${docId}: ${error.message}`);
    if (doc) {
      await prisma.userDocument.update({ where: { id: doc.id }, data: { status: DocStatus.FAILED } });
    }
    if (job) {
      await prisma.ingestJob.update({ where: { id: job.id }, data: { status: JobStatus.FAILED, error: error.message, step: "échec" } });
    }
    throw error; // Rejeter l'erreur pour BullMQ ou le fallback
  } finally {
    // Nettoyer les fichiers temporaires de téléchargement si applicable
    // (Non nécessaire ici si 'storage' est le dossier persistant)
  }
}
```

**6.2. OCR & Parsing (`server/rag/ocr.ts`) :**
Implémentez l'extraction de texte avec Google Cloud Vision (en production) et un fallback local.

```typescript
// Fichier: apps/web/server/rag/ocr.ts

import fs from "fs/promises";
import pdf from "pdf-parse"; // Pour PDF textuels
// import vision from '@google-cloud/vision'; // Pour OCR GCP Vision (décommenter en prod)

const OCR_PROVIDER = process.env.OCR_PROVIDER || "tesseract"; // "gcp" ou "tesseract"

// Configuration Tesseract pour le fallback local
import * as Tesseract from 'node-tesseract-ocr'; // Utiliser node-tesseract-ocr pour Node.js

const tesseractConfig = {
  lang: "fra", // pack de langue française
  oem: 1,      // OCR Engine Mode - 1 pour mode LSTM uniquement (plus précis)
  psm: 3,      // Page Segmentation Mode - 3 pour analyse de mise en page automatique
};

// Si vous utilisez Google Cloud Vision
// const visionClient = new vision.ImageAnnotatorClient({
//   projectId: process.env.GOOGLE_PROJECT_ID,
//   credentials: {
//     client_email: process.env.GOOGLE_CLIENT_EMAIL,
//     private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Gérer les retours à la ligne
//   },
// });

export async function extractTextFromFile(localPath: string, mime: string): Promise<string> {
  try {
    // 1. PDF Textuel
    if (mime === "application/pdf") {
      const data = await fs.readFile(localPath);
      const res = await pdf(data);
      if (res.text && res.text.trim().length > 0) {
        return res.text; // PDF contient du texte extractible
      }
      // Sinon, tenter l'OCR pour les PDF scannés ou images dans PDF
      console.warn(`PDF '${localPath}' semble scanné ou vide de texte. Tentative d'OCR...`);
      return await performOcr(localPath, mime);
    }

    // 2. Images
    if (mime.startsWith('image/')) {
      console.log(`Traitement OCR pour image : '${localPath}'`);
      return await performOcr(localPath, mime);
    }

    // 3. Fichiers texte génériques (Python, TXT, DOCX - si UnstructuredLoader n'est pas utilisé)
    // Pour DOCX, etc., une librairie dédiée côté Node.js est nécessaire (ex: docx-extractor, ou un service Python)
    // Pour cet exemple, on lit comme du texte brut si pas PDF/Image
    return await fs.readFile(localPath, "utf8");

  } catch (error: any) {
    console.error(`Erreur lors de l'extraction de '${localPath}' (${mime}): ${error.message}`);
    throw new Error(`Échec de l'extraction de texte: ${error.message}`);
  }
}

async function performOcr(filePath: string, mimeType: string): Promise<string> {
  if (OCR_PROVIDER === "gcp" && process.env.GOOGLE_PROJECT_ID) {
    // --- Google Cloud Vision API (à décommenter et configurer pour la PROD) ---
    // try {
    //   const [result] = await visionClient.textDetection(filePath);
    //   const detections = result.textAnnotations;
    //   if (detections && detections.length > 0) {
    //     return detections[0].description || "";
    //   }
    //   return "";
    // } catch (gcpError: any) {
    //   console.warn(`OCR GCP Vision échoué pour '${filePath}', fallback sur Tesseract: ${gcpError.message}`);
    //   // Fallback sur Tesseract en cas d'échec GCP
    //   return await performTesseractOcr(filePath);
    // }
    console.warn("OCR GCP Vision est désactivé. Utilisation de Tesseract en fallback.");
    return await performTesseractOcr(filePath);
  } else {
    // --- Tesseract OCR Local ---
    return await performTesseractOcr(filePath);
  }
}

async function performTesseractOcr(filePath: string): Promise<string> {
  try {
    const text = await Tesseract.recognize(filePath, tesseractConfig);
    return text;
  } catch (tesseractError: any) {
    throw new Error(`OCR Tesseract échoué pour '${filePath}': ${tesseractError.message}`);
  }
}
```

**6.3. Chunking & Cleaning (`server/rag/chunker.ts`) :**
Le découpage sémantique du texte.

```typescript
// Fichier: apps/web/server/rag/chunker.ts

import { encode } from "gpt-tokenizer"; // Pour le calcul des tokens GPT

function cleanText(s: string): string {
  // Supprime les caractères de saut de page, normalise les espaces multiples, et supprime les sauts de ligne excessifs.
  // Préserve les blocs de code ou mathématiques si des marqueurs spécifiques sont présents.
  return s
    .replace(/\f|\r/g, " ") // Supprime les sauts de page et retours chariot
    .replace(/[\t ]+/g, " ") // Remplace les espaces/tabulations multiples par un seul espace
    .replace(/\n{3,}/g, "\n\n") // Réduit 3+ sauts de ligne consécutifs à 2
    .trim(); // Supprime les espaces en début/fin
}

export type Chunk = { text: string; tokens: number; meta: Record<string, any> };

export function semanticChunk(text: string, opts?: { targetTokens?: number; overlap?: number; }): Chunk[] {
  const target = opts?.targetTokens ?? 1000;
  const overlap = opts?.overlap ?? 150;
  const cleaned = cleanText(text);

  // Utilise gpt-tokenizer pour une segmentation basée sur les tokens
  const tokens = encode(cleaned);
  const chunks: Chunk[] = [];
  let currentTokenIndex = 0;

  while (currentTokenIndex < tokens.length) {
    const slice = tokens.slice(currentTokenIndex, Math.min(tokens.length, currentTokenIndex + target));
    const chunkTextContent = Buffer.from(Uint8Array.from(slice)).toString('utf8'); // Décoder les tokens en texte

    chunks.push({
      text: chunkTextContent,
      tokens: slice.length,
      meta: {
        from_token_index: currentTokenIndex,
        to_token_index: currentTokenIndex + slice.length -1,
        // Ajouter d'autres métadonnées si disponibles (ex: page, titre de section)
      }
    });

    // Avancer pour le prochain chunk, en gérant l'overlap
    currentTokenIndex += target - overlap;
  }
  return chunks;
}
```

**6.4. Vector & Embeddings (`server/vector/embeddings.ts`, `server/vector/search.ts`) :**
Pour la génération et la recherche d'embeddings.

```typescript
// Fichier: apps/web/server/vector/embeddings.ts
import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small"; // "text-embedding-3-large" (3072 dims) ou "text-embedding-3-small" (1536 dims)
const VECTOR_DIM = parseInt(process.env.VECTOR_DIM || "1536", 10); // Assurez-vous que cela correspond au modèle et au schéma Prisma

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) return [];
  if (!client.apiKey) throw new Error("OPENAI_API_KEY non configurée pour les embeddings.");

  try {
    const res = await client.embeddings.create({ model: MODEL, input: texts });
    // Assurez-vous que la dimension est correcte ou que le modèle gère la réduction des dimensions si demandé
    return res.data.map(d => d.embedding as unknown as number[]);
  } catch (error: any) {
    console.error("Erreur lors de la génération des embeddings OpenAI:", error);
    throw new Error(`Échec de la génération des embeddings: ${error.message}`);
  }
}
```

```typescript
// Fichier: apps/web/server/vector/search.ts
import { prisma } from "@/app/lib/prisma";

export async function semanticSearch(params: { queryEmbedding: number[]; studentId?: string; subject?: string; level?: string; k?: number; }): Promise<any[]> {
  const { queryEmbedding, studentId, subject, level, k = 6 } = params;

  // Construction dynamique de la clause WHERE
  let whereClauses: string[] = [];
  if (studentId) whereClauses.push(`"studentId" = '${studentId}'`); // Si vous avez une relation Asset->StudentId
  if (subject) whereClauses.push(`subject = '${subject}'`);
  if (level) whereClauses.push(`level = '${level}'`);

  const whereCondition = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Prisma raw query — pgvector cosine distance (<=>)
  // L'opérateur <#> donne la distance cosinus, pour la similarité on fait 1 - distance.
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, "docId", subject, level, source, chunk, meta,
            1 - (embedding <#> $1::vector) AS cosine
     FROM "KnowledgeAsset"
     ${whereCondition}
     ORDER BY embedding <#> $1::vector ASC
     LIMIT $2`,
    queryEmbedding, k
  );
  return rows;
}
```

**6.5. Queue des jobs (BullMQ) et Fallback In-Process (`lib/queue.ts`, `server/rag/worker.ts`) :**
Pour gérer les tâches d'ingestion de manière asynchrone en production et synchrone en développement.

```typescript
// Fichier: apps/web/lib/queue.ts
import { Queue, Worker, JobsOptions } from "bullmq";
import IORedis from "ioredis";
import logger from "./logger"; // Exemple de logger, à créer si besoin

const connection = process.env.REDIS_URL ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null }) : undefined;

export const ingestQueue = connection ? new Queue("ingest", { connection }) : undefined;

export function registerIngestWorker(processor: (docId: string) => Promise<void>) {
  if (!connection) {
    logger.warn("Redis URL non configurée. Le worker BullMQ est désactivé. Les jobs seront traités en ligne.");
    return; // Pas de worker si pas de Redis (mode inline)
  }
  new Worker("ingest", async job => {
    logger.info(`Processing ingest job ${job.id} for docId: ${job.data.docId}`);
    try {
      await processor(job.data.docId);
      logger.info(`Ingest job ${job.id} completed for docId: ${job.data.docId}`);
    } catch (error: any) {
      logger.error(`Ingest job ${job.id} failed for docId: ${job.data.docId}: ${error.message}`, error);
      throw error; // Rejeter l'erreur pour que BullMQ gère les tentatives ou le statut FAILED
    }
  }, { connection, concurrency: 5 }); // Gérer 5 jobs en parallèle
  logger.info("BullMQ Ingest Worker enregistré.");
}
```

```typescript
// Fichier: apps/web/server/rag/worker.ts (à importer au démarrage du serveur)
import { registerIngestWorker } from "@/app/lib/queue";
import { runIngestion } from "./ingest";
import logger from "@/app/lib/logger"; // Votre logger

if (process.env.NODE_ENV === "production" || process.env.WORKER_ENABLED === "true") {
  registerIngestWorker(runIngestion);
  logger.info("ARIA RAG Worker démarré en mode production/séparé.");
} else {
  logger.info("ARIA RAG Worker en mode développement/inline (pas de BullMQ).");
}
```
*   **Intégration du Worker :** En mode développement, vous pouvez importer `server/rag/worker.ts` dans `app/layout.tsx` (côté serveur) pour qu'il s'initialise. En production, le worker devrait être lancé comme un processus Node.js séparé (ex: `node apps/web/server/rag/worker.js` ou via un `npm run worker` qui exécute `tsx server/rag/worker.ts`).

**6.6. Stockage Local des Uploads (`lib/storage.ts`) :**
Pour gérer le stockage des documents.

```typescript
// Fichier: apps/web/lib/storage.ts
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from 'uuid'; // Pour générer des noms de fichiers uniques

const STORAGE_ROOT_DIR = path.join(process.cwd(), "storage"); // Dossier 'storage' à la racine du projet

export async function saveUpload(file: File, userId: string): Promise<string> {
  const uniqueFileName = `${uuidv4()}-${file.name}`;
  const userDir = path.join(STORAGE_ROOT_DIR, userId); // Créer un sous-dossier par utilisateur
  const destPath = path.join(userDir, uniqueFileName);

  await fs.mkdir(userDir, { recursive: true }); // Assure que le dossier utilisateur existe

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(destPath, buffer);

  // Retourne la clé de stockage relative au STORAGE_ROOT_DIR (ex: "user-id/unique-file-name.pdf")
  return path.join(userId, uniqueFileName);
}

export async function getLocalFilePath(storageKey: string): Promise<string> {
  return path.join(STORAGE_ROOT_DIR, storageKey);
}
```

---

### **7. Système de Mémoire et Contexte ARIA**

**7.1. Contexte Builder (`server/context/builder.ts`) :**
Construit un contexte riche pour chaque interaction avec ARIA.

```typescript
// Fichier: apps/web/server/context/builder.ts

import { prisma } from "@/app/lib/prisma";
import { embedTexts } from "@/app/server/vector/embeddings";
import { semanticSearch } from "@/app/server/vector/search";
import { ChatMessage, Memory, Dashboard, StudentSession, QuizResult } from "@prisma/client";

export type BuiltContext = {
  recentMessages: Pick<ChatMessage, "role" | "content" | "ts">[];
  episodicMemories: Pick<Memory, "content" | "createdAt">[];
  semanticMemories: Array<{ chunk: string; source: string; score: number; meta: any }>;
  planMemory?: Pick<Memory, "content" | "createdAt">;
  dashboardSummary?: { kpis: any; latestQuiz: any; lastSession: any };
};

export async function buildContext(studentId: string, currentQuery: string, subject?: string, level?: string): Promise<BuiltContext> {
  // Récupérer l'historique récent des messages
  const recentMessages = await prisma.chatMessage.findMany({
    where: { studentId },
    orderBy: { ts: "desc" },
    take: 30,
    select: { role: true, content: true, ts: true },
  });

  // Récupérer les mémoires épisodiques (résumés de sessions/conversations passées)
  const episodicMemories = await prisma.memory.findMany({
    where: { studentId, kind: "EPISODIC" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { content: true, createdAt: true },
  });

  // Récupérer le plan de progression actif de l'élève
  const planMemory = await prisma.memory.findFirst({
    where: { studentId, kind: "PLAN" },
    orderBy: { createdAt: "desc" },
    select: { content: true, createdAt: true },
  });

  // Récupérer les données du tableau de bord de l'élève
  const dashboard = await prisma.dashboard.findUnique({
    where: { studentId },
    include: {
      quiz: { orderBy: { date: "desc" }, take: 1 },
      sessions: { orderBy: { date: "desc" }, take: 1 },
    },
  });

  let dashboardSummary: BuiltContext['dashboardSummary'] | undefined;
  if (dashboard) {
    dashboardSummary = {
      kpis: dashboard.kpis,
      latestQuiz: dashboard.quiz.length ? { score: dashboard.quiz[0].score, subject: dashboard.quiz[0].subject, date: dashboard.quiz[0].date } : null,
      lastSession: dashboard.sessions.length ? { type: dashboard.sessions[0].type, date: dashboard.sessions[0].date } : null,
    };
  }

  // Effectuer une recherche sémantique dans la base de connaissances RAG
  // Basé sur la requête actuelle de l'élève
  const [queryEmbedding] = await embedTexts([currentQuery]);
  const semanticMemories = await semanticSearch({
    queryEmbedding: queryEmbedding,
    studentId, // Si KnowledgeAsset peut être lié à un étudiant
    subject,
    level,
    k: 6,
  });

  return {
    recentMessages: recentMessages.reverse(), // Du plus ancien au plus récent pour le contexte
    episodicMemories,
    semanticMemories,
    planMemory,
    dashboardSummary,
  };
}
```

**7.2. API du Contexte Builder (`app/api/context/build/route.ts`) :**
Cet endpoint sera utilisé par l'interface de chat ARIA pour récupérer le contexte.

```typescript
// Fichier: apps/web/app/api/context/build/route.ts
import { NextRequest, NextResponse } from "next/server";
import { buildContext } from "@/app/server/context/builder";
// import { getServerSession } from "next-auth"; // Pour récupérer l'ID étudiant de la session
// import { authOptions } from "@/app/lib/auth"; // Chemin vers votre configuration NextAuth

export async function GET(req: NextRequest) {
  // const session = await getServerSession(authOptions as any);
  // if (!session || !session.user || !session.user.studentId) {
  //   return NextResponse.json({ error: "Unauthorized or student ID missing" }, { status: 401 });
  // }
  // const studentId = session.user.studentId;

  // Pour le développement, utilisez un studentId depuis les params ou un ID de test
  const studentId = req.nextUrl.searchParams.get("studentId") || "test-student-id";
  if (!studentId) return NextResponse.json({ error: "studentId is required" }, { status: 400 });


  const subject = req.nextUrl.searchParams.get("subject") || undefined;
  const level = req.nextUrl.searchParams.get("level") || undefined;
  const currentQuery = req.nextUrl.searchParams.get("query") || "Récapitulatif"; // Requête actuelle de l'élève

  try {
    const ctx = await buildContext(studentId, currentQuery, subject, level);
    return NextResponse.json(ctx);
  } catch (error: any) {
    console.error("Erreur lors de la construction du contexte:", error);
    return NextResponse.json({ error: error.message || "Failed to build context" }, { status: 500 });
  }
}
```

---

### **8. Génération de Documents Pédagogiques (LaTeX → PDF)**

**8.1. Pipeline de Génération (`server/generation/generator.ts`) :**
Implémentez le pipeline complet de génération avec planification, rédaction, révision, formatage LaTeX, compilation avec auto-correction, et enregistrement.

```typescript
// Fichier: apps/web/server/generation/generator.ts

import OpenAI from "openai";
import { prisma } from "@/app/lib/prisma";
import { buildContext, BuiltContext } from "@/app/server/context/builder";
import { semanticSearch } from "@/app/server/vector/search";
import { GeneratedDocument } from "@prisma/client";
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const execAsync = promisify(exec);

// Modèle pour la génération de contenu
const LLM_MODEL_GEN = process.env.OPENAI_MODEL_GEN || "gpt-4o-mini"; // GPT-4 pour la qualité en prod

export type GenerationRequest = {
  studentId: string;
  type: string;    // "cours", "resume", "exercice", "sujet_blanc"
  subject: string;
  level: string;
  goal: string;    // Objectif de l'élève
  length?: string; // "court", "moyen", "long"
  withCorrections?: boolean;
};

// Gabarit LaTeX de base (simplifié pour l'exemple)
const BASE_LATEX_TEMPLATE = (title: string, content: string) => `
\\documentclass[11pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[french]{babel}
\\usepackage{amsmath, amssymb, amsthm}
\\usepackage{graphicx}
\\usepackage{listings}
\\usepackage{geometry}
\\geometry{a4paper, margin=2cm}

\\title{${title}}
\\author{Nexus Réussite}
\\date{\\today}

\\begin{document}
\\maketitle

${content}

\\end{document}
`;

class DocumentGenerator {
  async generateDocument(request: GenerationRequest): Promise<GeneratedDocument> {
    const studentContext = await buildContext(request.studentId, request.goal, request.subject, request.level);

    // 1. Planification avec LLM
    const outline = await this.planDocument(request, studentContext);
    
    // 2. Rédaction section par section
    const draft = await this.draftDocument(request, outline, studentContext);
    
    // 3. Révision et correction
    const reviewed = await this.reviewDocument(draft, studentContext);
    
    // 4. Formatage LaTeX (assemblage du gabarit et du contenu)
    const latexContent = await this.formatLatex(reviewed, request);
    
    // 5. Compilation avec auto-correction
    const pdfBuffer = await this.compileLatexWithAutoFix(latexContent);
    
    // 6. Enregistrement (stockage et référence DB)
    return await this.storeDocument(pdfBuffer, request);
  }

  private async planDocument(request: GenerationRequest, context: BuiltContext): Promise<any> {
    const prompt = `
    Tu es un planificateur pédagogique de Nexus Réussite.
    Contexte élève : ${JSON.stringify(context.dashboardSummary || context.recentMessages.slice(-5))}
    Objectif de l'élève : ${request.goal}
    Type de document demandé : ${request.type}
    Matière : ${request.subject} - Niveau : ${request.level}
    Contraintes : longueur ${request.length || 'moyen'}, inclure corrections ${request.withCorrections ? 'oui' : 'non'}.
    Sources RAG pertinentes : ${context.semanticMemories.map(m => m.chunk).join('\n---\n')}

    Tâche : Propose un PLAN détaillé en sections et sous-sections. Pour chaque section, indique le contenu, les concepts clés, et si des exemples/exercices sont nécessaires (avec niveau de difficulté).
    Réponds en JSON : { "title": "...", "outline": [{ "sectionTitle": "...", "concepts": ["..."], "examples_needed": true, "exercises_needed": true, "difficulty": "standard" }], "prerequisites": ["...", "..."], "objectives": ["..."] }.
    `;
    const response = await openaiClient.chat.completions.create({
      model: LLM_MODEL_GEN, messages: [{ role: "user", content: prompt }], temperature: 0.7, response_format: { type: "json_object" }
    });
    return JSON.parse(response.choices[0].message.content || '{}');
  }

  private async draftDocument(request: GenerationRequest, outline: any, context: BuiltContext): Promise<string> {
    // LLM pour rédiger le brouillon section par section
    const prompt = `
    Tu es un rédacteur pédagogique expert de Nexus Réussite.
    Plan validé : ${JSON.stringify(outline)}
    Contexte élève : ${JSON.stringify(context.dashboardSummary || context.recentMessages.slice(-5))}
    Ressources RAG : ${context.semanticMemories.map(m => m.chunk).join('\n---\n')}
    Matière : ${request.subject} - Niveau : ${request.level}
    Objectif : Rédige le contenu détaillé du document en respectant le plan. Utilise un ton clair, rigoureux, et adapté aux programmes français.
    Si Maths : utilise des formules LaTeX inline ($...$) et block (\[...\]). Si NSI : formate le code Python avec des blocs (environnement listings).
    Réponds uniquement le contenu brut du document, sans en-tête ni fioritures, juste le texte pour le LaTeX.
    `;
    const response = await openaiClient.chat.completions.create({
      model: LLM_MODEL_GEN, messages: [{ role: "user", content: prompt }], temperature: 0.8
    });
    return response.choices[0].message.content || '';
  }

  private async reviewDocument(draft: string, context: BuiltContext): Promise<string> {
    // LLM pour réviser et corriger le brouillon
    const prompt = `
    Tu es un relecteur qualité de Nexus Réussite.
    Relis le brouillon LaTeX ci-dessous :
    ---
    ${draft}
    ---
    Vérifie la conformité au programme, l'exactitude des informations, la cohérence des notations, la progression pédagogique, l'orthographe et la grammaire.
    Renvoie la version corrigée et améliorée du contenu LaTeX (intégral).
    `;
    const response = await openaiClient.chat.completions.create({
      model: LLM_MODEL_GEN, messages: [{ role: "user", content: prompt }], temperature: 0.5
    });
    return response.choices[0].message.content || '';
  }

  private async formatLatex(content: string, request: GenerationRequest): Promise<string> {
    // Assemblage du contenu avec un gabarit LaTeX prédéfini
    const title = `Cours de ${request.subject} - ${request.level} : ${request.goal}`;
    // Ici, vous pouvez enrichir le template avec plus de packages LaTeX, macros, etc.
    return BASE_LATEX_TEMPLATE(title, content);
  }

  private async compileLatexWithAutoFix(latexContent: string, maxTries = 3): Promise<Buffer> {
    const tempDir = path.join(process.cwd(), 'temp_latex', uuidv4());
    await fs.mkdir(tempDir, { recursive: true });
    const texFilePath = path.join(tempDir, 'document.tex');
    const pdfFilePath = path.join(tempDir, 'document.pdf');

    await fs.writeFile(texFilePath, latexContent);

    for (let i = 1; i <= maxTries; i++) {
      try {
        // latexmk compile en une seule passe pour gérer les dépendances (index, table des matières)
        const { stdout, stderr } = await execAsync(`latexmk -xelatex -interaction=nonstopmode -output-directory=${tempDir} ${texFilePath}`);
        console.log(`Latexmk try ${i} stdout:`, stdout);
        console.error(`Latexmk try ${i} stderr:`, stderr);

        if (fs.existsSync(pdfFilePath)) {
          const pdfBuffer = await fs.readFile(pdfFilePath);
          await fs.rm(tempDir, { recursive: true, force: true }); // Nettoyer le répertoire temporaire
          return pdfBuffer;
        }
      } catch (compileError: any) {
        console.error(`Latexmk compile error (try ${i}):`, compileError.message);
        // Tenter une auto-correction avec LLM ou heuristiques
        const fixPrompt = `
        Le compilateur LaTeX a échoué avec l'erreur suivante (log partiel) :
        ---
        ${compileError.message.slice(0, 1000)}
        ---
        Contexte LaTeX :
        ---
        ${latexContent.slice(0, 1000)}
        ---
        Suggère un patch LaTeX minimal pour corriger la partie pertinente du code. Réponds uniquement le contenu corrigé.
        `;
        const fixResponse = await openaiClient.chat.completions.create({
          model: LLM_MODEL_GEN, messages: [{ role: "user", content: fixPrompt }], temperature: 0.1
        });
        latexContent = fixResponse.choices[0].message.content || latexContent;
        await fs.writeFile(texFilePath, latexContent); // Écrire le LaTeX corrigé
      }
    }
    await fs.rm(tempDir, { recursive: true, force: true });
    throw new Error("Échec de la compilation LaTeX après plusieurs tentatives d'auto-correction.");
  }

  private async storeDocument(pdfBuffer: Buffer, request: GenerationRequest): Promise<GeneratedDocument> {
    const storageKey = `generated_docs/${uuidv4()}.pdf`;
    const destPath = path.join(STORAGE_ROOT, storageKey);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, pdfBuffer);

    return await prisma.generatedDocument.create({
      data: {
        studentId: request.studentId,
        title: `Rapport de ${request.type} sur ${request.subject}`,
        description: request.goal,
        type: request.type,
        subject: request.subject,
        level: request.level,
        pdfStorageKey: storageKey,
        status: "COMPLETED",
        // Ajoutez ici les autres champs si nécessaire
      },
    });
  }
}
```

**8.2. API de Génération de Documents (`app/api/aria/generate-document/route.ts`) :**
Endpoint pour déclencher la génération d'un document.

```typescript
// Fichier: apps/web/app/api/aria/generate-document/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DocumentGenerator, GenerationRequest } from "@/app/server/generation/generator";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/app/lib/auth";

export async function POST(req: NextRequest) {
  // const session = await getServerSession(authOptions as any);
  // if (!session || !session.user || !session.user.studentId) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }
  // const studentId = session.user.studentId;

  const { studentId, type, subject, level, goal, length, withCorrections }: GenerationRequest = await req.json();

  if (!studentId || !type || !subject || !level || !goal) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    const generator = new DocumentGenerator();
    const generatedDoc = await generator.generateDocument({ studentId, type, subject, level, goal, length, withCorrections });
    return NextResponse.json(generatedDoc);
  } catch (error: any) {
    console.error("Erreur lors de la génération du document:", error);
    return NextResponse.json({ error: error.message || "Failed to generate document" }, { status: 500 });
  }
}
```

---

### **9. Interfaces Utilisateur (UI)**

**9.1. RAG Admin UI (`app/(dashboard)/admin/rag/page.tsx`) :**
Interface complète pour l'upload, le suivi des jobs et la visualisation des documents indexés.

```tsx
// Fichier: apps/web/app/(dashboard)/admin/rag/page.tsx (Comme précédemment, mais mise à jour si nécessaire)

"use client";
import * as React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Book, FileText, CheckCircle, XCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns"; // Installer date-fns

// Composant pour l'upload de documents
function Uploader() {
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState("maths");
  const [level, setLevel] = useState("Terminale");
  const [sourceType, setSourceType] = useState("cours");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setStatus("Veuillez sélectionner un fichier."); return; }
    setLoading(true);
    setStatus("Envoi et démarrage de l'indexation...");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("subject", subject);
    fd.append("level", level);
    fd.append("sourceType", sourceType);
    // TODO: Passer l'userId du staff qui upload
    fd.append("userId", "admin-user-id"); // Exemple, à remplacer par l'ID de l'utilisateur connecté

    const res = await fetch("/api/rag/upload", { method: "POST", body: fd });
    const j = await res.json();
    setLoading(false);
    setStatus(j.ok ? "Upload OK, indexation lancée avec succès." : `Erreur: ${j.error}`);
    setFile(null); // Réinitialiser le champ fichier
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-6 border rounded-xl shadow-sm bg-white">
      <h2 className="font-semibold text-xl text-slate-800 flex items-center gap-2"><Upload className="h-5 w-5 text-blue-600"/> Uploader un document (RAG)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="file">Fichier</Label>
          <Input id="file" type="file" onChange={e => setFile(e.target.files?.[0] || null)} required disabled={loading}/>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">Matière</Label>
          <Select value={subject} onValueChange={setSubject} disabled={loading}>
            <SelectTrigger><SelectValue placeholder="Sélectionner une matière" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="maths">Mathématiques</SelectItem>
              <SelectItem value="nsi">NSI</SelectItem>
              <SelectItem value="physique">Physique</SelectItem>
              <SelectItem value="francais">Français</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="level">Niveau</Label>
          <Select value={level} onValueChange={setLevel} disabled={loading}>
            <SelectTrigger><SelectValue placeholder="Sélectionner un niveau" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="premiere">Première</SelectItem>
              <SelectItem value="terminale">Terminale</SelectItem>
              <SelectItem value="seconde">Seconde</SelectItem>
              <SelectItem value="college">Collège</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sourceType">Type de source</Label>
          <Select value={sourceType} onValueChange={setSourceType} disabled={loading}>
            <SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cours">Cours</SelectItem>
              <SelectItem value="exercice">Exercice</SelectItem>
              <SelectItem value="annale">Annale</SelectItem>
              <SelectItem value="manuel">Manuel</SelectItem>
              <SelectItem value="fiche">Fiche Méthode</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4"/>}
        Indexer le document
      </Button>
      {status && <div className="text-sm text-gray-500 mt-2">{status}</div>}
    </form>
  );
}

// Composant pour l'affichage des jobs d'ingestion
function JobsTable() {
  const [jobs, setJobs] = useState<any[]>([]);
  useEffect(() => {
    const fetchJobs = async () => {
      const res = await fetch("/api/rag/jobs").then(r => r.json());
      setJobs(res.jobs || []);
    };
    fetchJobs(); // Fetch initial
    const id = setInterval(fetchJobs, 3000); // Polling toutes les 3 secondes
    return () => clearInterval(id); // Nettoyage de l'intervalle
  }, []);

  return (
    <div className="p-6 border rounded-xl shadow-sm bg-white">
      <h2 className="font-semibold text-xl text-slate-800 mb-4 flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin text-amber-500"/> Jobs d'indexation</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-700">
          <thead className="text-xs text-slate-900 uppercase bg-slate-50">
            <tr>
              <th scope="col" className="px-3 py-2">ID Job</th>
              <th scope="col" className="px-3 py-2">Document</th>
              <th scope="col" className="px-3 py-2">Statut</th>
              <th scope="col" className="px-3 py-2">Étape</th>
              <th scope="col" className="px-3 py-2">Progression</th>
              <th scope="col" className="px-3 py-2">Créé il y a</th>
              <th scope="col" className="px-3 py-2">Erreur</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j: any) => (
              <tr key={j.id} className="bg-white border-b hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">{j.id.substring(0, 8)}...</td>
                <td className="px-3 py-2">{j.docId?.substring(0, 8)}...</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    j.status === "DONE" ? "bg-green-100 text-green-800" :
                    j.status === "FAILED" ? "bg-red-100 text-red-800" :
                    "bg-amber-100 text-amber-800"
                  }`}>
                    {j.status}
                  </span>
                </td>
                <td className="px-3 py-2">{j.step}</td>
                <td className="px-3 py-2">{j.progress}%</td>
                <td className="px-3 py-2">{formatDistanceToNow(new Date(j.createdAt), { addSuffix: true, locale: require('date-fns/locale/fr') })}</td>
                <td className="px-3 py-2 text-red-500 text-xs max-w-[150px] truncate" title={j.error}>{j.error || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Composant pour l'affichage des documents ingérés
function DocsTable() {
  const [docs, setDocs] = useState<any[]>([]);
  useEffect(() => {
    const fetchDocs = async () => {
      const res = await fetch("/api/rag/docs").then(r => r.json());
      setDocs(res.docs || []);
    };
    fetchDocs();
    const id = setInterval(fetchDocs, 5000); // Polling toutes les 5 secondes
    return () => clearInterval(id);
  }, []);

  return (
    <div className="p-6 border rounded-xl shadow-sm bg-white">
      <h2 className="font-semibold text-xl text-slate-800 mb-4 flex items-center gap-2"><Book className="h-5 w-5 text-green-600"/> Documents ingérés</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-700">
          <thead className="text-xs text-slate-900 uppercase bg-slate-50">
            <tr>
              <th scope="col" className="px-3 py-2">ID Doc</th>
              <th scope="col" className="px-3 py-2">Nom original</th>
              <th scope="col" className="px-3 py-2">Statut</th>
              <th scope="col" className="px-3 py-2">Matière</th>
              <th scope="col" className="px-3 py-2">Niveau</th>
              <th scope="col" className="px-3 py-2">Chunks</th>
              <th scope="col" className="px-3 py-2">Créé il y a</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d: any) => (
              <tr key={d.id} className="bg-white border-b hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">{d.id.substring(0, 8)}...</td>
                <td className="px-3 py-2">{d.originalName}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    d.status === "PUBLISHED" ? "bg-green-100 text-green-800" :
                    d.status === "FAILED" ? "bg-red-100 text-red-800" :
                    "bg-amber-100 text-amber-800"
                  }`}>
                    {d.status}
                  </span>
                </td>
                <td className="px-3 py-2">{d.meta?.subject || '—'}</td>
                <td className="px-3 py-2">{d.meta?.level || '—'}</td>
                <td className="px-3 py-2">{d.assetsCount || 0}</td>
                <td className="px-3 py-2">{formatDistanceToNow(new Date(d.createdAt), { addSuffix: true, locale: require('date-fns/locale/fr') })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export default function RagAdminPage() {
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 bg-slate-50 min-h-screen">
      <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
        <FileText className="h-7 w-7 text-blue-600"/> Administration RAG Nexus
      </h1>
      <Uploader />
      <Separator />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <JobsTable />
        <DocsTable />
      </div>
    </div>
  );
}
```

**9.2. ARIA Chat UI :**
Interface conversationnelle intuitive pour l'élève. Utilise le Context Builder.

*   **Fichier :** `apps/web/app/(dashboard)/eleve/chat/page.tsx` (Exemple minimal)
```tsx
"use client";
import React, { useState, useEffect } from 'react';
import { BuiltContext } from "@/app/server/context/builder";
import { Send, Loader2 } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string; ts: Date };

export default function AriaChatPage() {
  const studentId = "seed-student-id"; // TODO: Remplacer par l'ID de l'étudiant connecté
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Charger le contexte initial
  useEffect(() => {
    const loadInitialContext = async () => {
      // Un appel initial pour récupérer le contexte de base
      // L'appel réel sera intégré à la requête de chat pour un contexte dynamique
      const res = await fetch(`/api/context/build?studentId=${studentId}&query=salut`);
      const ctx: BuiltContext = await res.json();
      console.log("Contexte initial chargé:", ctx);
      setMessages([{ role: "assistant", content: "Bonjour ! Je suis ARIA, votre assistant pédagogique. Comment puis-je vous aider aujourd'hui ?", ts: new Date() }]);
    };
    loadInitialContext();
  }, [studentId]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input, ts: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Récupérer le contexte dynamique pour la requête actuelle
      const contextRes = await fetch(`/api/context/build?studentId=${studentId}&query=${encodeURIComponent(userMessage.content)}`);
      const context: BuiltContext = await contextRes.json();

      // Appel à l'API de chat (à implémenter)
      const chatRes = await fetch("/api/aria/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, message: userMessage.content, context }),
      });
      const data = await chatRes.json();

      setMessages(prev => [...prev, { role: "assistant", content: data.reply, ts: new Date() }]);
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
      setMessages(prev => [...prev, { role: "assistant", content: "Désolé, une erreur est survenue.", ts: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      <h1 className="text-2xl font-bold text-center py-4 text-slate-800">Chat avec ARIA</h1>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] p-3 rounded-lg shadow-sm ${
              msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-slate-800 border border-slate-200'
            }`}>
              <p>{msg.content}</p>
              <span className="block text-xs mt-1 opacity-70">
                {msg.ts.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[70%] p-3 rounded-lg shadow-sm bg-white text-slate-800 border border-slate-200">
              <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> ARIA réfléchit...
            </div>
          </div>
        )}
      </div>
      <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-2">
        <Input
          placeholder="Écrivez votre message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          disabled={loading}
          className="flex-1 p-2 border rounded-lg"
        />
        <Button onClick={sendMessage} disabled={loading} className="px-4 py-2">
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
```

---

### **10. Sécurité et Conformité (RGPD)**

**10.1. Mesures de Sécurité :**
*   **Authentification :** NextAuth.js avec JWT et potentiellement refresh tokens.
*   **Autorisation (RBAC) :** Contrôle d'accès granulaire basé sur les rôles (`UserRole` dans Prisma) via le middleware NextAuth et vérifications côté API.
*   **Chiffrement :** TLS 1.3 pour toutes les communications, chiffrement au repos pour les données sensibles (ex: bases de données).
*   **Secrets :** Utilisation sécurisée des variables d'environnement (`.env` pour dev, secrets Kubernetes/VPS pour prod).
*   **Audit et Logging :** Logs détaillés des accès, modifications et exécutions IA pour la traçabilité.

**10.2. Conformité RGPD :**
*   **Minimisation des Données :** Ne collecter et ne stocker que les données strictement nécessaires.
*   **Droit à l'Oubli :** Mettre en place des procédures pour la suppression complète des données utilisateur sur demande.
*   **Consentement :** Gérer les préférences de consentement (cookies, utilisation des données).
*   **Accès et Portabilité :** Permettre aux utilisateurs d'accéder à leurs données et de les exporter.
*   **Pseudonymisation :** Si possible, pseudonymiser les données pour l'analyse.

---

### **11. Tests et Qualité**

**11.1. Stratégie de Test :**
*   **Tests Unitaires :** Couverture > 90% pour la logique métier des services (chunker, embeddings, extracteurs de texte, constructeur de contexte). Utiliser Jest.
*   **Tests d'Intégration :** Validation des interactions entre les services modulaires (ex: upload vers ingestion, contexte vers chat API).
*   **Tests E2E (Playwright) :** Scénarios utilisateurs complets (ex: upload document, chat avec ARIA, génération de document PDF, vérification des ACL).
*   **Tests de Performance :** (Phase ultérieure) Mesure de la latence des réponses IA, temps d'ingestion.

**11.2. Monitoring et Alerting :**
*   **Métriques :** Collecte de métriques clés (utilisation CPU/RAM, temps de réponse API, erreurs, utilisation OpenAI API, progression des jobs BullMQ).
*   **Logs :** Centralisation et structuration des logs pour faciliter le débogage et l'audit.
*   **Alerting :** Configuration d'alertes pour les anomalies (erreurs critiques, dépassement de seuils d'utilisation OpenAI, échecs d'ingestion/génération).

---

### **12. Déploiement en Production sur VPS Hostinger**

**Contexte VPS :** Ubuntu 22.04 LTS, 8 CPUs, 32GB RAM, 400GB SSD, Nginx comme reverse proxy, Docker et Docker Compose déjà installés. `mfai.app` tourne sur le port 3000. Nexus Réussite actuel sur 3001.

**12.1. Préparation du Serveur VPS :**
*   **Mise à jour :** `apt update && apt upgrade -y`
*   **Installation des dépendances :** `apt install -y curl wget git build-essential libssl-dev libffi-dev python3-dev python3-pip python3-venv nginx certbot python3-certbot-nginx`
*   **Vérification Docker/Docker Compose :** S'assurer que Docker et Docker Compose sont à jour.

**12.2. Configuration de l'Environnement de Production sur VPS (`/opt/aria/`) :**
*   **Structure de répertoires :** `mkdir -p /opt/aria/{data,models,logs,config,storage}`
*   **Clonage du dépôt :** `git clone https://github.com/cyranoaladin/nexus-project_v0.git /opt/aria/`
*   **Fichier `.env` :** Créer `/opt/aria/.env` avec les variables de production (clés API réelles, secrets sécurisés). **Ne pas versionner ce fichier sur GitHub.**

    ```env
    # OpenAI (CLÉS DE PRODUCTION)
    OPENAI_API_KEY="sk-VOTRE-CLE-OPENAI-PROD"
    OPENAI_MODEL="gpt-4" # Modèle de haute qualité pour la production
    EMBEDDING_MODEL="text-embedding-3-large" # 3072 dimensions pour la meilleure qualité
    VECTOR_DIM=3072 # Aligner avec EMBEDDING_MODEL
    OPENAI_MODEL_GEN="gpt-4o" # Ou un autre GPT-4 pour la génération de documents

    # Hugging Face (Optionnel en prod si modèles locaux lourds)
HUGGINGFACE_HUB_TOKEN="YOUR_HF_TOKEN"

    # GCP Vision (CLÉS DE PRODUCTION pour OCR)
    OCR_PROVIDER=gcp
    GOOGLE_PROJECT_ID="votre-project-id-prod"
    GOOGLE_CLIENT_EMAIL="votre-service-account-email-prod"
    GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n..." # Clé privée de GCP service account

    # Base de données PostgreSQL (Dockerisée sur le VPS)
    POSTGRES_DB="aria_prod_db"
    POSTGRES_USER="aria_prod_user"
    POSTGRES_PASSWORD="VOTRE_MDP_SUPER_SECURISE_PROD"
    POSTGRES_HOST="postgres" # Nom du service Docker dans docker-compose
    POSTGRES_PORT=5432
    DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public"

    # Redis (Dockerisée sur le VPS)
    REDIS_URL="redis://redis:6379" # Nom du service Docker dans docker-compose

    # Configuration de l'application
    NODE_ENV=production
    PORT=3000 # Port interne au conteneur Next.js
    CLIENT_URL="https://nexusreussite.academy"
    API_URL="${CLIENT_URL}/api" # L'API du frontend

    # Sécurité (CLÉS DE PRODUCTION)
    NEXTAUTH_SECRET="UN_TRES_LONG_SECRET_ALEATOIRE_ET_COMPLEXE_POUR_NEXTAUTH_PROD"
    JWT_SECRET="UN_AUTRE_SECRET_TRES_LONG_ET_COMPLEXE_POUR_JWT_PROD"
    CRYPTO_SECRET="UN_DERNIER_SECRET_COMPLEXE_POUR_CRYPTO_PROD"

    # SMTP (pour l'envoi d'emails via Nexus Réussite)
    SMTP_HOST="smtp.hostinger.com"
    SMTP_PORT="465"
    SMTP_USER="contact@nexusreussite.academy"
    SMTP_PASSWORD="NexusReussite2025@NSI"
    EMAIL_FROM="Nexus Réussite <contact@nexusreussite.academy>"

    # Activer le worker BullMQ séparé en production
    WORKER_ENABLED="true"
    ```

**12.3. Installation des Composants Python et Téléchargement des Modèles :**
*   **Environnement virtuel Python :** `python3 -m venv /opt/aria/venv && source /opt/aria/venv/bin/activate`
*   **Installation des dépendances :** `pip install --upgrade pip && pip install -r /opt/aria/requirements-dev.txt` (ou un `requirements.txt` de prod plus léger).
*   **Téléchargement des modèles (Hugging Face) :** `python3 /opt/aria/scripts/download-dev-models.py` (à adapter pour les modèles de production)
    *   **Attention :** Le `download-dev-models.py` devra être adapté pour télécharger les modèles de production (ex: `text-embedding-3-large`, ou d'autres modèles si nécessaires pour `summarization`, `classification`, etc.). Il faut s'assurer que ces modèles soient stockés dans `/opt/aria/models`.

**12.4. Fichier `docker-compose.yml` (pour la Production sur VPS) :**
Créez ce fichier dans `/opt/aria/docker-compose.yml`.

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: aria_postgres_prod
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data_prod:/var/lib/postgresql/data
    networks:
      - aria_network_prod
    healthcheck: # Healthcheck pour s'assurer que la DB est prête
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: aria_redis_prod
    restart: unless-stopped
    volumes:
      - redis_data_prod:/data
    networks:
      - aria_network_prod

  app: # Application Next.js (Frontend et API)
    build:
      context: . # Contexte de build est le répertoire courant (/opt/aria)
      dockerfile: Dockerfile # Utilise le Dockerfile principal
    container_name: aria_app_prod
    restart: unless-stopped
    env_file:
      - .env # Charge les variables d'environnement
    ports:
      - "3001:3000" # Expose le port 3000 du conteneur sur le port 3001 de l'hôte (celui que Nginx reverse-proxy)
    volumes:
      - ./storage:/app/storage # Persistance des uploads locaux
      - ./models:/app/models # Accès aux modèles locaux téléchargés
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
    networks:
      - aria_network_prod
    command: npm start # Lance l'application Next.js

  worker: # Processus séparé pour les jobs BullMQ (ingestion, génération docs)
    build:
      context: .
      dockerfile: Dockerfile
    container_name: aria_worker_prod
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - WORKER_ENABLED=true # Active le worker BullMQ
    volumes:
      - ./storage:/app/storage
      - ./models:/app/models
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
      app: { condition: service_started } # Le worker peut dépendre de l'app si elle expose des API internes
    networks:
      - aria_network_prod
    command: npm run worker # Commande pour lancer le worker BullMQ (via package.json)

volumes:
  postgres_data_prod: # Volume pour les données persistantes de PostgreSQL
  redis_data_prod:    # Volume pour les données persistantes de Redis

networks:
  aria_network_prod:
    driver: bridge
```

**12.5. `Dockerfile` (pour la Production) :**
Assurez-vous que ce Dockerfile est dans `/opt/aria/Dockerfile`.

```dockerfile
# Fichier: Dockerfile
# Version: 3.0 (Optimisé pour la production ARIA)

# === ÉTAPE 1: Image de Base (avec Node.js et les outils nécessaires) ===
FROM node:18-alpine AS base
# Installer les dépendances système pour Prisma, Tesseract et Latex (si compilation PDF dans le conteneur)
RUN apk add --no-cache openssl tesseract-ocr tesseract-ocr-fra imagemagick texlive-full ffmpeg

# === ÉTAPE 2: Installation des Dépendances Node.js ===
FROM base AS node_deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Installer les dépendances de production uniquement (npm ci --omit=dev)
RUN npm ci --omit=dev

# === ÉTAPE 3: Build de l'Application Next.js ===
FROM base AS builder
WORKDIR /app
COPY --from=node_deps /app/node_modules ./node_modules
COPY --from=node_deps /app/package.json ./package.json
COPY prisma ./prisma/ # Copie le schéma Prisma
RUN npx prisma generate # Génère le client Prisma

COPY . . # Copie tout le code source
RUN npm run build # Lance le build de Next.js

# === ÉTAPE 4: Image Finale de Production (Runner) ===
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copie UNIQUEMENT les dépendances de production
COPY --from=node_deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copie les artefacts de build Next.js (standalone)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copie le client Prisma généré et le dossier prisma (pour les migrations, seeds)
COPY --from=builder /app/node_modules/.prisma ./.prisma
COPY --from=builder /app/prisma ./prisma

# Créer un utilisateur non-root pour la sécurité (bonne pratique)
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

# Expose le port interne du conteneur
EXPOSE 3000
# Commande de démarrage
CMD ["node", "server.js"]
```

**12.6. Configuration Nginx (`/etc/nginx/sites-available/nexusreussite.academy.conf`) :**
*   Créer ce fichier de configuration Nginx dédié pour Nexus Réussite.
*   Désactiver l'ancien `aria.conf` et activer cette nouvelle configuration.

```nginx
# Fichier : /etc/nginx/sites-available/nexusreussite.academy.conf

server {
    listen 80;
    listen [::]:80;
    server_name nexusreussite.academy www.nexusreussite.academy;

    # Certbot pour le renouvellement SSL
    location ^~ /.well-known/acme-challenge/ {
        default_type "text/plain";
        root /var/www/html; # Assurez-vous que ce chemin est accessible par Certbot
        allow all;
    }

    return 301 https://$host$request_uri; # Redirection HTTP vers HTTPS
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name nexusreussite.academy www.nexusreussite.academy;

    # Certificats Let's Encrypt (chemins standards)
    ssl_certificate /etc/letsencrypt/live/nexusreussite.academy/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nexusreussite.academy/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Redirection canonique : forcer www -> apex
    if ($host = www.nexusreussite.academy) {
        return 301 https://nexusreussite.academy$request_uri;
    }

    # Logs spécifiques au site
    access_log /var/log/nginx/nexusreussite.academy.access.log;
    error_log /var/log/nginx/nexusreussite.academy.error.log warn;

    # Headers de sécurité
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Cache agressif pour les assets statiques de Next.js
    location ~ ^/_next/static/(.+)$ {
        proxy_pass http://127.0.0.1:3001; # Proxy vers le conteneur Next.js
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Accès aux fichiers publics
    location ~ ^/(images/|favicon\.ico|.*\.(svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|webmanifest))$ {
        root /opt/aria/public; # Chemin vers le dossier public du projet
        expires 1y;
        access_log off;
        try_files $uri =404;
    }

    # Proxy vers l'application Next.js
    location / {
        proxy_pass http://127.0.0.1:3001; # Proxy vers le port exposé du conteneur Next.js
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade'; # Pour WebSockets
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s; # Augmenter le timeout pour les requêtes IA longues
        proxy_send_timeout 300s;
    }
}
```

**12.7. Mise à jour des Certificats SSL :**
*   **Commande :** Après la modification de Nginx, assurez-vous que Certbot génère ou renouvelle le certificat pour `nexusreussite.academy`.
    ```bash
    sudo certbot --nginx -d nexusreussite.academy -d www.nexusreussite.academy --agree-tos --email contact@nexusreussite.academy
    ```
    *   **Renouvellement automatique :** `sudo crontab -e` et ajoutez `0 3 * * * /usr/bin/certbot renew --quiet`

**12.8. Autres Services (ARIA, mfai.app, PostgreSQL hôte) :**
*   Les modifications ci-dessus n'interféreront pas avec `mfai.app` (qui utilise le port 3000 de l'hôte via Nginx `domain_name`).
*   L'instance PostgreSQL de l'hôte doit être désactivée ou supprimée pour éviter toute confusion avec l'instance Dockerisée.
    ```bash
    sudo systemctl stop postgresql
    sudo systemctl disable postgresql
    ```    *   **Attention :** Assurez-vous que cette instance PostgreSQL hôte n'est PAS utilisée par `mfai.app` ou d'autres services avant de la désactiver ! Si elle est utilisée, ne faites rien.

---

### **13. Feuille de Route Détaillée (Roadmap par Sprints)**

Cette roadmap est une suggestion de priorisation des sprints de développement pour Cursor.

**13.1. Sprint 1 : Fondations ARIA & Ingestion RAG (4-6 semaines)**
*   **[ ]** Configuration de l'environnement de développement local (Docker Compose, `.env.local`).
*   **[ ]** Modèles Prisma (`User`, `Student`, `UserDocument`, `KnowledgeAsset`, `IngestJob`, `Memory`, ACL pour `UserRole`).
*   **[ ]** NextAuth.js et Middleware ACL (`/admin/*` restreint).
*   **[ ]** Bibliothèques de base (`lib/prisma.ts`, `lib/storage.ts`, `lib/queue.ts`).
*   **[ ]** Vector & Embeddings (`embeddings.ts`, `search.ts`).
*   **[ ]** OCR & Parsing (`ocr.ts` avec Tesseract local et intégration GCV désactivée initialement).
*   **[ ]** Chunker (`chunker.ts`).
*   **[ ]** Pipeline d'Ingestion (`ingest.ts`).
*   **[ ]** Queue BullMQ et Worker (`queue.ts`, `worker.ts`).
*   **[ ]** API Routes pour RAG Admin (`/api/rag/upload`, `/api/rag/jobs`, `/api/rag/docs`).
*   **[ ]** Interface RAG Admin UI (`/admin/rag/page.tsx`).
*   **[ ]** Script Seed (`prisma/seed.ts`) pour peupler la DB (admin, assistante, coach, élève, documents factices).
*   **[ ]** Tests unitaires pour chunker, embeddings, ingestion simple.

**13.2. Sprint 2 : Cœur de l'Agent ARIA (Mémoire & Chat) (6-8 semaines)**
*   **[ ]** Modèles Prisma (`ChatMessage`, `Dashboard`, `StudentSession`, `QuizResult`, `CoachReport`).
*   **[ ]** Système de Mémoire ARIA (`MemoryKind`, `buildContext`, `updateMemory`).
*   **[ ]** API Route `GET /api/context/build`.
*   **[ ]** API Route `POST /api/aria/chat` (gestion de la conversation avec OpenAI, utilisation du contexte).
*   **[ ]** Interface Chat ARIA UI (`/eleve/chat/page.tsx`).
*   **[ ]** Tests d'intégration pour `buildContext` et le chat.

**13.3. Sprint 3 : Génération de Documents & Bilans (6-8 semaines)**
*   **[ ]** Modèles Prisma (`GeneratedDocument`, `Bilan`, `MailLog`).
*   **[ ]** API de génération de Bilans (`/api/bilan/generate-report-text`, `/api/bilan/generate-summary-text`).
*   **[ ]** Composants PDF `@react-pdf/renderer` pour Bilan (standard, parent, élève).
*   **[ ]** Endpoint PDF unique (`/api/bilan/pdf/[bilanId]?variant=...`).
*   **[ ]** Endpoint d'envoi d'e-mails (`/api/bilan/email/[bilanId]`).
*   **[ ]** Outils UI de Bilan (sélecteur variante, envoi email, historique).
*   **[ ]** Générateur de Documents Pédagogiques (`server/generation/generator.ts`) avec pipeline LaTeX → PDF auto-fix.
*   **[ ]** API de génération de Documents (`/api/aria/generate-document`).
*   **[ ]** Interface UI pour la génération de documents (formulaire élève/coach/admin).
*   **[ ]** Tests E2E pour le flux de bilan et la génération de documents.

**13.4. Sprint 4 : Optimisation, Sécurité & Déploiement (4-6 semaines)**
*   **[ ]** Optimisation des performances (cache Redis, requêtes DB, chargement modèles).
*   **[ ]** Durcissement de la sécurité (Rate-limiting, validation des inputs, logging des audits).
*   **[ ]** Passage de l'OCR local à Google Cloud Vision API en production.
*   **[ ]** Préparation des Dockerfiles et `docker-compose.yml` pour la production.
*   **[ ]** Configuration Nginx et Certbot pour la production.
*   **[ ]** Déploiement initial sur VPS Hostinger.
*   **[ ]** Scripts de déploiement et de maintenance (sauvegarde, renouvellement SSL).
*   **[ ]** Monitoring des ressources et des coûts OpenAI.

---

### **14. Livrables et Critères de Succès**

**14.1. Livrables Attendus :**
*   L'intégralité du code source de l'écosystème ARIA, documenté.
*   Fichiers de configuration (`.env.local`, `docker-compose.dev.yml`, `nginx.conf` de prod).
*   Scripts de support (`download-dev-models.py`, `test-ai-dev.py`, scripts de déploiement/sauvegarde).
*   Rapports de tests (unitaires, intégration, E2E).
*   Documentation technique des API et des services ARIA.

**14.2. Critères de Succès (Vérification Finale) :**
*   **[ ]** L'environnement de développement local est fonctionnel et stable.
*   **[ ]** Le pipeline RAG complet (upload → OCR → chunk → embed → index) fonctionne pour tous les types de documents supportés, avec un statut `PUBLISHED`.
*   **[ ]** L'agent ARIA répond de manière pertinente dans le chat, utilisant le contexte mémoire et RAG.
*   **[ ]** La génération de documents pédagogiques produit des PDFs valides et de haute qualité (LaTeX), avec une auto-correction fonctionnelle.
*   **[ ]** Les bilans stratégiques sont générés en PDF avec leurs différentes variantes (standard, parent, élève), avec un contenu cohérent et premium.
*   **[ ]** L'interface RAG Admin est accessible et entièrement fonctionnelle.
*   **[ ]** Les ACL sont strictement implémentées sur toutes les routes et fonctionnalités protégées.
*   **[ ]** Les performances sont acceptables sur le VPS de production.
*   **[ ]** La sécurité de base est implémentée (SSL, UFW, variables d'environnement sécurisées).
*   **[ ]** Les tests passent avec succès.

---

**Fin du Cahier des Charges.** , ce document vous fournit toutes les directives pour développer et déployer ARIA. Je compte sur votre expertise pour réaliser ce projet avec la plus haute qualité.
