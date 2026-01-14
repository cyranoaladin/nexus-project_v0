# 🚀 Guide de Déploiement Complet - Nexus Réussite

## 📋 Vue d'ensemble

Ce guide vous accompagne dans le déploiement de la plateforme Nexus Réussite en production, avec toutes les configurations nécessaires pour un environnement sécurisé et performant.

## ⚠️ Prérequis

### Serveur de Production

- **OS** : Ubuntu 20.04+ ou CentOS 8+
- **RAM** : Minimum 4GB (Recommandé : 8GB)
- **Stockage** : Minimum 50GB SSD
- **CPU** : 2 vCPU minimum
- **Réseau** : IPv4 publique avec ports 80, 443, 22 ouverts

### Logiciels Requis

- **Docker** & **Docker Compose** (dernières versions)
- **Git**
- **Nginx** (si proxy inverse externe)
- **Certbot** (pour SSL Let's Encrypt)

## 🔧 Configuration des Variables d'Environnement (Consolidées)

### 1. Créer le fichier `.env.production`

```bash
# Copier le template
cp env.production .env.production

# Éditer avec vos vraies valeurs
nano .env.production
```

### 2. Variables Critiques à Modifier

```bash
# Base de données (OBLIGATOIRE)
DATABASE_URL="postgresql://nexus_user:VOTRE_MOT_DE_PASSE_SECURISE@localhost:5432/nexus_reussite_prod"
POSTGRES_PASSWORD="VOTRE_MOT_DE_PASSE_SECURISE"

# NextAuth (OBLIGATOIRE)
NEXTAUTH_URL="https://votre-domaine.com"
NEXTAUTH_SECRET="VOTRE_SECRET_32_CARACTERES_MINIMUM"

# Email SMTP (OBLIGATOIRE)
SMTP_PASSWORD="VOTRE_VRAIE_PASSWORD_HOSTINGER"

# OpenAI (OBLIGATOIRE pour ARIA)
OPENAI_API_KEY="sk-VOTRE_VRAIE_CLE_OPENAI"
OPENAI_MODEL="gpt-4o-mini" # optionnel, défaut si absent

# Konnect (OBLIGATOIRE pour les paiements)
KONNECT_API_KEY="VOTRE_VRAIE_CLE_KONNECT"
KONNECT_WALLET_ID="VOTRE_VRAI_WALLET_ID"
KONNECT_WEBHOOK_SECRET="VOTRE_VRAI_SECRET_WEBHOOK"
KONNECT_BASE_URL="https://api.konnect.network" # ou préprod

# Domaine (OBLIGATOIRE)
NEXT_PUBLIC_APP_URL="https://votre-domaine.com"

# Jitsi (visioconférence)
NEXT_PUBLIC_JITSI_SERVER_URL="https://meet.jit.si"

# Wise (affichage manuel des coordonnées)
NEXT_PUBLIC_WISE_BENEFICIARY_NAME="Nexus Réussite SARL"
NEXT_PUBLIC_WISE_IBAN="TN59 1234 5678 9012 3456 7890 12"
NEXT_PUBLIC_WISE_BIC="BANKTNTT"
NEXT_PUBLIC_WISE_ADDRESS="Adresse complète"
NEXT_PUBLIC_WISE_BANK_NAME="Banque"
```

## 🐳 Déploiement avec Docker

### 1. Cloner le Repository

```bash
git clone https://github.com/cyranoaladin/nexus-project_v0.git
cd nexus-project_v0
```

### 2. Préparer l'Environnement

```bash
# Copier et configurer les variables d'environnement
cp env.production .env.production
nano .env.production  # Modifier avec vos vraies valeurs

# Rendre les scripts exécutables
chmod +x scripts/*.js
chmod +x start-production.sh
```

### 3. Construire et Lancer

```bash
# Build et déploiement complet
docker-compose -f docker-compose.prod.yml up --build -d

# Vérifier que les services sont actifs
docker-compose -f docker-compose.prod.yml ps
```

### 4. Initialiser la Base de Données

```bash
# Entrer dans le conteneur de l'application
docker exec -it nexus-app-prod bash

# Appliquer les migrations
npx prisma migrate deploy

# Générer le client Prisma
npx prisma generate

# Sortir du conteneur
exit
```

## 🌐 Configuration SSL et Domaine

### 1. Configuration Nginx (Proxy Inverse)

Créer `/etc/nginx/sites-available/nexus-reussite` :

```nginx
server {
    listen 80;
    server_name votre-domaine.com www.votre-domaine.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name votre-domaine.com www.votre-domaine.com;

    ssl_certificate /etc/letsencrypt/live/votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-domaine.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. Certificat SSL avec Let's Encrypt

```bash
# Installer Certbot
sudo apt install certbot python3-certbot-nginx

# Obtenir le certificat
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com

# Activer le renouvellement automatique
sudo crontab -e
# Ajouter cette ligne :
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Monitoring et Maintenance

### 1. Logs de l'Application

```bash
# Voir les logs en temps réel
docker-compose -f docker-compose.prod.yml logs -f nexus-app

# Logs de la base de données
docker-compose -f docker-compose.prod.yml logs -f postgres
```

### 2. Sauvegardes Automatiques

Créer un script de sauvegarde `/opt/nexus-backup.sh` :

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/nexus"
DATE=$(date +%Y%m%d_%H%M%S)

# Créer le dossier de sauvegarde
mkdir -p $BACKUP_DIR

# Sauvegarde de la base de données
docker exec nexus-postgres-prod pg_dump -U nexus_user nexus_reussite_prod > $BACKUP_DIR/db_backup_$DATE.sql

# Sauvegarde des uploads
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz -C /var/lib/docker/volumes/nexus-project_v0_uploads_data/_data .

# Nettoyer les anciennes sauvegardes (garder 7 jours)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

### 3. Monitoring de Santé

```bash
# Vérifier l'état des services
curl -f http://localhost:3000/api/health

# Vérifier la base de données
docker exec nexus-postgres-prod pg_isready -U nexus_user
```

## 🔄 Mises à Jour

### 1. Mise à Jour du Code

```bash
# Sauvegarder avant mise à jour
./opt/nexus-backup.sh

# Récupérer les dernières modifications
git pull origin main

# Reconstruire et redéployer
docker-compose -f docker-compose.prod.yml up --build -d

# Appliquer les migrations si nécessaire
docker exec -it nexus-app-prod npx prisma migrate deploy
```

### 2. Rollback en Cas de Problème

```bash
# Revenir à la version précédente
git log --oneline  # Voir les commits
git checkout <commit-hash-précédent>

# Redéployer
docker-compose -f docker-compose.prod.yml up --build -d
```

## 🔒 Sécurité

### 1. Pare-feu

```bash
# UFW (Ubuntu)
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. Mises à Jour Système

```bash
# Automatiser les mises à jour de sécurité
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## 🆘 Dépannage

### 1. Problèmes Courants

**L'application ne démarre pas :**

```bash
# Vérifier les logs
docker-compose -f docker-compose.prod.yml logs nexus-app

# Vérifier les variables d'environnement
docker exec nexus-app-prod env | grep -E "(DATABASE_URL|NEXTAUTH)"
```

**Problèmes de base de données :**

```bash
# Réinitialiser la base de données (ATTENTION : perte de données)
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d postgres
# Attendre que postgres soit prêt, puis :
docker exec -it nexus-app-prod npx prisma migrate deploy
```

### 2. Contacts Support

- **Repository** : [https://github.com/cyranoaladin/nexus-project_v0](https://github.com/cyranoaladin/nexus-project_v0)
- **Issues** : Créer une issue sur GitHub avec les logs d'erreur

---

## ✅ Checklist de Déploiement

- [ ] Serveur configuré avec Docker et Docker Compose
- [ ] Domaine configuré et pointant vers le serveur
- [ ] Fichier `.env.production` créé avec les vraies valeurs
- [ ] Application déployée avec `docker-compose -f docker-compose.prod.yml up -d`
- [ ] Base de données initialisée avec `prisma migrate deploy`
- [ ] SSL configuré avec Let's Encrypt
- [ ] Nginx configuré comme proxy inverse
- [ ] Sauvegardes automatiques configurées
- [ ] Monitoring mis en place
- [ ] Tests de fonctionnement effectués

**🎉 Votre plateforme Nexus Réussite est maintenant déployée en production !**
