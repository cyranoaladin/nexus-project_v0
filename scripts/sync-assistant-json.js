#!/usr/bin/env node
/**
 * Script de synchronisation des données tarifaires pour l'outil assistant
 * Embarque data/offres-nexus.json dans un bloc <script type="application/json">
 * à inclure dans nexus_assistante_devis_v2.html
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_JSON = path.join(ROOT, 'data', 'offres-nexus.json');
const TARGET_HTML = path.join(ROOT, 'src', 'static-pages', 'nexus_assistante_devis_v2.html');
const CHECKSUM_FILE = path.join(ROOT, 'src', 'static-pages', '.nexus-offers-checksum');

function computeChecksum(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
}

function main() {
  // 1. Lire la source canonique
  if (!fs.existsSync(SOURCE_JSON)) {
    console.error('❌ Fichier source introuvable:', SOURCE_JSON);
    process.exit(1);
  }

  const sourceData = JSON.parse(fs.readFileSync(SOURCE_JSON, 'utf8'));
  const checksum = computeChecksum(sourceData);

  // 2. Vérifier si une mise à jour est nécessaire
  let currentChecksum = '';
  if (fs.existsSync(CHECKSUM_FILE)) {
    currentChecksum = fs.readFileSync(CHECKSUM_FILE, 'utf8').trim();
  }

  if (checksum === currentChecksum && fs.existsSync(TARGET_HTML)) {
    console.log('✅ Données tarifaires déjà à jour (checksum:', checksum + ')');
    process.exit(0);
  }

  // 3. Préparer le bloc JSON à embarquer
  const jsonBlock = JSON.stringify(sourceData, null, 2);
  const scriptBlock = `<script type="application/json" id="nexus-offers-json" data-checksum="${checksum}">\n${jsonBlock}\n</script>`;

  // 4. Créer ou mettre à jour le fichier HTML
  let htmlContent;
  if (fs.existsSync(TARGET_HTML)) {
    htmlContent = fs.readFileSync(TARGET_HTML, 'utf8');
    
    // Remplacer le bloc existant ou l'insérer avant </head>
    const existingBlockRegex = /<script type="application\/json" id="nexus-offers-json"[^>]*>[\s\S]*?<\/script>/;
    
    if (existingBlockRegex.test(htmlContent)) {
      htmlContent = htmlContent.replace(existingBlockRegex, scriptBlock);
      console.log('📝 Bloc JSON existant mis à jour');
    } else {
      // Insérer avant </head>
      htmlContent = htmlContent.replace('</head>', `${scriptBlock}\n</head>`);
      console.log('📝 Nouveau bloc JSON inséré dans <head>');
    }
  } else {
    // Créer le squelette HTML de base
    htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Conseil & Devis — Nexus Réussite</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Mulish:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles/nexus-tokens.css">
${scriptBlock}
<style>
/* Styles intégrés — voir nexus-tokens.css pour les variables */
</style>
</head>
<body>
<!-- Contenu généré dynamiquement -->
<script>
// Logique métier
</script>
</body>
</html>`;
    console.log('📝 Nouveau fichier HTML créé');
  }

  // 5. Écrire le fichier
  fs.writeFileSync(TARGET_HTML, htmlContent, 'utf8');
  fs.writeFileSync(CHECKSUM_FILE, checksum, 'utf8');

  console.log('✅ Synchronisation terminée');
  console.log('   Checksum:', checksum);
  console.log('   Offres:', Object.keys(sourceData).filter(k => !k.startsWith('_')).length);
  console.log('   Répères:', Object.keys(sourceData._reperes || {}).length);
}

// Lancer si exécuté directement
if (require.main === module) {
  main();
}

module.exports = { main, computeChecksum, SOURCE_JSON, TARGET_HTML };
