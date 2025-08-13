# 🚀 GUIDE DE DÉPLOIEMENT INCRÉMENTAL VPS

## 📋 **SITUATION ACTUELLE**

Vous avez pushé les corrections juridiques sur GitHub et voulez maintenant déployer **uniquement les fichiers modifiés** sur votre VPS.

### **📊 Fichiers Modifiés (15 fichiers)**
```bash
# Corrections juridiques principales (9 fichiers)
app/equipe/page.tsx
app/offres/page.tsx
components/sections/hero-section.tsx
components/sections/pillars-section.tsx
components/sections/problem-solution-section.tsx
components/sections/comparison-table-section.tsx
components/ui/diagnostic-form.tsx
components/ui/faq-section.tsx
Profils_intevenants_Nexus.md

# Tests corrigés (4 fichiers)
__tests__/components/diagnostic-form.test.tsx
__tests__/components/sections/hero-section.test.tsx
__tests__/e2e/offres-page.e2e.test.tsx
__tests__/lib/diagnostic-form.test.tsx

# Documentation (2 nouveaux fichiers)
RAPPORT_CONFORMITE_JURIDIQUE.md
scripts/fix-legal-terms-tests.js
```

---

## 🎯 **3 MÉTHODES DE DÉPLOIEMENT**

### **🥇 MÉTHODE 1: Git Pull (RECOMMANDÉE)**

**Avantages**: Simple, fiable, garde l'historique Git
```bash
# 1. Configurer les paramètres VPS dans le script
nano scripts/deploy-git-pull.sh
# Modifier: VPS_USER, VPS_HOST

# 2. Exécuter le déploiement
./scripts/deploy-git-pull.sh
```

**Ce que fait le script**:
- ✅ Se connecte au VPS
- ✅ `git pull origin version-dev`
- ✅ `npm install` (si nécessaire)
- ✅ `npm run build`
- ✅ `pm2 restart nexus-app`

---

### **🥈 MÉTHODE 2: Rsync Intelligent**

**Avantages**: Synchronise uniquement les fichiers modifiés
```bash
# 1. Configurer les paramètres VPS
nano scripts/deploy-incremental.sh
# Modifier: VPS_USER, VPS_HOST, VPS_PATH

# 2. Exécuter le déploiement
./scripts/deploy-incremental.sh
```

**Ce que fait le script**:
- ✅ Liste les fichiers modifiés avec `git diff`
- ✅ Synchronise via `rsync --files-from`
- ✅ Rebuild et redémarre automatiquement

---

### **🥉 MÉTHODE 3: SCP Fichier par Fichier**

**Avantages**: Contrôle total, débogage facile
```bash
# 1. Configurer les paramètres VPS
nano scripts/deploy-files-only.sh
# Modifier: VPS_USER, VPS_HOST, VPS_PATH

# 2. Exécuter le déploiement
./scripts/deploy-files-only.sh
```

---

## 🛠️ **CONFIGURATION PRÉALABLE**

### **1. Paramètres VPS à Modifier**
Dans chaque script, modifiez ces variables :
```bash
VPS_USER="nexusadmin"           # Votre nom d'utilisateur VPS
VPS_HOST="votre-serveur.com"    # IP ou domaine de votre VPS
VPS_PATH="/home/nexusadmin/nexus-project"  # Chemin du projet
```

### **2. Vérification SSH**
Testez votre connexion SSH :
```bash
ssh nexusadmin@votre-serveur.com
```

---

## ⚡ **DÉPLOIEMENT RAPIDE (RECOMMANDÉ)**

### **Option A: Git Pull Direct**
```bash
# Sur votre machine locale
./scripts/deploy-git-pull.sh
```

### **Option B: Commandes Manuelles**
```bash
# 1. Connexion au VPS
ssh nexusadmin@votre-serveur.com

# 2. Sur le VPS
cd /home/nexusadmin/nexus-project
git pull origin version-dev
npm run build
pm2 restart nexus-app
pm2 status
```

---

## 📊 **VÉRIFICATION POST-DÉPLOIEMENT**

### **1. Statut de l'Application**
```bash
ssh nexusadmin@votre-serveur.com "pm2 status"
```

### **2. Logs de l'Application**
```bash
ssh nexusadmin@votre-serveur.com "pm2 logs nexus-app --lines 50"
```

### **3. Test de l'Application**
```bash
curl -I https://nexusreussite.academy
# Devrait retourner: HTTP/1.1 200 OK
```

---

## 🔍 **VÉRIFICATION DES CORRECTIONS JURIDIQUES**

Après le déploiement, vérifiez que les corrections sont appliquées :

### **Pages à Tester**:
1. **Homepage** (`/`) : Vérifier "Expertise Enseignement Français"
2. **Page Équipe** (`/equipe`) : Vérifier les profils sans "AEFE"
3. **Page Offres** (`/offres`) : Vérifier "Lycée français"
4. **Diagnostic Form** : Tester le formulaire avec nouvelle terminologie

### **Éléments à Vérifier**:
- ❌ Aucune mention "AEFE" visible
- ✅ "Enseignement français à l'étranger"
- ✅ "Lycées français à l'étranger"
- ✅ Fonctionnalités préservées

---

## 🚨 **DÉPANNAGE**

### **Erreur de Connexion SSH**
```bash
# Vérifier la clé SSH
ssh-add -l
# Ou utiliser mot de passe
ssh -o PasswordAuthentication=yes nexusadmin@votre-serveur.com
```

### **Erreur PM2**
```bash
# Sur le VPS
pm2 kill
pm2 start ecosystem.config.js
```

### **Erreur de Build**
```bash
# Sur le VPS
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

---

## 🎉 **RÉSULTAT ATTENDU**

Après un déploiement réussi :
- ✅ **Application mise à jour** avec corrections juridiques
- ✅ **Aucune référence AEFE** problématique
- ✅ **Formulations légales** partout
- ✅ **Fonctionnalités préservées**
- ✅ **Performance maintenue**

**🔗 Votre application sera accessible sur : `https://nexusreussite.academy`**

---

## 📝 **COMMANDE RECOMMANDÉE**

**Pour un déploiement rapide et sûr** :
```bash
./scripts/deploy-git-pull.sh
```

Cette méthode est la plus fiable et maintient la cohérence avec votre dépôt GitHub.
