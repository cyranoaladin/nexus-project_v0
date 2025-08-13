### **Le Guide de Déploiement "Golden Path" pour Nexus Réussite (Mise à Jour de Production)**

**Objectif :** Déployer une nouvelle version du code depuis GitHub sur le serveur de production de manière sûre, propre et efficace.

**Philosophie :** Ce guide est basé sur le principe de la "table rase". À chaque déploiement, nous reconstruisons l'environnement à partir de zéro pour éviter tout conflit de cache ou état corrompu.

---

### **Prérequis Absolus**

1.  ✅ **Code sur GitHub :** Votre nouvelle version du code a été testée en local et poussée sur la branche `version-dev` de votre dépôt GitHub.
2.  ✅ **Accès au Serveur :** Vous avez un accès SSH à votre VPS en tant qu'utilisateur `root`.

---

### **Le Protocole de Déploiement en 7 Phases**

Exécutez cette procédure complète sur le **serveur VPS**.

#### **Phase 1 : Nettoyage Complet de l'Ancien Déploiement**

**Objectif :** Éliminer tout état corrompu et libérer les ressources. C'est la leçon la plus importante de notre expérience.

```bash
# 1.1 - Arrêter et supprimer tous les processus PM2 pour éviter les conflits
pm2 delete all
pm2 save --force

# 1.2 - S'assurer que le port 3001 est libre (tuer tout processus résiduel)
fuser -k 3001/tcp || true

# 1.3 - Supprimer complètement l'ancien dossier du projet
# IMPORTANT : Le dossier du projet est maintenant /var/www/nexus-prod
rm -rf /var/www/nexus-prod
```

#### **Phase 2 : Récupération du Nouveau Code**

**Objectif :** Obtenir une copie fraîche et propre de la dernière version du code.

```bash
# 2.1 - Cloner la branche de production propre depuis GitHub dans le bon répertoire
git clone --branch version-dev https://github.com/cyranoaladin/nexus-project_v0.git /var/www/nexus-prod

# 2.2 - Entrer dans le nouveau dossier propre
cd /var/www/nexus-prod```

#### **Phase 3 : Configuration de l'Environnement**

**Objectif :** Préparer tout ce dont l'application a besoin AVANT d'être construite.

```bash
# 3.1 - Créer le fichier des secrets (.env.local)
nano .env.local
```
**ACTION :** Dans l'éditeur, collez le contenu de votre fichier de secrets. Il doit contenir **l'URL de base de données PostgreSQL correctement encodée** (`DATABASE_URL="postgresql://...%2FKEH..."`) et le `NEXTAUTH_SECRET`. Sauvegardez avec `Ctrl+X`, `Y`, `Entrée`.

#### **Phase 4 : Installation, Synchronisation et Build**

**Objectif :** Installer les dépendances, s'assurer que la base de données est à jour, et compiler le code pour la production.

```bash
# 4.1 - Installer les dépendances Node.js
npm install

# 4.2 - Synchroniser la base de données avec le schéma de l'application (crucial)
npx dotenv -e .env.local -- npx prisma generate
npx dotenv -e .env.local -- npx prisma db push

# 4.3 - Lancer le build de production
npm run build
```

#### **Phase 5 : La "Chirurgie" du Port (Contournement Obligatoire)**

**Objectif :** Résoudre l'anomalie du build Next.js qui ignore le port 3001.

```bash
# 5.1 - Ouvrir le fichier de serveur généré par le build
nano .next/standalone/server.js
```
**ACTION :** Trouvez la ligne `const currentPort = ... || 3000` et **remplacez `3000` par `3001`**. Sauvegardez avec `Ctrl+X`, `Y`, `Entrée`.

#### **Phase 6 : Démarrage du Service avec PM2**

**Objectif :** Lancer l'application de manière fiable et persistante.

```bash
# 6.1 - Créer, remplir et rendre le script start.sh exécutable
nano start.sh
# ACTION : Collez le contenu suivant
#!/bin/sh
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | sed -e 's/"//g' | xargs -d '\n')
fi
exec node .next/standalone/server.js
# Sauvegardez, puis :
chmod +x start.sh

# 6.2 - Créer et remplir ecosystem.config.js
nano ecosystem.config.js
# ACTION : Collez le contenu suivant
module.exports = {
  apps: [{
    name: 'nexus-app',
    script: './start.sh'
  }]
};
# Sauvegardez.

# 6.3 - Démarrer l'application avec PM2
pm2 start ecosystem.config.js
pm2 save
```

#### **Phase 7 : Configuration Finale de Nginx et Permissions**

**Objectif :** S'assurer que le serveur web peut communiquer avec l'application et servir les fichiers statiques.

```bash
# 7.1 - Appliquer les permissions pour Nginx (évite les erreurs 403)
chmod 755 /var/www
chmod -R 755 /var/www/nexus-prod

# 7.2 - Vérifier que la configuration Nginx est correcte
# (Normalement, vous n'avez pas besoin de la modifier après la première installation)
# Le fichier est : /etc/nginx/sites-available/nexusreussite.academy
# Il doit contenir les locations pour /_next/static et /images pointant vers /var/www/nexus-prod
# Et le proxy_pass vers http://localhost:3001

# 7.3 - Tester et recharger Nginx
nginx -t
systemctl reload nginx
```

---

### **Validation Finale**

Une fois cette procédure terminée, accédez à **https://nexusreussite.academy**. Le site doit être entièrement fonctionnel. Inspectez la console F12 pour confirmer l'absence d'erreurs 5xx ou 4xx.

**Ce guide est votre "Source de Vérité". Imprimez-le, sauvegardez-le, et suivez-le à chaque déploiement pour une tranquillité d'esprit garantie.**
