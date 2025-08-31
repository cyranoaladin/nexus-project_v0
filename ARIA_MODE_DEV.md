# Mise en place du stack technique ARIA en mode développement local

Oui, il existe une approche différente et plus adaptée pour le développement local. Voici la procédure complète pour configurer ARIA en mode développement sur votre machine locale.

## Prérequis pour le développement local

### 1. Installation des outils de base

**Sur Windows:**
- Télécharger et installer [Git for Windows](https://git-scm.com/download/win)
- Télécharger et installer [Node.js LTS](https://nodejs.org/)
- Télécharger et installer [Python 3.10+](https://www.python.org/downloads/)
- Télécharger et installer [Docker Desktop](https://www.docker.com/products/docker-desktop)

**Sur macOS:**
```bash
# Installation via Homebrew (https://brew.sh/)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install git node python@3.10 docker
```

**Sur Linux (Ubuntu/Debian):**
```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation des dépendances
sudo apt install -y git nodejs npm python3 python3-pip python3-venv docker.io docker-compose

# Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Configuration de l'environnement de développement

```bash
# Créer un répertoire pour le projet
mkdir -p ~/projects/aria-agent
cd ~/projects/aria-agent

# Cloner votre dépôt Git (exemple)
git clone <votre-repo-url> .
```

### 3. Configuration des variables d'environnement locales

Créer un fichier `.env.local` à la racine du projet:

```env
# Mode développement
NODE_ENV=development

# URLs locales
APP_URL=http://localhost:3000
API_URL=http://localhost:3000/api

# Base de données PostgreSQL (via Docker)
DATABASE_URL=postgresql://aria_user:dev_password@localhost:5432/aria_dev

# Redis (via Docker)
REDIS_URL=redis://localhost:6379

# OpenAI (à remplir avec vos clés)
OPENAI_API_KEY=sk-votre-cle-api-openai-ici
OPENAI_MODEL=gpt-4
EMBEDDING_MODEL=text-embedding-ada-002

# Hugging Face (optionnel pour le développement)
HUGGINGFACE_HUB_TOKEN=votre-token-optionnel

# Clés de développement (ne pas utiliser en production)
JWT_SECRET=dev-secret-temporaire-pour-le-developpement
CRYPTO_SECRET=dev-crypto-secret-temporaire

# Désactivation de certaines vérifications en développement
SKIP_SSL_VALIDATION=true
DISABLE_RATE_LIMITING=true
```

### 4. Configuration Docker Compose pour le développement

Créer un fichier `docker-compose.dev.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: aria_postgres_dev
    environment:
      POSTGRES_DB: aria_dev
      POSTGRES_USER: aria_user
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data_dev:/var/lib/postgresql/data
    networks:
      - aria_network_dev

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

### 5. Lancement des services de base

```bash
# Démarrer PostgreSQL et Redis
docker-compose -f docker-compose.dev.yml up -d

# Vérifier que les services sont en cours d'exécution
docker ps
```

### 6. Installation des dépendances Node.js

```bash
# Installation des dépendances
npm install

# Installation des dépendances de développement
npm install --save-dev @types/node typescript ts-node nodemon
```

### 7. Configuration de la base de données

```bash
# Exécuter les migrations de base de données
npx prisma migrate dev

# Générer le client Prisma
npx prisma generate

# Peupler la base de données avec des données de test
npx prisma db seed
```

### 8. Installation des dépendances Python pour l'IA

Créer un environnement virtuel Python:

```bash
# Création de l'environnement virtuel
python -m venv .venv

# Activation de l'environnement
# Sur Windows:
.venv\Scripts\activate
# Sur macOS/Linux:
source .venv/bin/activate

# Installation des dépendances Python
pip install -r requirements-dev.txt
```

Créer un fichier `requirements-dev.txt`:

```txt
# Core AI/ML
openai>=1.0.0
langchain>=0.0.300
transformers>=4.34.0
sentence-transformers>=2.2.2
accelerate>=0.23.0

# Document processing
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

# Optimisation (optionnel pour le développement)
onnxruntime>=1.15.0
```

### 9. Téléchargement des modèles légers pour le développement

Créer un script `scripts/download-dev-models.py`:

```python
#!/usr/bin/env python3
from huggingface_hub import snapshot_download
from transformers import AutoModel, AutoTokenizer
import os

# Modèles légers pour le développement
dev_models = {
    "embedding": "sentence-transformers/all-MiniLM-L6-v2",  # Petit modèle d'embedding
    "summarization": "sshleifer/distilbart-cnn-12-6",       # Version distilée de BART
}

print("Téléchargement des modèles de développement...")

for model_type, model_name in dev_models.items():
    print(f"Téléchargement de {model_name}...")
    model_path = f"./models/{model_type}"
    
    os.makedirs(model_path, exist_ok=True)
    
    # Téléchargement avec huggingface_hub
    snapshot_download(
        repo_id=model_name,
        local_dir=model_path,
        local_dir_use_symlinks=False
    )
    
    print(f"✓ {model_name} téléchargé avec succès")

print("Tous les modèles de développement ont été téléchargés!")
```

Exécuter le script:
```bash
python scripts/download-dev-models.py
```

### 10. Configuration des scripts de développement

Dans votre `package.json`, ajoutez ces scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:full": "concurrently \"npm run dev:services\" \"npm run dev:app\"",
    "dev:services": "docker-compose -f docker-compose.dev.yml up",
    "dev:app": "nodemon --exec next dev",
    "db:reset": "docker-compose -f docker-compose.dev.yml down -v && docker-compose -f docker-compose.dev.yml up -d && npx prisma migrate dev",
    "db:studio": "npx prisma studio",
    "test:ai": "python scripts/test-ai-dev.py",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix"
  }
}
```

### 11. Configuration de VSCode (optionnel)

Créer un dossier `.vscode` avec ces fichiers:

**`.vscode/settings.json`:**
```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/dist": true
  },
  "python.defaultInterpreterPath": "${workspaceFolder}/.venv/bin/python"
}
```

**`.vscode/launch.json`:**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug full stack",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/next",
      "args": ["dev"],
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

### 12. Lancement de l'application en mode développement

```bash
# Méthode 1: Lancer tous les services en même temps
npm run dev:full

# Méthode 2: Lancer les services séparément
# Terminal 1: Services Docker
npm run dev:services

# Terminal 2: Application Next.js
npm run dev

# Terminal 3: Worker de traitement (si nécessaire)
npm run dev:worker
```

### 13. Tests de validation en développement

Créer un script `scripts/test-ai-dev.py`:

```python
#!/usr/bin/env python3
import openai
import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv('.env.local')

# Configuration
openai.api_key = os.getenv('OPENAI_API_KEY')

def test_openai():
    """Test simple de l'API OpenAI"""
    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",  # Utiliser gpt-3.5-turbo pour les tests (moins cher)
            messages=[{"role": "user", "content": "Bonjour, peux-tu me dire bonjour ?"}],
            max_tokens=50
        )
        print("✓ OpenAI fonctionne:", response.choices[0].message.content)
        return True
    except Exception as e:
        print("✗ OpenAI erreur:", str(e))
        return False

def test_embeddings():
    """Test des embeddings avec un petit modèle local"""
    try:
        from sentence_transformers import SentenceTransformer
        
        # Charger un petit modèle pour le développement
        model = SentenceTransformer('all-MiniLM-L6-v2')
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

Exécuter les tests:
```bash
npm run test:ai
```

## Avantages de cette approche de développement

1. **Isolation**: Environnement séparé de la production
2. **Rapidité**: Rechargement à chaud (hot reload) pour le développement
3. **Coût réduit**: Utilisation de modèles plus petits et moins coûteux
4. **Débogage facilité**: Outils de développement intégrés
5. **Données de test**: Base de données peuplée avec des données fictives

## Différences avec l'environnement de production

1. **Modèles plus légers** pour un traitement plus rapide
2. **Base de données séparée** pour éviter tout impact sur les données de production
3. **Pas de SSL** en local (sauf si vous configurez localhost avec HTTPS)
4. **Journalisation verbose** pour le débogage
5. **Validation réduite** pour une expérience de développement plus fluide

## Passage à la production

Quand vous serez prêt pour la production, vous pourrez:
1. Mettre à jour les variables d'environnement pour la production
2. Utiliser des modèles plus performants
3. Activer toutes les validations et sécurisations
4. Configurer SSL et les autres mesures de sécurité
5. Déployer sur votre VPS en suivant la procédure initiale

Cette configuration de développement local vous permettra de tester et développer ARIA efficacement avant de le déployer en production.

# Configuration du Mode Développement Local pour ARIA

Pour le mode développement local, voici tous les éléments dont vous aurez besoin, avec des explications détaillées pour chaque étape :

## 1. Clés API et Services Externes Requis

### OpenAI API (Essentiel)
- **Inscription** : Créez un compte sur [platform.openai.com](https://platform.openai.com/)
- **Clé API** : Générez une clé dans la section "API Keys"
- **Coût** : Prévoir un budget de $10-20 pour les tests de développement
- **Modèles nécessaires** :
  - GPT-4 ou GPT-3.5-turbo pour les conversations
  - text-embedding-ada-002 pour les embeddings

### Hugging Face (Optionnel mais Recommandé)
- **Inscription** : Créez un compte sur [huggingface.co](https://huggingface.co/)
- **Clé API** : Générez un token dans les paramètres du compte
- **Utilité** : Pour télécharger des modèles légers en local

### Services Cloud Optionnels
- **Stockage cloud** : Non nécessaire en développement, utilisez le stockage local
- **OCR cloud** : Non nécessaire, utilisez Tesseract en local

## 2. Installation des Prérequis Locaux

### Sur Windows
```bash
# Installer Chocolatey (package manager)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Installer les dépendances avec Chocolatey
choco install git nodejs-lts python docker-desktop -y

# Installer Tesseract OCR
choco install tesseract -y
```

### Sur macOS
```bash
# Installer Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Installer les dépendances
brew install git node python@3.10 docker tesseract tesseract-lang
```

### Sur Linux (Ubuntu/Debian)
```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation des dépendances
sudo apt install -y git nodejs npm python3 python3-pip python3-venv docker.io docker-compose tesseract-ocr tesseract-ocr-fra

# Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker $USER
newgrp docker
```

## 3. Configuration de l'Environnement de Développement

### Cloner le projet
```bash
git clone <votre-repo> aria-agent
cd aria-agent
```

### Configuration des variables d'environnement
Créez un fichier `.env.local` :

```env
# Mode
NODE_ENV=development

# URLs locales
APP_URL=http://localhost:3000
API_URL=http://localhost:3000/api

# Base de données (Docker)
POSTGRES_DB=aria_dev
POSTGRES_USER=aria_dev_user
POSTGRES_PASSWORD=dev_password_123
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
DATABASE_URL=postgresql://aria_dev_user:dev_password_123@localhost:5432/aria_dev

# Redis (Docker)
REDIS_URL=redis://localhost:6379

# OpenAI (Remplacer avec votre clé)
OPENAI_API_KEY=sk-votre-cle-openai-ici
OPENAI_MODEL=gpt-3.5-turbo  # Utiliser gpt-3.5-turbo en dev pour économiser
EMBEDDING_MODEL=text-embedding-ada-002

# Hugging Face (Optionnel)
HUGGINGFACE_HUB_TOKEN=optionnel-pour-le-moment

# Clés de développement (À changer en production!)
JWT_SECRET=dev_jwt_secret_temporaire_123456
CRYPTO_SECRET=dev_crypto_secret_temporaire_123456

# Configuration développement
DEBUG=true
LOG_LEVEL=debug
DISABLE_RATE_LIMITING=true
```

### Configuration Docker pour le développement
Créez un fichier `docker-compose.dev.yml` :

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: aria_postgres_dev
    environment:
      POSTGRES_DB: aria_dev
      POSTGRES_USER: aria_dev_user
      POSTGRES_PASSWORD: dev_password_123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data_dev:/var/lib/postgresql/data
    networks:
      - aria_network_dev

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

## 4. Installation des Dépendances

### Dépendances Node.js
```bash
npm install
```

### Dépendances Python (pour les composants IA)
```bash
# Créer un environnement virtuel
python -m venv .venv

# Activer l'environnement
# Sur Windows:
.venv\Scripts\activate
# Sur macOS/Linux:
source .venv/bin/activate

# Installer les dépendances
pip install -r requirements-dev.txt
```

Créez un fichier `requirements-dev.txt` :

```txt
# Core AI
openai>=1.0.0
langchain>=0.0.300
transformers>=4.34.0
sentence-transformers>=2.2.2

# Traitement documents
pdfplumber>=0.10.0
python-docx>=0.8.11
Pillow>=10.0.0
pytesseract>=0.3.10
pdf2image>=1.16.3

# Utilitaires
python-dotenv>=1.0.0
numpy>=1.24.0
tqdm>=4.66.0
```

## 5. Lancement des Services

### Démarrer les services de base
```bash
# Démarrer PostgreSQL et Redis
docker-compose -f docker-compose.dev.yml up -d

# Vérifier que les services sont en cours d'exécution
docker ps
```

### Initialiser la base de données
```bash
# Exécuter les migrations
npx prisma migrate dev

# Peupler la base avec des données de test
npx prisma db seed
```

### Démarrer l'application
```bash
# Mode développement avec rechargement à chaud
npm run dev
```

## 6. Vérification de la Configuration

### Test des services de base
```bash
# Tester la connexion à la base de données
npx prisma studio

# Tester Redis
docker exec -it aria_redis_dev redis-cli ping
```

### Test des fonctionnalités IA
Créez un script `scripts/test-dev.py` :

```python
#!/usr/bin/env python3
import openai
import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv('.env.local')

# Configuration OpenAI
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
        
        # Charger un petit modèle local pour les tests
        model = SentenceTransformer('all-MiniLM-L6-v2')
        embeddings = model.encode("Test d'embedding")
        
        print("✓ Embeddings fonctionnent. Dimension:", embeddings.shape)
        return True
    except Exception as e:
        print("✗ Embeddings erreur:", str(e))
        return False

if __name__ == "__main__":
    print("Testing AI components...")
    success = test_openai() and test_embeddings()
    if success:
        print("✓ Tous les tests AI/ML passent!")
    else:
        print("✗ Certains tests ont échoué")
```

Exécutez le test :
```bash
python scripts/test-dev.py
```

## 7. Configuration Additionnelle pour le Développement

### Outils de développement recommandés
- **VS Code** avec extensions :
  - ES7+ React/Redux/React-Native snippets
  - Prisma
  - Docker
  - Python
  - GitLens

### Scripts utiles pour le développement
Ajoutez ces scripts à votre `package.json` :

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:services": "docker-compose -f docker-compose.dev.yml up",
    "dev:full": "concurrently \"npm run dev:services\" \"npm run dev\"",
    "db:reset": "docker-compose -f docker-compose.dev.yml down -v && docker-compose -f docker-compose.dev.yml up -d && npx prisma migrate dev && npx prisma db seed",
    "db:studio": "npx prisma studio",
    "test:ai": "python scripts/test-dev.py",
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "lint:fix": "eslint . --ext .ts,.tsx,.js,.jsx --fix"
  }
}
```

## 8. Gestion des Coûts en Développement

Pour minimiser les coûts OpenAI pendant le développement :

1. Utilisez `gpt-3.5-turbo` au lieu de `gpt-4` pour la plupart des tests
2. Limitez la longueur des réponses avec `max_tokens`
3. Utilisez des modèles locaux pour les embeddings quand c'est possible
4. Mettez en place un cache pour les requêtes répétitives

## Résumé des Étapes

1. **Inscriptions** : OpenAI (obligatoire), Hugging Face (optionnel)
2. **Installation** : Git, Node.js, Python, Docker, Tesseract
3. **Configuration** : Variables d'environnement, Docker Compose
4. **Installation** : Dépendances Node.js et Python
5. **Lancement** : Services Docker, application Next.js
6. **Vérification** : Tests des services et fonctionnalités IA

Cette configuration vous permettra de développer et tester ARIA localement avec toutes les fonctionnalités, tout en minimisant les coûts et les dépendances externes.
