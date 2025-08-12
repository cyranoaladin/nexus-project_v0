#!/usr/bin/env node

/**
 * Script pour corriger automatiquement les termes juridiques dans les tests
 * Remplace toutes les références AEFE par des termes légalement conformes
 */

const fs = require('fs');
const path = require('path');

// Mappings de corrections
const corrections = [
  {
    from: /Élève dans un établissement AEFE/g,
    to: 'Élève dans un lycée français'
  },
  {
    from: /L'Élève Scolarisé \(AEFE\)/g,
    to: 'L\'Élève Scolarisé (Lycée français)'
  },
  {
    from: /Statut : Élève dans un établissement AEFE/g,
    to: 'Statut : Élève dans un lycée français'
  },
  {
    from: /Première-AEFE-/g,
    to: 'Première-Lycée-'
  },
  {
    from: /Terminale-AEFE-/g,
    to: 'Terminale-Lycée-'
  },
  {
    from: /Expertise AEFE/g,
    to: 'Expertise Enseignement Français'
  }
];

// Fichiers à corriger
const testFiles = [
  '__tests__/lib/diagnostic-form.test.tsx',
  '__tests__/e2e/offres-page.e2e.test.tsx',
  '__tests__/components/sections/hero-section.test.tsx',
  '__tests__/components/diagnostic-form.test.tsx',
  '__tests__/components/offres-page.test.tsx'
];

function fixFile(filePath) {
  console.log(`🔧 Correction de ${filePath}...`);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Fichier non trouvé : ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  corrections.forEach(correction => {
    if (correction.from.test(content)) {
      content = content.replace(correction.from, correction.to);
      modified = true;
      console.log(`  ✅ Appliqué : ${correction.from.source} → ${correction.to}`);
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ Fichier mis à jour : ${filePath}`);
  } else {
    console.log(`  ℹ️  Aucune correction nécessaire : ${filePath}`);
  }
}

function main() {
  console.log('🚨 CORRECTION AUTOMATIQUE DES TERMES JURIDIQUES DANS LES TESTS');
  console.log('');

  testFiles.forEach(fixFile);

  console.log('');
  console.log('✅ Correction terminée ! Tous les tests utilisent maintenant des termes légalement conformes.');
  console.log('');
  console.log('📋 Résumé des corrections appliquées :');
  console.log('  • "Élève dans un établissement AEFE" → "Élève dans un lycée français"');
  console.log('  • "L\'Élève Scolarisé (AEFE)" → "L\'Élève Scolarisé (Lycée français)"');
  console.log('  • "Première-AEFE-*" → "Première-Lycée-*"');
  console.log('  • "Terminale-AEFE-*" → "Terminale-Lycée-*"');
  console.log('  • "Expertise AEFE" → "Expertise Enseignement Français"');
}

main();
