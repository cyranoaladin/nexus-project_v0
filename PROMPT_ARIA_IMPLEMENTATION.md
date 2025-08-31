# Prompt Complet pour l'Implémentation d'ARIA 

## Contexte et Objectif Global

Vous allez implémenter ARIA (Agent de Renseignement Intellectuel Avancé), un système éducatif intelligent complet comprenant:

1. **Un agent conversationnel pédagogique** avec mémoire contextuelle à long terme
2. **Un système RAG avancé** pour l'ingestion et la recherche de documents
3. **Un générateur de contenu pédagogique** produisant des documents LaTeX/PDF de qualité
4. **Un dashboard d'administration** pour la gestion des contenus et utilisateurs
5. **Un système de gestion des connaissances** avec embeddings vectoriels

## Références Techniques Complètes

Basez-vous intégralement sur ces deux documents:
- `ARIA_MODE_DEV.md` - Pour la configuration développement détaillée
- `ARIA_CAHIER_CHARGES.md` - Pour l'architecture complète et les spécifications techniques

## Architecture Technique à Implémenter

### 1. Stack Technologique (Section 2.2 du Cahier des Charges)
- **Frontend**: Next.js 14+ avec App Router, TypeScript strict, Tailwind CSS
- **Backend**: API Routes Next.js avec structure modulaire
- **Base de données**: PostgreSQL avec Prisma ORM et extension pgvector
- **Cache**: Redis pour les queues et caching
- **IA/ML**: OpenAI API, Hugging Face Transformers, LangChain
- **OCR**: Tesseract (dev) / Google Cloud Vision (prod)

### 2. Modèle de Données (Section 3 du Cahier des Charges)
Implémentez exactement le schéma Prisma fourni, incluant:
- Modèles: User, Student, Memory, EducationalDocument, Chunk, Embedding
- Enums: UserRole, MemoryType, DocumentStatus
- Relations et indexes comme spécifié

### 3. Microservices Architecture (Section 2.1 de ARIA_CAHIER_CHARGES.md)
Structurez l'application en services distincts:
- Service RAG (ingestion de documents)
- Service Context (construction du contexte)
- Service Memory (gestion mémoire)
- Service Generation (génération de contenu)

## Implémentation Détaillée Demandée

### 1. Configuration de l'Environnement de Développement

**Suivez strictement les instructions de `ARIA_MODE_DEV.md`:**

1. **Variables d'environnement** (.env.local):
   ```env
   NODE_ENV=development
   DATABASE_URL="postgresql://aria_dev_user:dev_password_123@localhost:5432/aria_dev"
   REDIS_URL="redis://localhost:6379"
   OPENAI_API_KEY="sk-votre-cle-openai-ici"
   OPENAI_MODEL="gpt-3.5-turbo"
   EMBEDDING_MODEL="text-embedding-ada-002"
   ```

2. **Docker Compose** (docker-compose.dev.yml):
   - PostgreSQL et Redis avec configuration développement
   - Volumes persistants pour les données de développement

3. **Dépendances Python** (requirements-dev.txt):
   - openai, langchain, transformers, sentence-transformers
   - pdfplumber, python-docx, pytesseract pour le traitement documentaire

### 2. Pipeline RAG Complet (Section 4 de ARIA_CAHIER_CHARGES.md)

Implémentez le pipeline d'ingestion étape par étape:

```typescript
// Structure du pipeline RAG
class IngestionPipeline {
  async processDocument(file: File, metadata: DocumentMetadata) {
    // 1. Upload et validation
    const validation = await this.validateFile(file);
    
    // 2. Extraction de contenu (OCR si nécessaire)
    const content = await this.extractContent(file);
    
    // 3. Nettoyage et prétraitement
    const cleaned = await this.cleanContent(content);
    
    // 4. Segmentation intelligente
    const chunks = await this.segmentContent(cleaned);
    
    // 5. Enrichissement avec métadonnées
    const enriched = await this.enrichChunks(chunks, metadata);
    
    // 6. Génération d'embeddings
    const embeddings = await this.generateEmbeddings(enriched);
    
    // 7. Indexation
    await this.indexChunks(enriched, embeddings);
  }
}
```

### 3. Système de Mémoire Contextuelle (Section 5 de ARIA_CAHIER_CHARGES.md)

Implémentez le système de mémoire hiérarchique:

```typescript
class MemorySystem {
  async buildContext(studentId: string, query: string): Promise<Context> {
    const [recentMessages, episodicMemories, semanticMemories, plan, dashboard] = await Promise.all([
      this.getRecentMessages(studentId, 30),
      this.getEpisodicMemories(studentId, 5),
      this.getSemanticMemories(studentId, query, 6),
      this.getCurrentPlan(studentId),
      this.getDashboardData(studentId)
    ]);
    
    return {
      recent: recentMessages,
      episodic: episodicMemories,
      semantic: semanticMemories,
      plan,
      dashboard
    };
  }
}
```

### 4. Générateur de Documents (Section 6 de ARIA_CAHIER_CHARGES.md)

Implémentez le pipeline complet de génération:

```typescript
class DocumentGenerator {
  async generateDocument(request: GenerationRequest): Promise<GeneratedDocument> {
    // 1. Planification avec LLM
    const outline = await this.planDocument(request);
    
    // 2. Rédaction section par section
    const draft = await this.draftDocument(outline);
    
    // 3. Révision et correction
    const reviewed = await this.reviewDocument(draft);
    
    // 4. Formatage LaTeX
    const latex = await this.formatLatex(reviewed);
    
    // 5. Compilation avec auto-correction
    const pdf = await this.compileLatex(latex);
    
    // 6. Enregistrement
    return await this.storeDocument(pdf, request);
  }
}
```

### 5. Interface d'Administration RAG

Créez une interface complète permettant:
- L'upload de documents avec métadonnées (matière, niveau, type)
- Le suivi des jobs d'ingestion en temps réel
- La visualisation des documents indexés et de leurs chunks
- La gestion des modèles et paramètres RAG

## Configuration pour les Deux Modes

### Mode Développement (Suivre ARIA_MODE_DEV.md)

1. **Base de données**: PostgreSQL local via Docker
2. **OCR**: Tesseract.js pour le traitement local
3. **Embeddings**: Modèles légers (all-MiniLM-L6-v2)
4. **LLM**: GPT-3.5-turbo pour réduire les coûts
5. **Validation**: Désactivée partiellement pour le développement

### Mode Production (Extensions nécessaires)

1. **Base de données**: PostgreSQL avec pgvector sur VPS
2. **OCR**: Google Cloud Vision pour une précision optimale
3. **Embeddings**: text-embedding-3-large pour la qualité
4. **LLM**: GPT-4 pour les réponses les plus qualitatives
5. **Sécurité**: Validation complète, SSL, chiffrement

## Déploiement sur VPS

Notre VPS a les spécifications suivantes:
- Ubuntu 22.04 LTS, 8 CPUs, 32GB RAM, 400GB SSD
- Adresse: 46.202.171.14 (mfai.app)

**Configuration production requise:**
1. Docker et Docker Compose
2. Nginx comme reverse proxy avec SSL
3. Configuration des firewall (UFW)
4. Système de sauvegardes automatiques
5. Monitoring des ressources et logs

## Étapes de Validation

Avant de considérer le projet comme terminé, vérifiez:

- [ ] Le pipeline RAG complet fonctionne en mode dev et prod
- [ ] L'agent ARIA répond avec le contexte approprié
- [ ] La génération de documents produit des PDFs valides
- [ ] L'interface admin est accessible et fonctionnelle
- [ ] Les performances sont acceptables sur le VPS
- [ ] La sécurité de base est implémentée (ACL, validation)

## Scripts et Automatisation

Implémentez les scripts suivants:
- `scripts/setup-dev.sh` - Configuration de l'environnement de dev
- `scripts/deploy-prod.sh` - Déploiement sur le VPS
- `scripts/backup.sh` - Sauvegarde des données et modèles
- `scripts/test-ai.js` - Tests de validation des composants IA

## Instructions Spécifiques

1. **Priorisez l'implémentation** selon la feuille de route (Section 11 de ARIA_CAHIER_CHARGES.md)
2. **Utilisez les extraits de code fournis** comme base pour l'implémentation
3. **Documentez chaque composant** avec des commentaires détaillés
4. **Implémentez les tests** pour valider chaque fonctionnalité
5. **Optimisez les performances** surtout pour les opérations IA coûteuses

Ce prompt donne toutes les instructions nécessaires pour implémenter ARIA de manière complète et professionnelle, en suivant strictement la documentation fournie.
