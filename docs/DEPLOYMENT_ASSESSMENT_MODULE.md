# Déploiement du Module Assessment — Guide Complet

Ce guide détaille les étapes pour déployer le nouveau module d'évaluation "Bilan d'Excellence" en production.

## 📋 Prérequis

- Accès SSH au serveur de production (<PROD_SSH_TARGET>)
- Accès à la base de données PostgreSQL (port 5433)
- Docker et Docker Compose installés
- Node.js 18+ et npm
- Ollama accessible sur le réseau `infra_rag_net`

## 🗄️ Étape 1 : Migration de la Base de Données

### 1.1 Connexion au Serveur

```bash
ssh root@<PROD_SSH_TARGET>
cd /srv/nexus-next-app
```

### 1.2 Vérification du Schéma Prisma

Le fichier `prisma/schema.prisma` doit contenir le modèle `Assessment` avec l'enum `AssessmentStatus`.

```bash
# Vérifier que le schéma est à jour
git pull origin main
cat prisma/schema.prisma | grep -A 50 "model Assessment"
```

### 1.3 Application de la Migration

**Option A : Migration automatique (recommandé)**

```bash
# Appliquer toutes les migrations en attente
npx prisma migrate deploy

# Générer le client Prisma TypeScript
npx prisma generate
```

**Option B : Migration manuelle (si Option A échoue)**

```bash
# Se connecter à PostgreSQL
psql -h localhost -p 5433 -U nexus_user -d nexus_reussite_prod

# Exécuter le SQL de migration
\i prisma/migrations/20260214_init_assessment_module/migration.sql

# Vérifier que la table existe
\dt assessments
\d assessments

# Quitter psql
\q

# Générer le client Prisma
npx prisma generate
```

### 1.4 Vérification de la Migration

```bash
# Vérifier que la table existe
npx prisma db execute --stdin <<EOF
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'assessments';
EOF

# Vérifier l'enum
npx prisma db execute --stdin <<EOF
SELECT enumlabel 
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'AssessmentStatus';
EOF
```

## 🏗️ Étape 2 : Build de l'Application

### 2.1 Installation des Dépendances

```bash
# Installer les nouvelles dépendances
npm install

# Vérifier les packages critiques
npm list react-syntax-highlighter react-katex react-markdown
```

### 2.2 Build Next.js

```bash
# Build en mode production
npm run build

# Vérifier qu'il n'y a pas d'erreurs TypeScript
# Le build doit réussir même si Prisma affiche des warnings
```

### 2.3 Vérification du Build

```bash
# Vérifier que le dossier .next existe
ls -lh .next/

# Vérifier la taille du build
du -sh .next/

# Vérifier les routes générées
ls -lh .next/server/app/api/assessments/
```

## 🐳 Étape 3 : Redémarrage des Services

### 3.1 Redémarrage Docker (si applicable)

```bash
# Si l'app tourne dans Docker
cd /srv/nexus-next-app
docker-compose restart nexus-next-app

# Vérifier les logs
docker-compose logs -f --tail=100 nexus-next-app
```

### 3.2 Redémarrage PM2 (si applicable)

```bash
# Si l'app tourne avec PM2
pm2 restart nexus-next-app

# Vérifier les logs
pm2 logs nexus-next-app --lines 100
```

### 3.3 Vérification du Healthcheck

```bash
# Attendre 10 secondes pour le démarrage
sleep 10

# Tester le healthcheck
curl -f http://localhost:3011/api/health || echo "Healthcheck failed"
```

## ✅ Étape 4 : Tests de Validation

### 4.1 Test de l'API Assessment

```bash
# Test de l'endpoint de test
curl http://localhost:3011/api/assessments/test

# Réponse attendue:
# {
#   "success": true,
#   "message": "Assessment model is accessible",
#   "data": {
#     "totalCount": 0,
#     "recentAssessments": []
#   }
# }
```

### 4.2 Test de Soumission (optionnel)

```bash
# Créer un fichier test-assessment.json
cat > test-assessment.json <<'EOF'
{
  "subject": "MATHS",
  "grade": "TERMINALE",
  "studentData": {
    "email": "test@example.com",
    "name": "Test User"
  },
  "answers": {
    "MATH-COMB-01": "a"
  },
  "duration": 60000
}
EOF

# Soumettre une évaluation de test
curl -X POST http://localhost:3011/api/assessments/submit \
  -H "Content-Type: application/json" \
  -d @test-assessment.json

# Réponse attendue:
# {
#   "success": true,
#   "assessmentId": "clx...",
#   "redirectUrl": "/assessments/clx.../processing"
# }
```

### 4.3 Vérification de la Génération LLM

```bash
# Vérifier qu'Ollama est accessible
curl http://ollama:11434/api/tags

# Vérifier que llama3.2 est disponible
curl http://ollama:11434/api/tags | grep llama3.2
```

### 4.4 Test End-to-End (via navigateur)

1. Accéder à `https://nexus-reussite.com/api/assessments/test`
2. Vérifier la réponse JSON
3. Accéder à une page d'évaluation (si disponible)
4. Soumettre une évaluation
5. Vérifier la page `/assessments/[id]/processing`
6. Attendre la génération (~30-45s)
7. Vérifier la page `/assessments/[id]/result`

## 🔧 Étape 5 : Configuration Environnement

### 5.1 Variables d'Environnement

Vérifier que le fichier `.env` contient :

```bash
# Database
DATABASE_URL="postgresql://nexus_user:password@localhost:5433/nexus_reussite_prod"

# Ollama (LLM)
OLLAMA_URL="http://ollama:11434"
OLLAMA_MODEL="llama3.2:latest"
OLLAMA_TIMEOUT="120000"

# RAG (optionnel)
RAG_INGESTOR_URL="http://ingestor:8001"

# Next.js
NEXT_PUBLIC_APP_URL="https://nexus-reussite.com"
```

### 5.2 Vérification Docker Network

```bash
# Vérifier que nexus-next-app est sur infra_rag_net
docker network inspect infra_rag_net | grep nexus-next-app

# Si absent, ajouter au docker-compose.yml:
# networks:
#   - nexus_nexus-network
#   - infra_rag_net
#
# networks:
#   infra_rag_net:
#     external: true
```

## 🚨 Dépannage

### Erreur : "Property 'assessment' does not exist"

**Cause** : Le client Prisma n'a pas été régénéré après la migration.

**Solution** :
```bash
npx prisma generate
npm run build
pm2 restart nexus-next-app
```

### Erreur : "Can't reach database server"

**Cause** : La base de données n'est pas accessible.

**Solution** :
```bash
# Vérifier que PostgreSQL tourne
docker ps | grep postgres

# Vérifier la connexion
psql -h localhost -p 5433 -U nexus_user -d nexus_reussite_prod -c "SELECT 1"
```

### Erreur : "Ollama timeout"

**Cause** : Ollama n'est pas accessible ou surchargé.

**Solution** :
```bash
# Vérifier qu'Ollama tourne
docker ps | grep ollama

# Vérifier les ressources CPU/RAM
docker stats infra-ollama-1

# Augmenter le timeout dans .env
OLLAMA_TIMEOUT="180000"
```

### Erreur : "Assessment not found" après soumission

**Cause** : La génération LLM a échoué silencieusement.

**Solution** :
```bash
# Vérifier les logs de l'app
pm2 logs nexus-next-app | grep BilanGenerator

# Vérifier le status dans la DB
psql -h localhost -p 5433 -U nexus_user -d nexus_reussite_prod \
  -c "SELECT id, status, errorCode, errorDetails FROM assessments ORDER BY createdAt DESC LIMIT 5;"
```

## 📊 Monitoring Post-Déploiement

### Métriques à Surveiller

```bash
# Nombre d'évaluations par jour
psql -h localhost -p 5433 -U nexus_user -d nexus_reussite_prod <<EOF
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
  COUNT(*) FILTER (WHERE status = 'FAILED') as failed
FROM assessments
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
EOF

# Temps moyen de génération
# (À implémenter avec des logs structurés)

# Taux d'erreur
psql -h localhost -p 5433 -U nexus_user -d nexus_reussite_prod <<EOF
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM assessments
GROUP BY status;
EOF
```

### Logs à Surveiller

```bash
# Logs de l'application
pm2 logs nexus-next-app --lines 1000 | grep -E "(BilanGenerator|Assessment)"

# Logs Ollama
docker logs infra-ollama-1 --tail 100

# Logs PostgreSQL
docker logs nexus-postgres-1 --tail 100
```

## 🔄 Rollback (si nécessaire)

Si le déploiement échoue, voici comment revenir en arrière :

```bash
# 1. Revenir au commit précédent
git reset --hard HEAD~1

# 2. Rebuild
npm run build

# 3. Redémarrer
pm2 restart nexus-next-app

# 4. Supprimer la table Assessment (ATTENTION: perte de données)
psql -h localhost -p 5433 -U nexus_user -d nexus_reussite_prod <<EOF
DROP TABLE IF EXISTS assessments CASCADE;
DROP TYPE IF EXISTS "AssessmentStatus" CASCADE;
EOF

# 5. Régénérer Prisma
npx prisma generate
```

## ✅ Checklist de Déploiement

- [ ] Migration Prisma appliquée (`npx prisma migrate deploy`)
- [ ] Client Prisma généré (`npx prisma generate`)
- [ ] Dépendances installées (`npm install`)
- [ ] Build réussi (`npm run build`)
- [ ] Service redémarré (`pm2 restart` ou `docker-compose restart`)
- [ ] Healthcheck OK (`curl /api/health`)
- [ ] Test API OK (`curl /api/assessments/test`)
- [ ] Ollama accessible (`curl http://ollama:11434/api/tags`)
- [ ] Variables d'environnement configurées
- [ ] Logs vérifiés (pas d'erreurs critiques)
- [ ] Test end-to-end réussi (soumission + génération + résultat)

## 📞 Support

En cas de problème, vérifier :
1. Les logs de l'application (`pm2 logs` ou `docker logs`)
2. Les logs PostgreSQL
3. Les logs Ollama
4. La connectivité réseau (ping ollama, ping ingestor)
5. Les ressources système (CPU, RAM, disque)

Pour plus d'informations, consulter :
- `docs/AUDIT_BILAN_PIPELINE.md` — Architecture complète
- `lib/assessments/README.md` — Documentation du module
- `lib/assessments/questions/README.md` — QuestionBank
