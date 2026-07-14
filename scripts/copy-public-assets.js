#!/usr/bin/env node

/**
 * Script pour copier les assets publics dans le build standalone
 * Ce script résout le problème des images manquantes en production
 * avec output: 'standalone'
 */

const fs = require('fs');
const path = require('path');
const { serializeError } = require('./serialize-error.cjs');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    // Créer le dossier de destination s'il n'existe pas
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    // Copier récursivement tous les fichiers
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    // Copier le fichier
    fs.copyFileSync(src, dest);
  }
}

function main() {
  const publicDir = path.join(__dirname, '..', 'public');
  const standaloneDir = path.join(__dirname, '..', '.next', 'standalone');
  const standalonePublicDir = path.join(standaloneDir, 'public');
  const nextStaticDir = path.join(__dirname, '..', '.next', 'static');
  const standaloneNextDir = path.join(standaloneDir, '.next');
  const standaloneStaticDir = path.join(standaloneNextDir, 'static');

  console.log('🚀 Copie des assets publics pour le build standalone...');

  // Vérifier que le dossier public existe
  if (!fs.existsSync(publicDir)) {
    console.error('❌ Erreur: Le dossier public/ n\'existe pas');
    process.exit(1);
  }

  // Vérifier que le build standalone existe
  if (!fs.existsSync(standaloneDir)) {
    console.warn('⚠️  Le dossier .next/standalone n\'existe pas encore');
    console.warn('   Les assets seront disponibles via le dossier public/ standard');
    console.log('✅ Build terminé (mode standard, pas standalone)');
    process.exit(0);
  }

  try {
    // Copier le dossier public vers standalone/public
    copyRecursiveSync(publicDir, standalonePublicDir);

    // Copier également les assets Next (_next/static) indispensables aux chunks JS/CSS
    if (fs.existsSync(nextStaticDir)) {
      // Créer .next dans standalone si nécessaire
      if (!fs.existsSync(standaloneNextDir)) {
        fs.mkdirSync(standaloneNextDir, { recursive: true });
      }
      copyRecursiveSync(nextStaticDir, standaloneStaticDir);
    } else {
      console.error('❌ FATAL: .next/static is missing — next build did not produce static assets');
      process.exit(1);
    }

    // Verify the copy succeeded — standalone static must contain JS chunks
    const standaloneChunksDir = path.join(standaloneStaticDir, 'chunks');
    if (!fs.existsSync(standaloneChunksDir) || fs.readdirSync(standaloneChunksDir).filter(f => f.endsWith('.js')).length === 0) {
      console.error('❌ FATAL: standalone .next/static/chunks/ is empty after copy');
      process.exit(1);
    }

    console.log('✅ Assets publics copiés avec succès !');
    console.log(`   Source: ${publicDir}`);
    console.log(`   Destination: ${standalonePublicDir}`);

    // Vérifier que les images principales sont bien copiées
    const keyImages = [
      'images/logo_slogan_nexus.webp',
      'images/logo_nexus_reussite.png',
      'images/logo_slogan_nexus_x3.png'
    ];

    keyImages.forEach(img => {
      const imgPath = path.join(standalonePublicDir, img);
      if (fs.existsSync(imgPath)) {
        const stats = fs.statSync(imgPath);
        console.log(`   ✓ ${img} (${Math.round(stats.size / 1024)} KB)`);
      } else {
        console.warn(`   ⚠️  ${img} manquant`);
      }
    });

    // Vérifier qu'un chunk statique est bien présent
    try {
      const staticChunksDir = path.join(standaloneStaticDir, 'chunks');
      if (fs.existsSync(staticChunksDir)) {
        const entries = fs.readdirSync(staticChunksDir);
        const sample = entries.find((f) => f.endsWith('.js'));
        if (sample) {
          console.log(`   ✓ Exemple de chunk présent: chunks/${sample}`);
        }
      }
    } catch { }

  } catch (error) {
    console.error('❌ Erreur lors de la copie:', serializeError(error));
    process.exit(1);
  }
}

main();
