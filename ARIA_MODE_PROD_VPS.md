# Mise en place concrète du stack technique ARIA sur VPS

## Prérequis et Inscriptions Nécessaires

### 1. Inscriptions et Configurations Préalables

**OpenAI API:**
1. Créer un compte sur [platform.openai.com](https://platform.openai.com)
2. Ajouter une méthode de paiement (carte de crédit)
3. Générer une clé API dans la section "API Keys"
4. Noter le coût estimé:
   - GPT-4: ~$0.03/1K tokens en entrée, ~$0.06/1K tokens en sortie
   - Embeddings: ~$0.0004/1K tokens
   - Prévoir un budget initial de $50-100 pour les tests

**Hugging Face:**
1. Créer un compte sur [huggingface.co](https://huggingface.co)
2. Générer un token d'accès dans les paramètres
3. Pour les modèles gated, accepter les conditions d'utilisation

**Services Cloud Optionnels:**
- AWS S3/MinIO pour le stockage (si nécessaire)
- Cloudflare pour le CDN et la protection DDoS

## Configuration Détaillée du VPS

### 1. Préparation du Serveur

```bash
# Se connecter au VPS
ssh root@46.202.171.14

# Mise à jour du système
apt update && apt upgrade -y

# Installation des dépendances de base
apt install -y curl wget git build-essential libssl-dev libffi-dev python3-dev python3-pip python3-venv nginx certbot python3-certbot-nginx

# Installation de Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Installation de Docker Compose
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```

### 2. Configuration de l'Environnement

```bash
# Création de la structure de répertoires
mkdir -p /opt/aria/{data,models,logs,config}
cd /opt/aria

# Cloner le repository (à adapter avec votre repo)
git clone https://github.com/votre-org/aria-project .
```

### 3. Configuration des Variables d'Environnement

Créer le fichier `/opt/aria/.env`:

```env
# OpenAI
OPENAI_API_KEY=sk-votre-cle-api-openai
OPENAI_MODEL=gpt-4
EMBEDDING_MODEL=text-embedding-ada-002

# Hugging Face
HUGGINGFACE_HUB_TOKEN=votre-token-huggingface
HF_MODEL=google/flan-t5-large

# Base de données
POSTGRES_DB=aria_db
POSTGRES_USER=aria_user
POSTGRES_PASSWORD=votre-mot-de-passe-super-securise
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Redis
REDIS_URL=redis://localhost:6379

# Configuration de l'application
NODE_ENV=production
PORT=3000
API_URL=https://mfai.app/api
CLIENT_URL=https://mfai.app

# Sécurité
JWT_SECRET=votre-secret-jwt-tres-long-et-complexe
CRYPTO_SECRET=votre-secret-crypto

# Stockage (optionnel)
AWS_ACCESS_KEY_ID=votre-cle-aws
AWS_SECRET_ACCESS_KEY=votre-secret-aws
S3_BUCKET=aria-storage
```

## Installation des Composants IA/ML

### 1. Installation de Python et des Dépendances

```bash
# Création de l'environnement virtuel
python3 -m venv /opt/aria/venv
source /opt/aria/venv/bin/activate

# Installation des packages de base
pip install --upgrade pip
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

### 2. Installation des Bibliothèques Spécifiques

```bash
# Installation des bibliothèques core
pip install openai langchain transformers sentence-transformers faiss-cpu

# Installation des dépendances pour le traitement des documents
pip install pdfplumber python-docx Pillow pytesseract pdf2image

# Installation des bibliothèques supplémentaires
pip install unstructured sentencepiece protobuf

# Installation pour l'optimisation
pip install onnxruntime onnx
```

### 3. Téléchargement des Modèles

Créer un script `/opt/aria/scripts/download_models.py`:

```python
#!/usr/bin/env python3
from huggingface_hub import snapshot_download
from transformers import AutoModel, AutoTokenizer
import os

# Configuration des modèles à télécharger
models = {
    "embedding": "sentence-transformers/all-MiniLM-L6-v2",
    "summarization": "facebook/bart-large-cnn",
    "classification": "distilbert-base-uncased-finetuned-sst-2-english"
}

# Téléchargement des modèles
for model_type, model_name in models.items():
    print(f"Téléchargement de {model_name}...")
    model_path = f"/opt/aria/models/{model_type}"
    
    # Téléchargement avec huggingface_hub
    snapshot_download(
        repo_id=model_name,
        local_dir=model_path,
        local_dir_use_symlinks=False
    )
    
    # Chargement pour vérification
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_path)
        model = AutoModel.from_pretrained(model_path)
        print(f"✓ {model_name} téléchargé avec succès")
    except Exception as e:
        print(f"✗ Erreur avec {model_name}: {str(e)}")
```

Exécuter le script:
```bash
python /opt/aria/scripts/download_models.py
```

## Configuration de Docker Compose

Créer le fichier `/opt/aria/docker-compose.yml`:

```yaml
version: '3.8'

services:
  # Base de données PostgreSQL
  postgres:
    image: postgres:15
    container_name: aria_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./config/postgresql.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    ports:
      - "5432:5432"
    networks:
      - aria_network

  # Redis pour la mise en cache et les queues
  redis:
    image: redis:7-alpine
    container_name: aria_redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - aria_network

  # Application principale
  app:
    build: .
    container_name: aria_app
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    volumes:
      - ./:/app
      - /opt/aria/models:/app/models
      - /opt/aria/data:/app/data
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    networks:
      - aria_network
    command: npm start

  # Worker pour le processing des files
  worker:
    build: .
    container_name: aria_worker
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - WORKER=true
    volumes:
      - ./:/app
      - /opt/aria/models:/app/models
      - /opt/aria/data:/app/data
    depends_on:
      - postgres
      - redis
    networks:
      - aria_network
    command: npm run worker

volumes:
  postgres_data:
  redis_data:

networks:
  aria_network:
    driver: bridge
```

## Configuration Nginx

Créer le fichier `/etc/nginx/sites-available/mfai.app`:

```nginx
server {
    listen 80;
    server_name mfai.app www.mfai.app;
    
    # Redirection vers HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mfai.app www.mfai.app;
    
    # Certificats SSL (à générer avec Certbot)
    ssl_certificate /etc/letsencrypt/live/mfai.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mfai.app/privkey.pem;
    
    # Configuration SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Logs
    access_log /var/log/nginx/mfai.app.access.log;
    error_log /var/log/nginx/mfai.app.error.log;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Proxy vers l'application
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
    
    # Service Worker et assets
    location /_next/static/ {
        alias /opt/aria/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Activer la configuration:
```bash
ln -s /etc/nginx/sites-available/mfai.app /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## Configuration SSL avec Certbot

```bash
# Obtenir le certificat SSL
certbot --nginx -d mfai.app -d www.mfai.app

# Configurer le renouvellement automatique
echo "0 12 * * * root certbot renew --quiet" >> /etc/crontab
```

## Déploiement de l'Application

### 1. Construction et Lancement

```bash
cd /opt/aria

# Construction des images Docker
docker-compose build

# Lancement des services
docker-compose up -d

# Vérification des logs
docker-compose logs -f
```

### 2. Configuration des Tâches Planifiées

Créer un cron pour les tâches de maintenance:

```bash
# Éditer le crontab
crontab -e

# Ajouter les tâches suivantes
0 2 * * * docker exec aria_app npm run cleanup
0 3 * * * docker exec aria_app npm run backup
0 4 * * 0 docker exec aria_app npm run update-models
```

### 3. Surveillance et Monitoring

```bash
# Installation de monitoring de base
apt install -y htop glances

# Surveillance des ressources
glances

# Surveillance des logs en temps réel
tail -f /opt/aria/logs/app.log
```

## Tests de Validation

### 1. Test des Services

```bash
# Test de la base de données
docker exec aria_postgres psql -U aria_user -d aria_db -c "SELECT version();"

# Test de Redis
docker exec aria_redis redis-cli ping

# Test de l'application
curl -X GET https://mfai.app/api/health
```

### 2. Test des Fonctionnalités IA

Créer un script de test `/opt/aria/scripts/test_ai.py`:

```python
#!/usr/bin/env python3
import openai
import os
from langchain.llms import OpenAI
from transformers import pipeline

# Configuration
openai.api_key = os.getenv('OPENAI_API_KEY')

# Test OpenAI
def test_openai():
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Bonjour, peux-tu me dire bonjour ?"}]
        )
        print("✓ OpenAI fonctionne:", response.choices[0].message.content)
    except Exception as e:
        print("✗ OpenAI erreur:", str(e))

# Test Hugging Face
def test_huggingface():
    try:
        classifier = pipeline('sentiment-analysis')
        result = classifier('Je suis très content !')
        print("✓ Hugging Face fonctionne:", result)
    except Exception as e:
        print("✗ Hugging Face erreur:", str(e))

if __name__ == "__main__":
    test_openai()
    test_huggingface()
```

Exécuter le test:
```bash
python /opt/aria/scripts/test_ai.py
```

## Sécurisation Avancée

### 1. Configuration du Firewall

```bash
# Installation et configuration d'UFW
apt install -y ufw

ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw enable
```

### 2. Sécurisation de Docker

```bash
# Création d'un utilisateur dédié
adduser aria-user
usermod -aG docker aria-user

# Configuration des limites de ressources pour Docker
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << EOF
{
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  },
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
```

### 3. Sauvegardes Automatisées

Créer un script de sauvegarde `/opt/aria/scripts/backup.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/aria/backups/$DATE"

mkdir -p $BACKUP_DIR

# Sauvegarde de la base de données
docker exec aria_postgres pg_dump -U aria_user aria_db > $BACKUP_DIR/db_backup.sql

# Sauvegarde des modèles IA
tar -czf $BACKUP_DIR/models.tar.gz /opt/aria/models/

# Sauvegarde des données de l'application
tar -czf $BACKUP_DIR/data.tar.gz /opt/aria/data/

# Synchronisation avec cloud (optionnel)
# aws s3 sync $BACKUP_DIR s3://votre-bucket/backups/$DATE/

# Nettoyage des vieilles sauvegardes (conserver 7 jours)
find /opt/aria/backups/* -type d -ctime +7 -exec rm -rf {} \;
```

Rendre le script exécutable:
```bash
chmod +x /opt/aria/scripts/backup.sh
```

## Monitoring des Coûts

### 1. Surveillance de l'Utilisation OpenAI

Créer un script de monitoring des coûts:

```python
#!/usr/bin/env python3
import openai
import os
from datetime import datetime, timedelta

openai.api_key = os.getenv('OPENAI_API_KEY')

def get_usage():
    try:
        # Récupérer l'utilisation du mois en cours
        today = datetime.now()
        first_day = today.replace(day=1)
        
        usage = openai.Usage.retrieve(
            start_date=first_day.strftime('%Y-%m-%d'),
            end_date=today.strftime('%Y-%m-%d')
        )
        
        print(f"Utilisation OpenAI pour {today.strftime('%B %Y')}:")
        print(f"Tokens d'entrée: {usage['usage'][0]['prompt_tokens']}")
        print(f"Tokens de sortie: {usage['usage'][0]['completion_tokens']}")
        print(f"Total tokens: {usage['usage'][0]['total_tokens']}")
        
        # Estimation des coûts (approximatif)
        cost = (usage['usage'][0]['prompt_tokens'] * 0.03 + 
                usage['usage'][0]['completion_tokens'] * 0.06) / 1000
        print(f"Coût estimé: ${cost:.2f}")
        
    except Exception as e:
        print("Erreur lors de la récupération de l'utilisation:", str(e))

if __name__ == "__main__":
    get_usage()
```

## Conclusion

Cette configuration complète permet de déployer ARIA sur votre VPS avec:

1. **Tous les composants IA/ML** configurés et opérationnels
2. **Une infrastructure sécurisée** avec Docker et Nginx
3. **Des sauvegardes automatisées** pour la persistance des données
4. **Un monitoring des coûts** pour contrôler les dépenses OpenAI
5. **Une configuration optimisée** pour les ressources du VPS

Les coûts mensuels estimés:
- VPS: 22,99 €/mois
- OpenAI: variable selon l'usage (budgeter 50-100 €/mois initialement)
- Stockage: inclus dans le VPS

Prochaines étapes recommandées:
1. Tester chaque composant individuellement
2. Configurer un système de monitoring plus avancé (Prometheus/Grafana)
3. Mettre en place un système de logs centralisé
4. Configurer des alertes pour les dépassements de budget OpenAI
