#!/usr/bin/env node

/**
 * Script d'audit automatisé des liens et boutons de la page d'accueil
 * Teste tous les liens et boutons pour s'assurer qu'ils fonctionnent correctement
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { serializeError } = require('./serialize-error.cjs');

const BASE_URL = 'http://localhost:3000';

// Liste de tous les liens et boutons identifiés dans la page d'accueil
const LINKS_TO_TEST = [
  // Header Navigation
  { url: '/', description: 'Page d\'accueil (logo)', source: 'Header' },
  { url: '/equipe', description: 'Notre Équipe', source: 'Header Navigation' },
  { url: '/offres', description: 'Offres & Tarifs', source: 'Header Navigation' },
  { url: '/notre-centre', description: 'Notre Centre', source: 'Header Navigation' },
  { url: '/contact', description: 'Contact', source: 'Header Navigation' },
  { url: '/auth/signin', description: 'Se Connecter', source: 'Header CTA' },
  { url: '/bilan-gratuit', description: 'Bilan Gratuit', source: 'Header CTA' },

  // Hero Section
  { url: '/bilan-gratuit', description: 'Commencer mon Bilan Stratégique Gratuit', source: 'Hero Section CTA Primary' },
  { url: '/offres', description: 'Découvrir nos Offres', source: 'Hero Section CTA Secondary' },

  // Offers Preview Section
  { url: '/offres#cortex', description: 'Nexus Cortex', source: 'Offers Preview' },
  { url: '/offres', description: 'Le Studio Flex', source: 'Offers Preview' },
  { url: '/offres#academies', description: 'Les Académies Nexus', source: 'Offers Preview' },
  { url: '/offres#odyssee', description: 'Le Programme Odyssée', source: 'Offers Preview' },
  { url: '/offres', description: 'Voir Toutes Nos Offres', source: 'Offers Preview Global CTA' },

  // How It Works Section
  { url: '/bilan-gratuit', description: 'Commencer mon Bilan Stratégique Gratuit', source: 'How It Works CTA' },

  // CTA Section
  { url: '/bilan-gratuit', description: 'Commencer mon Bilan Stratégique Gratuit', source: 'CTA Section Primary' },
  { url: '/contact', description: 'Poser une Question', source: 'CTA Section Secondary' },
];

// Fonction pour tester un lien HTTP
function testLink(url) {
  return new Promise((resolve) => {
    const fullUrl = url.startsWith('http') ? url : BASE_URL + url;
    const urlObj = new URL(fullUrl);
    const client = urlObj.protocol === 'https:' ? https : http;

    const req = client.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search + urlObj.hash,
      method: 'HEAD',
      timeout: 5000
    }, (res) => {
      resolve({
        url: url,
        status: res.statusCode,
        success: res.statusCode >= 200 && res.statusCode < 400,
        redirected: res.statusCode >= 300 && res.statusCode < 400,
        headers: res.headers
      });
    });

    req.on('error', (err) => {
      resolve({
        url: url,
        status: 0,
        success: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        url: url,
        status: 0,
        success: false,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

// Fonction principale d'audit
async function auditHomepageLinks() {
  console.log('🔍 AUDIT DES LIENS DE LA PAGE D\'ACCUEIL');
  console.log('==========================================\n');

  const results = [];
  let passedTests = 0;
  let failedTests = 0;

  for (const link of LINKS_TO_TEST) {
    console.log(`Testing: ${link.description} (${link.url})`);

    const result = await testLink(link.url);
    results.push({
      ...link,
      ...result
    });

    if (result.success) {
      console.log(`✅ PASS - Status: ${result.status}`);
      passedTests++;
    } else {
      console.log(`❌ FAIL - Status: ${result.status} - Error: ${result.error || 'HTTP Error'}`);
      failedTests++;
    }
    console.log(`   Source: ${link.source}\n`);
  }

  // Résumé des résultats
  console.log('\n📊 RÉSUMÉ DE L\'AUDIT');
  console.log('===================');
  console.log(`✅ Tests réussis: ${passedTests}`);
  console.log(`❌ Tests échoués: ${failedTests}`);
  console.log(`📊 Total: ${results.length}`);
  console.log(`🎯 Taux de réussite: ${((passedTests / results.length) * 100).toFixed(1)}%\n`);

  // Détails des échecs
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log('🚨 DÉTAILS DES ÉCHECS:');
    console.log('====================');
    failures.forEach(failure => {
      console.log(`❌ ${failure.description}`);
      console.log(`   URL: ${failure.url}`);
      console.log(`   Source: ${failure.source}`);
      console.log(`   Erreur: ${failure.error || `HTTP ${failure.status}`}\n`);
    });
  }

  // Recommandations
  console.log('💡 RECOMMANDATIONS:');
  console.log('==================');
  if (failures.length === 0) {
    console.log('✨ Excellent ! Tous les liens fonctionnent correctement.');
    console.log('🚀 La page d\'accueil est prête pour la production.');
  } else {
    console.log('🔧 Corrigez les liens défaillants avant la mise en production.');
    console.log('🧪 Relancez l\'audit après les corrections.');
  }

  return {
    total: results.length,
    passed: passedTests,
    failed: failedTests,
    rate: (passedTests / results.length) * 100,
    failures: failures
  };
}

// Exécution du script
if (require.main === module) {
  auditHomepageLinks().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  }).catch(err => {
    console.error('❌ Erreur lors de l\'audit:', serializeError(err));
    process.exit(1);
  });
}

module.exports = { auditHomepageLinks, testLink };
