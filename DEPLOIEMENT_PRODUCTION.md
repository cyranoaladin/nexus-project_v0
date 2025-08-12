# 🚀 Guide de Déploiement en Production - Nexus Réussite

## ❌ Problème Identifié

En déployant l'application avec `output: 'standalone'`, les **images statiques ne s'affichaient pas** en production avec des erreurs :
- **400 Bad Request** sur les images optimisées par Next.js
- **404 Not Found** sur les images d'arrière-plan

## ✅ Solution Mise en Place

### 1. **Script de Copie Automatique des Assets**

Créé `scripts/copy-public-assets.js` qui copie automatiquement le dossier `public/` dans `.next/standalone/public/` après chaque build.

### 2. **Modification du Script Build**

```json
{
  "scripts": {
    "build": "next build && node scripts/copy-public-assets.js",
    "build:base": "next build"
  }
}
```

### 3. **Configuration Next.js Optimisée**

```javascript
// next.config.mjs
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: false, // Garder l'optimisation
    formats: ['image/webp', 'image/avif'],
  },
  // ... autres configs
};
```

## 📋 Instructions de Déploiement

### Pour le déploiement en production :

1. **Build avec copie des assets :**
```bash
npm run build
```

2. **Vérifier que les assets sont copiés :**
```bash
ls -la .next/standalone/public/images/
```

3. **Déployer le dossier `.next/standalone/` complet**

### Images clés vérifiées :
- ✅ `hero-image.png` (1763 KB)
- ✅ `BackgroundImage_EquipeStrategique.png` (1752 KB)
- ✅ `logo_slogan_nexus_x3.png` (367 KB)
- ✅ Tous les autres assets (37+ fichiers)

## 🔧 Pour le Développement Local

Le serveur de développement continue de fonctionner normalement :
```bash
npm run dev
```

## ⚠️ Points d'Attention

1. **TOUJOURS utiliser `npm run build`** (pas `npm run build:base`)
2. **Vérifier** que le dossier `public/` est inclus dans le déploiement
3. **Tester** les images avant la mise en production

## 🎯 Résultat

- ✅ Plus d'erreurs 400/404 sur les images
- ✅ Images d'arrière-plan fonctionnelles
- ✅ Optimisation Next.js conservée
- ✅ Build standalone compatible Docker

---

**Dernière mise à jour :** Août 2025
**Status :** ✅ Résolu et testé
