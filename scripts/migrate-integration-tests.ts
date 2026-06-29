#!/usr/bin/env tsx
/**
 * Script de Migration Automatique des Tests d'Intégration
 * 
 * Ce script analyse les tests existants et suggère/applique les migrations
 * pour utiliser les nouveaux helpers et éviter les violations de contraintes.
 */

import * as fs from 'fs';
import * as path from 'path';
import { serializeError } from '@/lib/utils/serialize-error';

interface TestFile {
  path: string;
  content: string;
  issues: string[];
  suggestions: string[];
}

const TESTS_DIR = path.join(__dirname, '../__tests__');

// Patterns à détecter
const PATTERNS = {
  hardcodedEmail: /email:\s*['"](?!.*\$\{)[^'"]*@[^'"]*['"]/g,
  hardcodedExternalId: /externalId:\s*['"][^'"]*['"]/g,
  hardcodedPseudonym: /pseudonym:\s*['"][^'"]*['"]/g,
  manualCleanup: /beforeEach.*deleteMany|afterEach.*deleteMany/g,
  prismaCreate: /prisma\.\w+\.create/g,
  sessionBooking: /SessionBooking|sessionBooking/g,
};

function analyzeFile(filePath: string): TestFile | null {
  if (!filePath.endsWith('.test.ts') && !filePath.endsWith('.test.tsx')) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Détecter emails hardcodés
  const hardcodedEmails = content.match(PATTERNS.hardcodedEmail);
  if (hardcodedEmails && hardcodedEmails.length > 0) {
    issues.push(`${hardcodedEmails.length} email(s) hardcodé(s) détecté(s)`);
    suggestions.push('Utiliser uniqueEmail() ou createUniqueUserData()');
  }

  // Détecter externalIds hardcodés
  const hardcodedExternalIds = content.match(PATTERNS.hardcodedExternalId);
  if (hardcodedExternalIds && hardcodedExternalIds.length > 0) {
    issues.push(`${hardcodedExternalIds.length} externalId(s) hardcodé(s) détecté(s)`);
    suggestions.push('Utiliser uniqueExternalId() ou createUniquePaymentData()');
  }

  // Détecter pseudonyms hardcodés
  const hardcodedPseudonyms = content.match(PATTERNS.hardcodedPseudonym);
  if (hardcodedPseudonyms && hardcodedPseudonyms.length > 0) {
    issues.push(`${hardcodedPseudonyms.length} pseudonym(s) hardcodé(s) détecté(s)`);
    suggestions.push('Utiliser uniquePseudonym()');
  }

  // Détecter cleanup manuel
  const manualCleanup = content.match(PATTERNS.manualCleanup);
  if (manualCleanup && manualCleanup.length > 0) {
    issues.push('Cleanup manuel détecté');
    suggestions.push('Supprimer cleanup manuel - setup.ts le fait automatiquement');
  }

  // Détecter SessionBooking (risque overlap)
  const sessionBookings = content.match(PATTERNS.sessionBooking);
  if (sessionBookings && sessionBookings.length > 0) {
    issues.push('SessionBooking détecté - risque overlap');
    suggestions.push('Utiliser createUniqueSessionData() avec slotIndex différent');
  }

  // Vérifier si le fichier importe déjà les helpers
  const hasHelperImport = content.includes('from \'../helpers/test-data\'') || 
                          content.includes('from "../helpers/test-data"');
  const hasSetupImport = content.includes('from \'../setup\'') || 
                         content.includes('from "../setup"');

  if (issues.length > 0 && !hasHelperImport) {
    suggestions.push('Ajouter: import { ... } from \'../helpers/test-data\'');
  }

  if (issues.length > 0 && !hasSetupImport && content.includes('prisma.')) {
    suggestions.push('Ajouter: import { prisma } from \'../setup\'');
  }

  if (issues.length === 0) {
    return null;
  }

  return {
    path: filePath,
    content,
    issues,
    suggestions,
  };
}

function scanDirectory(dir: string): TestFile[] {
  const results: TestFile[] = [];

  function scan(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, .next, etc.
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scan(fullPath);
        }
      } else if (entry.isFile()) {
        const analysis = analyzeFile(fullPath);
        if (analysis) {
          results.push(analysis);
        }
      }
    }
  }

  scan(dir);
  return results;
}

function generateReport(files: TestFile[]): string {
  let report = '# Rapport de Migration des Tests d\'Intégration\n\n';
  report += `Date: ${new Date().toISOString()}\n\n`;
  report += `## Résumé\n\n`;
  report += `- **Fichiers analysés**: ${files.length} fichiers nécessitent une migration\n`;
  
  const totalIssues = files.reduce((sum, f) => sum + f.issues.length, 0);
  report += `- **Problèmes détectés**: ${totalIssues}\n\n`;

  report += `## Détails par Fichier\n\n`;

  for (const file of files) {
    const relativePath = path.relative(TESTS_DIR, file.path);
    report += `### ${relativePath}\n\n`;
    
    report += `**Problèmes:**\n`;
    for (const issue of file.issues) {
      report += `- ❌ ${issue}\n`;
    }
    
    report += `\n**Suggestions:**\n`;
    for (const suggestion of file.suggestions) {
      report += `- ✅ ${suggestion}\n`;
    }
    
    report += '\n---\n\n';
  }

  report += `## Actions Recommandées\n\n`;
  report += `1. Lire le guide de migration: \`__tests__/MIGRATION_GUIDE.md\`\n`;
  report += `2. Migrer les fichiers un par un en suivant les suggestions\n`;
  report += `3. Tester chaque fichier après migration: \`npm run test:integration -- path/to/file.test.ts\`\n`;
  report += `4. Vérifier que tous les tests passent: \`npm run test:integration\`\n\n`;

  report += `## Priorités de Migration\n\n`;
  report += `1. **Haute priorité**: Fichiers avec emails/externalIds hardcodés (duplicates)\n`;
  report += `2. **Moyenne priorité**: Fichiers avec SessionBooking (overlaps)\n`;
  report += `3. **Basse priorité**: Fichiers avec cleanup manuel (performance)\n\n`;

  return report;
}

async function main() {
  console.log('🔍 Analyse des tests d\'intégration...\n');

  const problematicFiles = scanDirectory(TESTS_DIR);

  if (problematicFiles.length === 0) {
    console.log('✅ Aucun problème détecté dans les tests!');
    console.log('Tous les tests utilisent déjà les helpers ou n\'ont pas de contraintes.');
    return;
  }

  console.log(`⚠️  ${problematicFiles.length} fichier(s) nécessitent une migration\n`);

  const report = generateReport(problematicFiles);
  const reportPath = path.join(TESTS_DIR, 'MIGRATION_REPORT.md');
  
  fs.writeFileSync(reportPath, report, 'utf-8');
  
  console.log(`📄 Rapport généré: ${reportPath}\n`);
  console.log('📋 Résumé des problèmes:\n');

  // Compter les types de problèmes
  const issueTypes = new Map<string, number>();
  for (const file of problematicFiles) {
    for (const issue of file.issues) {
      const count = issueTypes.get(issue) || 0;
      issueTypes.set(issue, count + 1);
    }
  }

  for (const [issue, count] of issueTypes.entries()) {
    console.log(`  - ${issue}: ${count} fichier(s)`);
  }

  console.log('\n💡 Prochaines étapes:');
  console.log('  1. Lire le rapport: cat __tests__/MIGRATION_REPORT.md');
  console.log('  2. Lire le guide: cat __tests__/MIGRATION_GUIDE.md');
  console.log('  3. Migrer les tests un par un');
  console.log('  4. Tester: npm run test:integration\n');
}

main().catch((error) => {
  console.error(serializeError(error));
});
