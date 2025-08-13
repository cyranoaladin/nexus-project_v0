# 🔐 GUIDE D'AUTHENTIFICATION SSH POUR DÉPLOIEMENT

## 📋 **VOTRE CONFIGURATION VPS**

- **Serveur**: `46.202.171.14`
- **Utilisateur**: `root`
- **Dossier projet**: `/home/nexusadmin/nexus-project`
- **Sites hébergés**: `mfai.app` + `nexusreussite.academy`

---

## 🔍 **ÉTAPE 1: TEST DE CONNEXION**

Avant le déploiement, testez votre connexion SSH :

```bash
./scripts/test-ssh-connection.sh
```

Ce script vérifie :
- ✅ Connexion SSH
- ✅ Existence du dossier projet
- ✅ Configuration Git
- ✅ Node.js et PM2

---

## 🔐 **AUTHENTIFICATION SSH : 2 MÉTHODES**

### **🥇 MÉTHODE 1: Clé SSH (RECOMMANDÉE)**

#### **A. Générer une clé SSH (si vous n'en avez pas)**
```bash
ssh-keygen -t rsa -b 4096 -C "votre-email@domain.com"
```
- Appuyez sur `Entrée` pour accepter l'emplacement par défaut
- Optionnel : Définissez une phrase de passe

#### **B. Copier la clé sur le serveur**
```bash
ssh-copy-id root@46.202.171.14
```
- Entrez le mot de passe root du serveur
- La clé sera automatiquement ajoutée

#### **C. Test de connexion**
```bash
ssh root@46.202.171.14
```
- Devrait se connecter sans mot de passe

---

### **🥈 MÉTHODE 2: Mot de passe (ALTERNATIVE)**

Si vous n'avez pas de clé SSH configurée, le script utilisera l'authentification par mot de passe.

#### **Modification du script pour forcer le mot de passe :**
```bash
# Dans scripts/deploy-git-pull.sh, remplacez :
ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST

# Par :
ssh -o StrictHostKeyChecking=no -o PasswordAuthentication=yes $VPS_USER@$VPS_HOST
```

---

## 🧪 **ÉTAPE 2: TEST PRÉLIMINAIRE**

### **Test rapide de connexion :**
```bash
ssh root@46.202.171.14 "echo 'Connexion réussie !'"
```

### **Vérification du dossier projet :**
```bash
ssh root@46.202.171.14 "ls -la /home/nexusadmin/nexus-project"
```

### **Test complet avec notre script :**
```bash
./scripts/test-ssh-connection.sh
```

---

## 🚀 **ÉTAPE 3: DÉPLOIEMENT**

Une fois la connexion SSH confirmée :

```bash
./scripts/deploy-git-pull.sh
```

### **Ce que fait le script :**
1. **Se connecte** à `root@46.202.171.14`
2. **Navigue** vers `/home/nexusadmin/nexus-project`
3. **Git pull** des dernières modifications
4. **npm install** (si nécessaire)
5. **npm run build** (build de production)
6. **pm2 restart** nexus-app
7. **Vérification** du statut

---

## 🔧 **DÉPANNAGE**

### **❌ Erreur: "Permission denied (publickey)"**
```bash
# Solution 1: Utiliser mot de passe
ssh -o PasswordAuthentication=yes root@46.202.171.14

# Solution 2: Vérifier vos clés SSH
ssh-add -l

# Solution 3: Générer et copier une nouvelle clé
ssh-keygen -t rsa -b 4096
ssh-copy-id root@46.202.171.14
```

### **❌ Erreur: "Host key verification failed"**
```bash
# Supprimer l'ancienne entrée
ssh-keygen -R 46.202.171.14

# Ou ignorer la vérification (inclus dans notre script)
ssh -o StrictHostKeyChecking=no root@46.202.171.14
```

### **❌ Erreur: "Connection timeout"**
```bash
# Vérifier la connectivité
ping 46.202.171.14

# Tester avec un timeout plus long
ssh -o ConnectTimeout=30 root@46.202.171.14
```

### **❌ Erreur: "Directory not found"**
```bash
# Créer le dossier sur le VPS
ssh root@46.202.171.14 "mkdir -p /home/nexusadmin/nexus-project"

# Ou cloner le projet
ssh root@46.202.171.14
cd /home/nexusadmin
git clone https://github.com/cyranoaladin/nexus-project_v0.git nexus-project
```

---

## 📊 **VÉRIFICATION POST-DÉPLOIEMENT**

### **1. Statut de l'application :**
```bash
ssh root@46.202.171.14 "pm2 status"
```

### **2. Logs de l'application :**
```bash
ssh root@46.202.171.14 "pm2 logs nexus-app --lines 20"
```

### **3. Test HTTP :**
```bash
curl -I https://nexusreussite.academy
# Devrait retourner: HTTP/1.1 200 OK
```

### **4. Vérification des corrections juridiques :**
- Visitez `https://nexusreussite.academy`
- Vérifiez qu'il n'y a plus de mentions "AEFE"
- Confirmez les nouvelles formulations légales

---

## 🎯 **COMMANDES PRÊTES À UTILISER**

### **Test de connexion :**
```bash
./scripts/test-ssh-connection.sh
```

### **Déploiement :**
```bash
./scripts/deploy-git-pull.sh
```

### **Vérification manuelle :**
```bash
ssh root@46.202.171.14
cd /home/nexusadmin/nexus-project
git status
pm2 status
```

---

## 🎉 **RÉSULTAT ATTENDU**

Après un déploiement réussi :
- ✅ **Application mise à jour** sur `https://nexusreussite.academy`
- ✅ **Corrections juridiques** appliquées
- ✅ **Aucune mention AEFE** problématique
- ✅ **Performance maintenue**
- ✅ **PM2 en fonctionnement**

**Votre application sera juridiquement conforme et opérationnelle !**
