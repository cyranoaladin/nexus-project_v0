Le Guide de Déploiement "Golden Path" pour Nexus Réussite sur VPS**

**Bonjour Cursor AI,**

Votre mission est de déployer et de maintenir l'application Next.js "Nexus Réussite". Ce document est le guide de déploiement définitif, ou "Golden Path". Il est le fruit d'un processus de débogage intensif et contient les configurations, les commandes et les stratégies exactes qui ont permis de résoudre tous les problèmes rencontrés.

**En suivant ce guide à la lettre, le déploiement sera un succès.**

---

### **1. Contexte et Leçons Apprises**

*   **Application :** Next.js 14 avec `output: 'standalone'`.
*   **Environnement Cible :** VPS Ubuntu 22.04, Nginx, PM2.
*   **Base de Données :** PostgreSQL tournant dans un conteneur Docker sur le même VPS.
*   **Contraintes Clés :**
    1.  **Conflit de Port :** Une autre application utilise le port 3000. **Nexus Réussite doit impérativement tourner sur le port 3001.**
    2.  **Variables d'Environnement :** Le processus PM2 a des difficultés à lire le fichier `.env.local` de manière fiable.
    3.  **Build Next.js :** Le processus de build est sensible aux variables d'environnement et à la configuration.
    4.  **Permissions de Fichiers :** Nginx (`www-data`) a besoin de permissions explicites pour lire les fichiers du projet.

---

### **2. Les Fichiers de Configuration Clés (La "Source de Vérité")**

Voici les contenus exacts et validés des fichiers de configuration. Toute déviation de ces configurations entraînera probablement un échec.

#### **A. `package.json` (Fragment des Scripts)**

**Leçon Apprise :** La duplication de la clé "jest" bloquait `npm install`. Cette structure est la seule valide.
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "...": "..."
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "..."
  },
  "jest": {
    "setupFiles": ["<rootDir>/jest.setup.js"]
  }
}
```

#### **B. `next.config.mjs`**

**Leçons Apprises :**
1.  La directive `experimental.serverComponentsExternalPackages` est **cruciale** pour que Prisma fonctionne en mode `standalone`.
2.  Le service d'images de Next.js était instable. Le désactiver avec `unoptimized: true` est la solution la plus robuste pour éviter les erreurs `400 Bad Request`.

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

#### **C. `.env.local` (Modèle - à créer sur le serveur)**

**Leçons Apprises :**
1.  Le `NEXTAUTH_SECRET` manquant provoquait un crash au démarrage (erreur 502).
2.  L'URL de la base de données doit pointer vers `localhost` (et non `postgres-db`).
3.  Le mot de passe de la base de données, s'il contient des caractères spéciaux comme `/`, doit être **encodé en URL** ( `/` devient `%2F`).

```
# CE FICHIER NE DOIT JAMAIS ÊTRE SUR GITHUB

# --- Base de Données ---
# IMPORTANT : Le mot de passe est encodé en URL (le / initial est devenu %2F)
DATABASE_URL="postgresql://nexususer:%2FKEHvah8zXwFT6WUppmSvKqToOEUcJmyctkwiRnTdr0=@localhost:5432/nexusdb?schema=public"

# --- Authentification (NextAuth.js) ---
# CRUCIAL : L'absence de cette clé fait planter l'application
NEXTAUTH_SECRET="5zv9FnynBRIIG1XUnGHn+QPRbE/UMFSA+wcePzsiogE="
NEXTAUTH_URL="https://nexusreussite.academy"

# --- Autres Clés ---
OPENAI_API_KEY="sk-..."
SMTP_HOST="smtp.hostinger.com"
# ...etc
```

#### **D. `start.sh` (Le script de démarrage infaillible)**

**Leçon Apprise :** C'est la méthode la plus fiable pour garantir que les variables du `.env.local` sont chargées avant le démarrage de l'application.

```bash
#!/bin/sh
# Ce script charge les variables d'environnement depuis .env.local et lance le serveur

# Exporter chaque ligne du .env.local comme une variable d'environnement
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | sed -e 's/"//g' | xargs -d '\n')
fi

# Lancer le serveur node sur le port 3001
# Note : Le port est codé en dur dans .next/standalone/server.js
exec node .next/standalone/server.js
```

#### **E. `ecosystem.config.js` (pour PM2)**

**Leçon Apprise :** La configuration la plus simple est la meilleure. On dit à PM2 de simplement exécuter notre script de démarrage `start.sh`.

```javascript
module.exports = {
  apps: [{
    name: 'nexus-app',
    script: './start.sh'
  }]
};
```

#### **F. Configuration Nginx (`/etc/nginx/sites-available/nexusreussite.academy`)**

**Leçons Apprises :**
1.  Il faut une `location` spécifique pour les assets `/_next/static`.
2.  Il faut une `location` spécifique pour les fichiers publics (`/images`, `/favicon.ico`, etc.).
3.  Toutes les autres requêtes doivent être redirigées vers l'application sur le port **3001**.

```nginx
server {
    server_name nexusreussite.academy www.nexusreussite.academy;

    # Règle pour les fichiers statiques du build (CSS, JS)
    location /_next/static {
        alias /home/nexusadmin/nexus-project/.next/static;
        expires 1y;
        access_log off;
    }

    # Règle pour les images et autres fichiers du dossier /public
    location ~ ^/(images/|favicon\.ico|.*\.svg|.*\.png|.*\.jpg|.*\.jpeg|.*\.gif) {
        alias /home/nexusadmin/nexus-project/public$request_uri;
        expires 1y;
        access_log off;
    }

    # Toutes les autres requêtes vont à l'application Next.js
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # ... Configuration SSL gérée par Certbot ...
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    # ... etc
}
# ... Bloc server pour la redirection HTTP vers HTTPS ...
```

---

### **3. Le Processus de Déploiement Complet (Commandes Prêtes à l'Emploi)**

Exécutez ces commandes sur le **serveur VPS**.

#### **Phase A : Récupération du Code Propre**

```bash
# Aller dans le dossier parent
cd /home/nexusadmin

# (Optionnel mais recommandé) Supprimer l'ancien dossier pour éviter tout conflit de cache
rm -rf nexus-project

# Cloner la branche de production propre depuis GitHub
git clone --branch version-dev https://github.com/cyranoaladin/nexus-project_v0.git nexus-project

# Entrer dans le nouveau dossier
cd nexus-project
```

#### **Phase B : Configuration de l'Environnement**

```bash
# Créer le fichier des secrets
nano .env.local
# ACTION : Collez le contenu du modèle .env.local (avec les vraies clés et l'URL de DB encodée)

# Créer le script de démarrage
nano start.sh
# ACTION : Collez le contenu du script start.sh

# Rendre le script exécutable
chmod +x start.sh

# Créer la configuration PM2
nano ecosystem.config.js
# ACTION : Collez le contenu du fichier ecosystem.config.js
```

#### **Phase C : Installation et Build**

```bash
# Installer les dépendances
npm install

# Lancer le build de production
npm run build
```

#### **Phase D : La "Chirurgie" du Port (Étape de Contournement Cruciale)**

**Leçon Apprise :** Le build Next.js ignore parfois les variables de port. Cette modification manuelle est la garantie absolue.

```bash
# Ouvrir le fichier de serveur généré
nano .next/standalone/server.js
```
**ACTION :** Trouvez la ligne `const currentPort = ... || 3000` et remplacez `3000` par `3001`.

#### **Phase E : Permissions et Services**

```bash
# Appliquer les permissions pour Nginx (évite les erreurs 403)
chmod 755 /home/nexusadmin
chmod -R 755 /home/nexusadmin/nexus-project

# Mettre à jour la configuration Nginx
nano /etc/nginx/sites-available/nexusreussite.academy
# ACTION : Assurez-vous que le contenu correspond au modèle Nginx ci-dessus

# Tester et recharger Nginx
nginx -t
systemctl reload nginx

# Démarrer l'application avec PM2
pm2 start ecosystem.config.js

# Sauvegarder la configuration PM2 pour les redémarrages automatiques
pm2 save
```

---

### **4. Guide de Dépannage Rapide**

*   **Si `npm install` échoue :** Vérifiez la syntaxe du `package.json`.
*   **Si `502 Bad Gateway` :** L'application plante. Exécutez `./start.sh` manuellement pour voir l'erreur. C'est probablement une variable manquante dans `.env.local`.
*   **Si `500 Internal Server Error` :** L'application tourne mais une route plante. C'est presque toujours un problème avec la `DATABASE_URL`. Vérifiez l'encodage.
*   **Si `404` sur les images :** Vérifiez les chemins dans la configuration Nginx et les permissions.
*   **Si `403` sur les images :** Exécutez les commandes `chmod`.

Ce guide représente la somme de toutes nos découvertes. En le suivant, le déploiement sera un succès.
