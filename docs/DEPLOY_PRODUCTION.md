# 🚀 Deployment Guide - Production

Guide complet pour déployer Nexus Réussite en production avec Docker Compose + Nginx.

## Table des Matières

1. [Prérequis](#prérequis)
2. [Configuration](#configuration)
3. [Déploiement Initial](#déploiement-initial)
4. [Vérification](#vérification)
5. [Maintenance](#maintenance)
6. [Troubleshooting](#troubleshooting)
7. [Sécurité](#sécurité)

---

## Prérequis

### Système

- **OS**: Ubuntu 20.04+ / Debian 11+ / RHEL 8+
- **RAM**: 2GB minimum (4GB recommandé)
- **Disk**: 20GB minimum
- **CPU**: 2 cores minimum

### Logiciels Requis

```bash
# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose v2
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Verify installation
docker --version        # Should show 24.0+
docker compose version  # Should show v2.20+
```

### Domaine et DNS

- Domaine pointant vers le serveur (ex: `nexus.example.com`)
- Enregistrement A configuré dans votre DNS
- Vérification: `dig nexus.example.com +short` doit retourner l'IP du serveur

---

## Configuration

### 1. Cloner le Projet

```bash
git clone https://github.com/your-org/nexus-reussite.git
cd nexus-reussite
git checkout main  # or production branch
```

### 2. Créer `.env.production`

```bash
# Copier le template
cp .env.production.example .env.production

# Éditer avec vos valeurs RÉELLES
nano .env.production
```

**Variables OBLIGATOIRES à modifier**:

```bash
# Application URL (IMPORTANT)
NEXTAUTH_URL=https://nexus.example.com
NEXT_PUBLIC_APP_URL=https://nexus.example.com

# Secret NextAuth (générer avec: openssl rand -base64 32)
NEXTAUTH_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Database (utiliser des mots de passe forts)
POSTGRES_PASSWORD=VOTRE_MOT_DE_PASSE_FORT
DATABASE_URL=postgresql://nexus_user:VOTRE_MOT_DE_PASSE_FORT@postgres:5432/nexus_reussite_prod?schema=public

# SMTP (pour notifications email)
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=contact@nexus.example.com
SMTP_PASSWORD=VOTRE_MOT_DE_PASSE_SMTP
SMTP_FROM=Nexus Réussite <contact@nexus.example.com>
```

**Générer des secrets sécurisés**:

```bash
# NextAuth Secret (32 caractères minimum)
openssl rand -base64 32

# Postgres Password (fort)
openssl rand -hex 32

# Webhook Secret (si Konnect activé)
openssl rand -hex 32
```

### 3. Configurer Nginx

#### Option A: Let's Encrypt (Production recommandée)

```bash
# Installer certbot
sudo apt-get install certbot

# Générer les certificats (arrêter nginx temporairement)
sudo certbot certonly --standalone -d nexus.example.com

# Copier les certificats
sudo cp /etc/letsencrypt/live/nexus.example.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/nexus.example.com/privkey.pem nginx/ssl/
sudo chown $USER:$USER nginx/ssl/*.pem
chmod 600 nginx/ssl/privkey.pem
```

#### Option B: Certificats existants

```bash
# Copier vos certificats dans nginx/ssl/
cp /path/to/your/fullchain.pem nginx/ssl/
cp /path/to/your/privkey.pem nginx/ssl/
chmod 600 nginx/ssl/privkey.pem
```

#### Configurer le domaine

```bash
# Éditer nginx.conf
nano nginx/nginx.conf

# Remplacer `server_name _;` par votre domaine
server_name nexus.example.com;
```

---

## Déploiement Initial

### 1. Build et Démarrage

```bash
# Build les images (peut prendre 5-10 minutes)
docker compose -f docker-compose.prod.yml build --no-cache

# Démarrer les services
docker compose -f docker-compose.prod.yml up -d

# Vérifier les logs
docker compose -f docker-compose.prod.yml logs -f
```

**Ordre de démarrage** (automatique via `depends_on`):
1. `postgres` démarre + healthcheck
2. `nexus-app` démarre après postgres healthy
3. `nginx` démarre après nexus-app healthy

### 2. Exécuter les Migrations

```bash
# Une fois les containers démarrés
docker compose -f docker-compose.prod.yml exec nexus-app npx prisma migrate deploy

# Vérifier le statut des migrations
docker compose -f docker-compose.prod.yml exec nexus-app npx prisma migrate status
```

### 3. (Optionnel) Seed Initial

```bash
# Si vous avez un script de seed
docker compose -f docker-compose.prod.yml exec nexus-app npm run db:seed
```

---

## Vérification

### 1. Health Check

```bash
# Via curl
curl http://localhost:3000/api/health
# Devrait retourner: {"status":"ok","timestamp":"..."}

# Via navigateur (après nginx)
https://nexus.example.com/api/health
```

### 2. Vérifier les Containers

```bash
# Status des containers
docker compose -f docker-compose.prod.yml ps

# Tous doivent être "healthy" ou "running"
#   nexus-postgres-prod   healthy
#   nexus-app-prod        healthy (after 40s)
#   nexus-nginx-prod      healthy
```

### 3. Vérifier les Logs

```bash
# Logs de l'application
docker compose -f docker-compose.prod.yml logs nexus-app

# Logs nginx
docker compose -f docker-compose.prod.yml logs nginx

# Logs postgres
docker compose -f docker-compose.prod.yml logs postgres

# Follow mode (temps réel)
docker compose -f docker-compose.prod.yml logs -f nexus-app
```

### 4. Tester l'Application

```bash
# Page d'accueil
curl -I https://nexus.example.com/
# Devrait retourner: 200 OK

# API
curl https://nexus.example.com/api/health

# Tester l'authentification
# Ouvrir https://nexus.example.com/auth/signin
```

### 5. Vérifier la Sécurité

```bash
# Tester les headers de sécurité
curl -I https://nexus.example.com/ | grep -E "(Strict-Transport|X-Frame|X-Content)"

# Devrait afficher:
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
```

**Tester en ligne**:
- https://securityheaders.com/?q=nexus.example.com (Note: A ou A+)
- https://observatory.mozilla.org (Grade A)
- https://www.ssllabs.com/ssltest/ (Grade A)

---

## Maintenance

### Backup Base de Données

```bash
# Créer un backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U nexus_user nexus_reussite_prod > backup-$(date +%Y%m%d-%H%M%S).sql

# Backup automatique (cron)
# Ajouter dans crontab: crontab -e
0 2 * * * cd /path/to/nexus-reussite && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U nexus_user nexus_reussite_prod > /backups/nexus-$(date +\%Y\%m\%d).sql
```

### Restaurer une Base de Données

```bash
# Arrêter l'app
docker compose -f docker-compose.prod.yml stop nexus-app

# Restaurer
docker compose -f docker-compose.prod.yml exec -T postgres psql -U nexus_user nexus_reussite_prod < backup-20240202.sql

# Redémarrer
docker compose -f docker-compose.prod.yml start nexus-app
```

### Mise à Jour de l'Application

```bash
# Pull les derniers changements
git pull origin main

# Rebuild et redémarrer (avec downtime minimal)
docker compose -f docker-compose.prod.yml up -d --build

# Exécuter les nouvelles migrations
docker compose -f docker-compose.prod.yml exec nexus-app npx prisma migrate deploy

# Vérifier les logs
docker compose -f docker-compose.prod.yml logs -f nexus-app
```

### Redémarrage des Services

```bash
# Redémarrer tous les services
docker compose -f docker-compose.prod.yml restart

# Redémarrer un service spécifique
docker compose -f docker-compose.prod.yml restart nexus-app

# Recharger nginx sans downtime
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### Nettoyage

```bash
# Voir l'utilisation disque
docker system df

# Nettoyer les images inutilisées
docker system prune -a

# Nettoyer les volumes orphelins (ATTENTION: vérifie avant!)
docker volume prune
```

### Rotation des Logs

```bash
# Configurer logrotate
sudo nano /etc/logrotate.d/docker-nexus

# Contenu:
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  size=10M
  missingok
  delaycompress
  copytruncate
}
```

---

## Troubleshooting

### Container ne démarre pas

```bash
# Vérifier les logs détaillés
docker compose -f docker-compose.prod.yml logs nexus-app

# Vérifier la configuration
docker compose -f docker-compose.prod.yml config

# Rebuild complet
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

### Erreur "Connection refused" Database

```bash
# Vérifier que postgres est healthy
docker compose -f docker-compose.prod.yml ps postgres

# Si pas healthy, voir les logs
docker compose -f docker-compose.prod.yml logs postgres

# Vérifier la connexion manuellement
docker compose -f docker-compose.prod.yml exec postgres psql -U nexus_user nexus_reussite_prod -c "SELECT 1;"
```

### Erreur "Port already in use"

```bash
# Trouver le processus utilisant le port
sudo lsof -i :80
sudo lsof -i :443

# Arrêter le processus ou changer le port dans docker-compose.prod.yml
```

### Healthcheck échoue

```bash
# Tester manuellement le healthcheck
docker compose -f docker-compose.prod.yml exec nexus-app curl -f http://localhost:3000/api/health

# Si erreur 404: vérifier que le build est complet
docker compose -f docker-compose.prod.yml exec nexus-app ls -la .next/

# Si erreur 500: vérifier les logs
docker compose -f docker-compose.prod.yml logs nexus-app | grep ERROR
```

### Problèmes de Performance

```bash
# Vérifier l'utilisation des ressources
docker stats

# Si haute CPU/RAM:
# 1. Vérifier les logs pour des boucles infinies
# 2. Augmenter les ressources du serveur
# 3. Optimiser les requêtes DB (EXPLAIN ANALYZE)

# Analyser les requêtes lentes Postgres
docker compose -f docker-compose.prod.yml exec postgres psql -U nexus_user nexus_reussite_prod -c "SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;"
```

### SSL / HTTPS ne fonctionne pas

```bash
# Vérifier les certificats
ls -lh nginx/ssl/

# Tester la config nginx
docker compose -f docker-compose.prod.yml exec nginx nginx -t

# Vérifier les logs nginx
docker compose -f docker-compose.prod.yml logs nginx | grep error

# Renouveler certificats Let's Encrypt
sudo certbot renew
sudo cp /etc/letsencrypt/live/nexus.example.com/*.pem nginx/ssl/
docker compose -f docker-compose.prod.yml restart nginx
```

---

## Sécurité

### Checklist Sécurité Production

- [ ] `.env.production` contient des secrets uniques (pas les valeurs d'exemple)
- [ ] Certificats SSL valides (Let's Encrypt ou commercial)
- [ ] Headers sécurité configurés (HSTS, CSP, X-Frame-Options)
- [ ] Postgres NON exposé sur internet (port 5432 commenté)
- [ ] Rate limiting activé dans nginx
- [ ] Backups automatiques configurés
- [ ] Monitoring configuré (optionnel: Sentry, DataDog)
- [ ] Logs centralisés (optionnel: ELK, Loki)
- [ ] Firewall configuré (ufw/iptables)
- [ ] SSH avec clés uniquement (désactiver mot de passe)
- [ ] Updates automatiques du système

### Configurer le Firewall

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

### Monitoring (Optionnel)

```bash
# Configurer Prometheus + Grafana
# Voir: docs/MONITORING.md (à créer)

# Ou utiliser des services managés:
# - Sentry pour les erreurs
# - DataDog pour les métriques
# - LogDNA pour les logs
```

---

## Commandes Rapides

```bash
# Démarrer
docker compose -f docker-compose.prod.yml up -d

# Arrêter
docker compose -f docker-compose.prod.yml down

# Voir les logs
docker compose -f docker-compose.prod.yml logs -f

# Redémarrer un service
docker compose -f docker-compose.prod.yml restart nexus-app

# Exécuter une commande dans le container
docker compose -f docker-compose.prod.yml exec nexus-app <command>

# Migrations
docker compose -f docker-compose.prod.yml exec nexus-app npx prisma migrate deploy

# Backup DB
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U nexus_user nexus_reussite_prod > backup.sql

# Rebuild complet
docker compose -f docker-compose.prod.yml up -d --build --force-recreate
```

---

## Support

- **Documentation**: [README.md](../README.md)
- **Issues**: GitHub Issues
- **Email**: support@nexusreussite.academy

---

**Dernière mise à jour**: 2 février 2024
