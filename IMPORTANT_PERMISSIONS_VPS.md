# 🚨 **PERMISSIONS VPS - CRITIQUE POUR ÉVITER 403 FORBIDDEN**

## ⚠️ **ATTENTION : EXÉCUTER OBLIGATOIREMENT SUR LE VPS**

**Ces commandes sont OBLIGATOIRES après le déploiement pour éviter les erreurs 403 Forbidden** :

```bash
# IMPORTANT: Exécuter ces commandes sur le VPS pour éviter les erreurs 403 Forbidden
sudo chmod 755 /home/nexusadmin
sudo chmod -R 755 /home/nexusadmin/nexus-project

# Vérifier les permissions
ls -la /home/nexusadmin/nexus-project/
ls -la /home/nexusadmin/nexus-project/.next/static/
ls -la /home/nexusadmin/nexus-project/public/
```

## 🔍 **POURQUOI CES PERMISSIONS SONT CRITIQUES ?**

- **Nginx** tourne sous l'utilisateur `www-data`
- **Fichiers déployés** appartiennent à `nexusadmin`
- **Sans permissions 755** : Nginx ne peut pas lire les fichiers statiques
- **Résultat** : Erreurs 403 Forbidden sur tous les assets

## 🎯 **VÉRIFICATION POST-DÉPLOIEMENT**

Après avoir appliqué les permissions, testez :

```bash
# Test 1 : Fichiers statiques Next.js
curl -I http://localhost/_next/static/css/[hash].css

# Test 2 : Images publiques
curl -I http://localhost/images/logo.png

# Résultat attendu : HTTP/1.1 200 OK
```

## 🚨 **EN CAS D'OUBLI DE CES PERMISSIONS**

**Symptômes** :
- ✅ Application Next.js fonctionne
- ❌ CSS ne se charge pas
- ❌ Images ne s'affichent pas
- ❌ Erreurs 403 dans les logs Nginx

**Solution** : Exécuter les commandes chmod ci-dessus

---

**⚡ MÉMO : Ne jamais oublier ces permissions après chaque déploiement !**
