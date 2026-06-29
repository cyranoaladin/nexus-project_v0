#!/usr/bin/env node

/**
 * Script de vérification de cohérence de la base de données
 * Vérifie que les APIs et la base de données sont cohérentes
 */

const { PrismaClient } = require('@prisma/client');
const http = require('http');
const { serializeError } = require('./serialize-error.cjs');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

// Tests de cohérence de la base de données
async function checkDatabaseConsistency() {
  console.log('🔍 VÉRIFICATION DE LA COHÉRENCE DE LA BASE DE DONNÉES');
  console.log('====================================================\n');

  const checks = [];
  let passedChecks = 0;
  let failedChecks = 0;

  try {
    // 1. Vérifier la connectivité à la base de données
    console.log('1. Test de connectivité à la base de données...');
    try {
      await prisma.$connect();
      console.log('✅ PASS - Connexion à la base de données réussie');
      passedChecks++;
    } catch (error) {
      console.log('❌ FAIL - Impossible de se connecter à la base de données:', error.message);
      failedChecks++;
    }

    // 2. Vérifier l'API de santé
    console.log('\n2. Test de l\'API de santé...');
    try {
      const healthResponse = await testApiEndpoint('/api/health');
      if (healthResponse.success) {
        console.log('✅ PASS - API de santé opérationnelle');
        passedChecks++;
      } else {
        console.log('❌ FAIL - API de santé non accessible');
        failedChecks++;
      }
    } catch (error) {
      console.log('❌ FAIL - Erreur lors du test de l\'API de santé:', error.message);
      failedChecks++;
    }

    // 3. Vérifier les schémas de base de données
    console.log('\n3. Vérification des schémas de base de données...');
    try {
      // Vérifier que les tables principales existent
      const tables = ['User', 'Parent', 'Student', 'Session', 'Payment', 'Subscription'];

      for (const table of tables) {
        try {
          const count = await prisma[table.toLowerCase()].count();
          console.log(`✅ PASS - Table ${table} accessible (${count} enregistrements)`);
          passedChecks++;
        } catch (error) {
          console.log(`❌ FAIL - Table ${table} inaccessible:`, error.message);
          failedChecks++;
        }
      }
    } catch (error) {
      console.log('❌ FAIL - Erreur lors de la vérification des schémas:', error.message);
      failedChecks++;
    }

    // 4. Vérifier les contraintes de données
    console.log('\n4. Vérification des contraintes de données...');
    try {
      // Vérifier les relations parent-enfant
      const usersWithoutRole = await prisma.user.count({
        where: { role: null }
      });

      if (usersWithoutRole === 0) {
        console.log('✅ PASS - Tous les utilisateurs ont un rôle défini');
        passedChecks++;
      } else {
        console.log(`❌ FAIL - ${usersWithoutRole} utilisateurs sans rôle défini`);
        failedChecks++;
      }

      // Vérifier les étudiants orphelins
      const studentsWithoutParent = await prisma.student.count({
        where: { parentId: null }
      });

      if (studentsWithoutParent === 0) {
        console.log('✅ PASS - Tous les étudiants ont un parent assigné');
        passedChecks++;
      } else {
        console.log(`❌ FAIL - ${studentsWithoutParent} étudiants sans parent`);
        failedChecks++;
      }
    } catch (error) {
      console.log('❌ FAIL - Erreur lors de la vérification des contraintes:', error.message);
      failedChecks++;
    }

    // 5. Vérifier les énumérations
    console.log('\n5. Vérification des énumérations...');
    try {
      const validRoles = ['ADMIN', 'PARENT', 'ELEVE', 'COACH'];
      const usersWithInvalidRole = await prisma.user.count({
        where: {
          role: {
            notIn: validRoles
          }
        }
      });

      if (usersWithInvalidRole === 0) {
        console.log('✅ PASS - Tous les rôles utilisateur sont valides');
        passedChecks++;
      } else {
        console.log(`❌ FAIL - ${usersWithInvalidRole} utilisateurs avec rôle invalide`);
        failedChecks++;
      }
    } catch (error) {
      console.log('❌ FAIL - Erreur lors de la vérification des énumérations:', error.message);
      failedChecks++;
    }

    // 6. Vérifier les index et performances
    console.log('\n6. Test de performance des requêtes...');
    try {
      const startTime = Date.now();
      await prisma.user.findMany({ take: 10 });
      const queryTime = Date.now() - startTime;

      if (queryTime < 1000) {
        console.log(`✅ PASS - Requête utilisateur rapide (${queryTime}ms)`);
        passedChecks++;
      } else {
        console.log(`⚠️  WARN - Requête utilisateur lente (${queryTime}ms)`);
        failedChecks++;
      }
    } catch (error) {
      console.log('❌ FAIL - Erreur lors du test de performance:', error.message);
      failedChecks++;
    }

  } finally {
    await prisma.$disconnect();
  }

  // Résumé
  console.log('\n📊 RÉSUMÉ DE LA VÉRIFICATION');
  console.log('============================');
  console.log(`✅ Vérifications réussies: ${passedChecks}`);
  console.log(`❌ Vérifications échouées: ${failedChecks}`);
  console.log(`📊 Total: ${passedChecks + failedChecks}`);
  console.log(`🎯 Taux de réussite: ${((passedChecks / (passedChecks + failedChecks)) * 100).toFixed(1)}%\n`);

  if (failedChecks === 0) {
    console.log('🎉 EXCELLENT ! La base de données est cohérente et opérationnelle.');
    console.log('🚀 Prêt pour la production.');
  } else {
    console.log('⚠️  ATTENTION ! Des incohérences ont été détectées.');
    console.log('🔧 Corrigez les problèmes avant la mise en production.');
  }

  return {
    passed: passedChecks,
    failed: failedChecks,
    total: passedChecks + failedChecks,
    rate: (passedChecks / (passedChecks + failedChecks)) * 100
  };
}

// Fonction utilitaire pour tester les endpoints API
function testApiEndpoint(endpoint) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: endpoint,
      method: 'GET',
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          success: res.statusCode >= 200 && res.statusCode < 400,
          status: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

// Exécution du script
if (require.main === module) {
  checkDatabaseConsistency().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  }).catch(err => {
    console.error('❌ Erreur critique lors de la vérification:', serializeError(err));
    process.exit(1);
  });
}

module.exports = { checkDatabaseConsistency, testApiEndpoint };
