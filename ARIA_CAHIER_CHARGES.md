# ARIA Agent - Cahier des Charges et Feuille de Route

## 1. Introduction

ARIA (Agent de Renseignement Intellectuel Avancé) est un système éducatif intelligent qui combine les dernières avancées en IA générative, traitement du langage naturel et gestion de connaissances pour offrir un accompagnement pédagogique personnalisé de haute qualité.

### 1.1 Objectifs
- Fournir un professeur IA disponible 24/7 pour les élèves abonnés
- Offrir un accompagnement multi-matieres (Maths, NSI, extensible)
- Maintenir une mémoire contextuelle à long terme des interactions
- Générer du contenu pédagogique de qualité professionnelle
- Assurer une expérience utilisateur premium et intuitive

### 1.2 Public cible
- Élèves du secondaire (Lycée)
- Parents d'élèves
- Coachs et enseignants
- Administrateurs pédagogiques

## 2. Architecture Générale

### 2.1 Architecture Microservices

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   API Gateway   │    │  Auth Service   │
│   (Next.js)     │◄──►│   (NestJS)      │◄──►│  (NestJS)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                             │
                             │
       ┌───────────┬─────────┴─────────┬───────────┐
       │           │                   │           │
┌──────┴─────┐ ┌───┴───┐ ┌─────────────┴─┐ ┌──────┴──────┐
│ RAG Service│ │Context│ │  Generation   │ │ Memory      │
│ (NestJS)   │ │Service│ │  Service      │ │ Service     │
│            │ │(NestJS)│ │  (NestJS)    │ │ (NestJS)    │
└────────────┘ └───────┘ └───────────────┘ └─────────────┘
```

### 2.2 Stack Technologique

**Frontend:**
- Next.js 14+ avec App Router
- TypeScript strict
- Tailwind CSS avec design system custom
- React Query (TanStack) pour la gestion d'état serveur
- Framer Motion pour les animations

**Backend:**
- NestJS pour les microservices
- PostgreSQL avec Prisma ORM
- Redis pour le caching et les queues
- Elasticsearch/Meilisearch pour la recherche textuelle
- MinIO/S3 pour le stockage des documents

**IA & ML:**
- OpenAI API (GPT-4, Embeddings)
- Hugging Face Transformers (pour le traitement spécialisé)
- LangChain pour l'orchestration des prompts
- PyTorch/TensorFlow pour les modèles custom

**Infrastructure:**
- Docker et Docker Compose pour le développement
- Kubernetes pour la production
- GitHub Actions pour le CI/CD
- Prometheus/Grafana pour le monitoring
- Vercel/Netlify pour le frontend

## 3. Modèle de Données Détaillé

### 3.1 Schéma Principal

```prisma
// Modèle utilisateur avec rôles multiples
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  password    String   // hashé avec bcrypt
  role        UserRole
  profile     Profile?
  students    Student[] // pour les parents
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum UserRole {
  ADMIN
  ASSISTANTE
  COACH
  ELEVE
  PARENT
}

// Profil étudiant avec suivi détaillé
model Student {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id])
  level       String   // Première, Terminale, etc.
  subjects    String[] // Maths, NSI, etc.
  status      StudentStatus
  progress    Progress?
  sessions    Session[]
  messages    ChatMessage[]
  memories    Memory[]
  documents   Document[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Modèle de mémoire contextuelle
model Memory {
  id          String      @id @default(cuid())
  studentId   String
  student     Student     @relation(fields: [studentId], references: [id])
  type        MemoryType
  content     String
  embedding   Unsupported("vector(1536)")? // ou 3072 selon le modèle
  importance  Float       @default(1.0)
  accessedAt  DateTime    @default(now())
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@index([studentId, type])
  @@index([accessedAt])
}

enum MemoryType {
  EPISODIC   // Mémoire des interactions
  SEMANTIC   // Connaissances générales
  PLAN       // Objectifs et plans
  PREFERENCE // Préférences utilisateur
}
```

### 3.2 Modèles Spécialisés

```prisma
// Document pédagogique
model EducationalDocument {
  id          String     @id @default(cuid())
  title       String
  content     String     // Contenu original
  type        DocumentType
  subject     String
  level       String
  topics      String[]
  metadata    Json
  chunks      Chunk[]
  embeddings  Embedding[]
  status      DocumentStatus @default(DRAFT)
  version     Int        @default(1)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  publishedAt DateTime?
}

// Chunk de document pour RAG
model Chunk {
  id          String   @id @default(cuid())
  documentId  String
  document    EducationalDocument @relation(fields: [documentId], references: [id])
  content     String
  tokens      Int
  embeddingId String?
  embedding   Embedding? @relation(fields: [embeddingId], references: [id])
  metadata    Json
  createdAt   DateTime @default(now())
}

// Embeddings vectoriels
model Embedding {
  id          String   @id @default(cuid())
  vector      Unsupported("vector(1536)") // ou 3072
  model       String   @default("text-embedding-3-large")
  chunks      Chunk[]
  createdAt   DateTime @default(now())
}
```

## 4. Système RAG Avancé

### 4.1 Pipeline d'Ingestion

Le pipeline d'ingestion transforme les documents bruts en ressources RAG optimisées:

1. **Upload et Validation**
   - Supporte PDF, DOCX, PPTX, images, LaTeX
   - Validation du type MIME et de la taille
   - Attribution automatique des métadonnées

2. **Extraction de Contenu**
   - PDF textuels: pdf-parse
   - PDF scannés: Tesseract OCR + preprocessing image
   - Documents Office: mammoth, pptx2json
   - Images: Google Cloud Vision API

3. **Nettoyage et Prétraitement**
   - Suppression des en-têtes/pieds de page
   - Correction des erreurs OCR
   - Normalisation du formatage
   - Détection de la langue

4. **Segmentation Intelligente**
   - Détection de structure hiérarchique
   - Chunking sémantique (800-1200 tokens)
   - Préservation des blocs spéciaux (math, code)
   - Overlap contextuel (150 tokens)

5. **Enrichissement**
   - Extraction des métadonnées
   - Classification par sujet/niveau
   - Liaison avec le programme éducatif
   - Déduplication contextuelle

6. **Embedding et Indexation**
   - Génération d'embeddings (OpenAI, Cohere, ou local)
   - Indexation vectorielle (PgVector, Qdrant)
   - Indexation textuelle (Elasticsearch)

### 4.2 API d'Ingestion

```typescript
// Service d'ingestion avec validation et processing
class IngestionService {
  async processDocument(
    file: Buffer,
    filename: string,
    options: IngestionOptions
  ): Promise<ProcessingResult> {
    // 1. Validation du fichier
    const validation = await this.validateFile(file, filename);
    if (!validation.valid) {
      throw new Error(`Invalid file: ${validation.errors.join(', ')}`);
    }

    // 2. Extraction du contenu
    const content = await this.extractContent(file, filename);

    // 3. Nettoyage et segmentation
    const cleaned = await this.cleanContent(content);
    const chunks = await this.segmentContent(cleaned);

    // 4. Enrichissement
    const enriched = await this.enrichChunks(chunks, options);

    // 5. Embedding et indexation
    const result = await this.indexChunks(enriched);

    return result;
  }
}
```

## 5. Système de Mémoire et Contexte

### 5.1 Architecture de Mémoire

```typescript
// Système de mémoire hiérarchique
class MemorySystem {
  private shortTerm: ShortTermMemory;
  private longTerm: LongTermMemory;
  private semantic: SemanticMemory;
  
  // Récupération contextuelle
  async retrieveContext(
    studentId: string, 
    query: string, 
    options: ContextOptions
  ): Promise<Context> {
    const [shortTerm, longTerm, semantic] = await Promise.all([
      this.shortTerm.retrieve(studentId, query),
      this.longTerm.retrieve(studentId, query),
      this.semantic.retrieve(studentId, query)
    ]);
    
    return this.mergeContexts(shortTerm, longTerm, semantic, options);
  }
  
  // Mise à jour de la mémoire
  async updateMemory(
    studentId: string, 
    interaction: Interaction, 
    importance: number = 1.0
  ): Promise<void> {
    await Promise.all([
      this.shortTerm.update(studentId, interaction),
      this.longTerm.update(studentId, interaction, importance),
      this.semantic.update(studentId, interaction)
    ]);
  }
}
```

### 5.2 Construction du Contexte

Le contexte est construit dynamiquement pour chaque interaction:

1. **Historique Récent**: 20-40 derniers messages de conversation
2. **Mémoire Épisodique**: Résumés des sessions précédentes
3. **Mémoire Sémantique**: Connaissances générales sur l'élève
4. **Plan Actuel**: Objectifs et progression en cours
5. **Dashboard Élève**: Données de progression, quiz, sessions
6. **Connaissances RAG**: Documents pertinents pour la requête

## 6. Génération de Documents

### 6.1 Pipeline de Génération

```typescript
// Orchestrateur de génération de documents
class DocumentGenerationOrchestrator {
  async generateDocument(
    request: GenerationRequest,
    studentContext: StudentContext
  ): Promise<GeneratedDocument> {
    // 1. Planification
    const outline = await this.planDocument(request, studentContext);
    
    // 2. Rédaction
    const draft = await this.draftDocument(outline, studentContext);
    
    // 3. Révision
    const reviewed = await this.reviewDocument(draft, studentContext);
    
    // 4. Formatage LaTeX
    const latex = await this.formatLatex(reviewed, request.template);
    
    // 5. Compilation avec auto-correction
    const pdf = await this.compileLatex(latex);
    
    // 6. Enregistrement
    const result = await this.storeDocument(pdf, request, studentContext);
    
    return result;
  }
}
```

### 6.2 Types de Documents Supportés

- **Cours Complets**: Structure pédagogique complète
- **Résumés**: Synthèse des concepts clés
- **Fiches Méthodologie**: Guides pratiques étape par étape
- **Exercices**: Problèmes progressifs avec corrections
- **Devoirs Maison**: Séries d'exercices thématiques
- **Sujets d'examen**: Contrôles et examens blancs
- **TP/TD**: Travaux pratiques et dirigés

### 6.3 Système de Templates LaTeX

```latex
% Template de base avec personnalisation
\documentclass[11pt]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[french]{babel}
\usepackage{amsmath, amssymb, amsthm}
\usepackage{graphicx}
\usepackage{listings}
\usepackage{tikz}
\usepackage{geometry}

% Métadonnées du document
\title{<<title>>}
\author{ARIA - Assistant Pédagogique}
\date{<<date>>}

% Style personnalisé selon le type
<<if eq type "exercice">>
\usepackage{enumitem}
\newenvironment{exercice}{\begin{enumerate}[label=\textbf{Exercice \arabic*}]}{\end{enumerate}}
<<end>>

\begin{document}
\maketitle

<<content>>

\end{document}
```

## 7. Interface Utilisateur

### 7.1 Dashboard Élève

- **Progression Visuelle**: Graphiques et indicateurs de progression
- **Contenu Personnalisé**: Recommandations adaptées au niveau
- **Chat ARIA**: Interface conversationnelle intuitive
- **Documents**: Accès aux ressources générées
- **Quiz Interactifs**: Évaluations formatives automatiques

### 7.2 Interface Admin/Coach

- **Gestion des Contenus**: Interface d'upload et de management
- **Monitoring**: Analytics d'utilisation et de performance
- **Gestion des Utilisateurs**: Administration des comptes
- **Rapports**: Bilans détaillés de progression

### 7.3 Composants Principaux

```tsx
// Composant de chat avec mémoire contextuelle
function AriaChat({ studentId, subject }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [context, setContext] = useState<Context | null>(null);
  
  // Chargement du contexte
  useEffect(() => {
    const loadContext = async () => {
      const context = await buildContext(studentId, subject);
      setContext(context);
    };
    loadContext();
  }, [studentId, subject]);
  
  // Envoi de message
  const sendMessage = async (content: string) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ 
        studentId, 
        message: content, 
        context 
      })
    });
    
    const data = await response.json();
    setMessages(prev => [...prev, data.message]);
    
    // Mise à jour de la mémoire
    await updateMemory(studentId, {
      type: 'EPISODIC',
      content: `Conversation about ${subject}: ${content}`,
      importance: 0.8
    });
  };
  
  return (
    <div className="chat-container">
      <MessageList messages={messages} />
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
```

## 8. Sécurité et Conformité

### 8.1 Mesures de Sécurité

- **Authentification**: JWT avec refresh tokens
- **Autorisation**: RBAC (Role-Based Access Control) granulaire
- **Chiffrement**: TLS 1.3, chiffrement à rest pour les données sensibles
- **Audit**: Logs détaillés des accès et modifications
- **Sécurité des Données**: Pseudonymisation et anonymisation

### 8.2 Conformité RGPD

- **Consentement**: Gestion des préférences de consentement
- **Droit à l'oubli**: Procédures de suppression complète
- **Portabilité**: Export des données utilisateur
- **DPO**: Délégué à la protection des données
- **PIA**: Analyses d'impact sur la protection des données

## 9. Déploiement et DevOps

### 9.1 Infrastructure Kubernetes

```yaml
# Déploiement type avec liveness/readiness probes
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rag-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: rag-service
  template:
    metadata:
      labels:
        app: rag-service
    spec:
      containers:
      - name: rag-service
        image: rag-service:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: rag-config
        - secretRef:
            name: rag-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
```

### 9.2 CI/CD avec GitHub Actions

```yaml
# Workflow de déploiement
name: Deploy RAG Service
on:
  push:
    branches: [main]
    paths:
      - 'services/rag-service/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: 'services/rag-service/package-lock.json'
      - run: npm ci
        working-directory: services/rag-service
      - run: npm test
        working-directory: services/rag-service
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: azure/setup-kubectl@v3
      - uses: azure/k8s-deploy@v1
        with:
          namespace: ${{ secrets.K8S_NAMESPACE }}
          manifests: |
            services/rag-service/k8s/deployment.yaml
            services/rag-service/k8s/service.yaml
          images: |
            ghcr.io/${{ github.repository }}/rag-service:${{ github.sha }}
```

## 10. Tests et Qualité

### 10.1 Stratégie de Test

- **Tests Unitaires**: Couverture > 90% pour la logique métier
- **Tests d'Intégration**: Validation des interactions entre services
- **Tests E2E**: Scénarios complets utilisateur
- **Tests de Performance**: Charge et stress testing
- **Tests de Sécurité**: Scanning et penetration testing

### 10.2 Monitoring et Alerting

- **Métriques**: Prometheus avec custom metrics
- **Logs**: ELK Stack ou Loki avec structuration
- **Tracing**: Distributed tracing avec Jaeger
- **Alerting**: AlertManager avec seuils configurables
- **Dashboard**: Grafana avec vues personnalisées

## 11. Feuille de Route Détaillée

### Phase 1: MVP (4-6 semaines)
- [ ] Architecture de base et setup initial
- [ ] Modèle de données core
- [ ] Service d'authentification
- [ ] Pipeline RAG basique
- [ ] Interface chat simple
- [ ] Génération de documents simple

### Phase 2: Améliorations (8-10 semaines)
- [ ] Système de mémoire avancé
- [ ] Interface admin complète
- [ ] Dashboard élève détaillé
- [ ] Templates LaTeX avancés
- [ ] Système d'évaluation et quiz

### Phase 3: Optimisation (4-6 semaines)
- [ ] Cache multi-niveaux
- [ ] Optimisation des performances
- [ ] Amélioration de la qualité RAG
- [ ] Tests de charge et optimisation

### Phase 4: Expansion (Continue)
- [ ] Support de nouvelles matières
- [ ] Intégration LMS (Moodle, etc.)
- [ ] Applications mobiles
- [ ] Features avancées d'IA

## 12. Métriques de Succès

- **Qualité Pédagogique**: Scores de satisfaction élèves > 4.5/5
- **Performance**: Latence < 200ms pour les réponses
- **Disponibilité**: Uptime > 99.9%
- **Utilisation**: Engagement > 3 sessions/semaine/élève
- **Rétention**: Taux de renouvellement > 85%

---

Ce document constitue la base de référence pour le développement d'ARIA. Il devra être régulièrement mis à jour pour refléter l'évolution du projet et les retours d'expérience.
