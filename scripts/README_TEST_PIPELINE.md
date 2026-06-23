# Script de Test E2E - Universal Assessment Pipeline

## Description

Script de validation end-to-end du système d'évaluation universel "Bilan d'Excellence".

Simule le parcours complet d'un élève (Alice Turing, NSI Terminale) depuis la soumission jusqu'à la génération du bilan personnalisé.

## Prérequis

1. **Base de données accessible**
   ```bash
   # Vérifier que PostgreSQL tourne
   docker ps | grep postgres
   ```

2. **Migration Prisma appliquée**
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

3. **Application Next.js en cours d'exécution**
   ```bash
   npm run dev
   # ou en production
   npm run build && npm start
   ```

4. **Ollama accessible** (pour génération LLM)
   ```bash
   curl http://ollama:11434/api/tags
   ```

## Usage

### Exécution Locale (Dev)

```bash
# Avec l'app en dev
npm run dev

# Dans un autre terminal
npx tsx scripts/test-universal-pipeline.ts
```

### Exécution Production

```bash
# Sur le serveur
cd /srv/nexus-next-app

# Avec l'app en production
export NEXT_PUBLIC_APP_URL="http://localhost:3011"
npx tsx scripts/test-universal-pipeline.ts
```

## Scénario du Test

### SETUP
- **Profil élève** : Alice Turing
- **Matière** : MATHS (NSI quand questions migrées)
- **Niveau** : Terminale
- **Réponses** : Mix de correctes, incorrectes, et NSP

### ÉTAPE 1 : Soumission
```
POST /api/assessments/submit
```
- Envoie le payload avec profil + réponses
- Vérifie `success: true` et `assessmentId`

### ÉTAPE 2 : Polling & Génération
```
GET /api/assessments/[id]/status (toutes les 2s)
```
- Affiche progression : `PENDING` → `SCORING` → `GENERATING` → `COMPLETED`
- Timeout après 2 minutes
- Crash si statut `FAILED`

### ÉTAPE 3 : Vérification du Bilan
```
Requête directe à la DB (Prisma)
```

**Assertions critiques** :
1. ✅ `globalScore` calculé (> 0)
2. ✅ `confidenceIndex` calculé
3. ✅ `studentMarkdown` non vide (LLM a écrit)
4. ✅ `parentsMarkdown` non vide
5. ✅ `nexusMarkdown` contient métriques techniques
6. ✅ `scoringResult` présent en JSON
7. ✅ Métriques spécifiques (raisonnement, calcul, abstraction)
8. ✅ Forces/faiblesses identifiées
9. ✅ Recommandations fournies

### TEARDOWN
- Supprime l'assessment de la DB (cleanup)

## Sortie Attendue

### Succès
```
================================================================================
🧪 UNIVERSAL ASSESSMENT PIPELINE E2E TEST
================================================================================

ℹ️  Testing with profile: Alice Turing (MATHS TERMINALE)
ℹ️  API Base URL: http://localhost:3000
ℹ️  Polling Interval: 2000ms
ℹ️  Max Wait Time: 120s

[STEP 1] Submitting assessment...
✅ Assessment submitted successfully
ℹ️  Assessment ID: clx123abc...

[STEP 2] Polling assessment status...
  PENDING (0%) - Votre évaluation est en attente...
  SCORING (50%) - Calcul de vos résultats...
  GENERATING (75%) - Génération de votre bilan...
  COMPLETED (100%) - Votre bilan est prêt !
✅ Assessment completed in 45s

[STEP 3] Verifying bilan generation...
ℹ️  Running assertions...
✅ Global score calculated: 75/100
✅ Confidence index calculated: 80/100
✅ Student bilan generated (1234 chars)
✅ Parents bilan generated (1456 chars)
✅ Nexus bilan generated (2345 chars)
✅ Scoring result present in database
✅ Subject metrics present: raisonnement, calcul, abstraction
✅ Strengths identified: Géométrie, Analyse
✅ Weaknesses identified: Combinatoire
✅ Recommendations provided: 3 items

📊 Assessment Summary:
  Student: Alice Turing
  Subject: MATHS TERMINALE
  Global Score: 75/100
  Confidence Index: 80/100
  Status: COMPLETED
  Created: 2026-02-14T18:45:00.000Z

[TEARDOWN] Cleaning up test data...
✅ Test assessment deleted from database

================================================================================
🟢 SYSTÈME NSI/MATHS OPÉRATIONNEL
================================================================================

✅ All tests passed!
✅ The universal assessment pipeline is fully operational.
```

### Échec
```
================================================================================
🔴 TEST FAILED
================================================================================

❌ Error: Assessment generation failed
❌ Error: GENERATION_ERROR
❌ Details: Ollama timeout after 120000ms

Stack trace:
  at pollAssessmentStatus (...)
  at main (...)
```

## Configuration

### Variables d'Environnement

```bash
# URL de l'API (défaut: http://localhost:3000)
export NEXT_PUBLIC_APP_URL="http://localhost:3011"

# Base de données
export DATABASE_URL="postgresql://user:pass@localhost:5433/nexus_db"

# Ollama (pour génération LLM)
export OLLAMA_URL="http://ollama:11434"
export OLLAMA_MODEL="llama3.2:latest"
export OLLAMA_TIMEOUT="120000"
```

### Paramètres du Script

Dans `test-universal-pipeline.ts` :

```typescript
const POLLING_INTERVAL = 2000; // 2 secondes
const MAX_WAIT_TIME = 120000;  // 2 minutes
```

## Dépannage

### Erreur : "Can't reach database server"

**Cause** : PostgreSQL inaccessible

**Solution** :
```bash
docker ps | grep postgres
psql -h localhost -p 5433 -U nexus_user -d nexus_reussite_prod -c "SELECT 1"
```

### Erreur : "Property 'assessment' does not exist"

**Cause** : Client Prisma non généré

**Solution** :
```bash
npx prisma generate
```

### Erreur : "Timeout: Assessment did not complete"

**Cause** : Génération LLM trop lente ou bloquée

**Solution** :
```bash
# Vérifier Ollama
curl http://ollama:11434/api/tags

# Vérifier les logs
pm2 logs nexus-next-app | grep BilanGenerator

# Augmenter le timeout
# Dans le script: MAX_WAIT_TIME = 180000 (3 minutes)
```

### Erreur : "Assessment generation FAILED"

**Cause** : Erreur dans BilanGenerator

**Solution** :
```bash
# Vérifier les logs de l'app
pm2 logs nexus-next-app --lines 200

# Vérifier le status dans la DB
psql -h localhost -p 5433 -U nexus_user -d nexus_reussite_prod \
  -c "SELECT id, status, errorCode, errorDetails FROM assessments ORDER BY createdAt DESC LIMIT 1;"
```

### Erreur : "Assertion failed: studentMarkdown is empty"

**Cause** : LLM n'a pas généré de texte

**Solution** :
```bash
# Vérifier qu'Ollama a bien le modèle
curl http://ollama:11434/api/tags | grep llama3.2

# Tester Ollama manuellement
curl http://ollama:11434/api/generate -d '{
  "model": "llama3.2:latest",
  "prompt": "Test",
  "stream": false
}'
```

## Utilisation en CI/CD

### GitHub Actions

```yaml
name: E2E Test - Assessment Pipeline

on:
  push:
    branches: [main]
  pull_request:

jobs:
  e2e-test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Apply Prisma migrations
        run: npx prisma migrate deploy
      
      - name: Generate Prisma client
        run: npx prisma generate
      
      - name: Build Next.js app
        run: npm run build
      
      - name: Start Next.js app
        run: npm start &
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      
      - name: Wait for app to be ready
        run: sleep 10
      
      - name: Run E2E test
        run: npx tsx scripts/test-universal-pipeline.ts
        env:
          NEXT_PUBLIC_APP_URL: http://localhost:3000
```

## Prochaines Étapes

1. **Migrer questions NSI** pour tester avec vraies questions NSI
2. **Ajouter tests pour Première** (MATHS + NSI)
3. **Ajouter tests de charge** (10+ évaluations simultanées)
4. **Intégrer au CI/CD** (GitHub Actions)
5. **Ajouter métriques de performance** (temps de génération, etc.)

## Références

- Documentation déploiement : `docs/DEPLOYMENT_ASSESSMENT_MODULE.md`
- Architecture archivée : `docs/archive/audits/2026-04-root/AUDIT_BILAN_PIPELINE.md`
- QuestionBank : `lib/assessments/questions/README.md`
- ScoringFactory : `lib/assessments/scoring/README.md`
