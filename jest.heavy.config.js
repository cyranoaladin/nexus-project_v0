/**
 * Voie « lourde » déterministe : suites qui construisent un Program TypeScript complet du dépôt
 * (≈ 3,4 Go de mémoire résidente, ≈ 50 s). Lancées dans le pool parallèle par défaut (jusqu'à N-1 workers sur une
 * machine à 16 cœurs, chacun pouvant atteindre plusieurs Go), elles faisaient tuer leur worker (SIGTERM, OOM de cgroup)
 * de façon intermittente. Ici : UN seul worker, aucune concurrence mémoire, aucune assertion affaiblie, aucun timeout
 * relevé. La voie parallèle (jest.unit.config.js) les ignore ; `npm run test:unit:all` exécute les deux.
 */
const unit = require('./jest.unit.config.js');

module.exports = async () => {
  const config = await unit();
  return {
    ...config,
    maxWorkers: 1,
    testMatch: ['**/__tests__/architecture/npc-storage-contract.test.ts'],
    testPathIgnorePatterns: (config.testPathIgnorePatterns || []).filter((p) => !p.includes('npc-storage-contract')),
  };
};
