const integration = require('./jest.integration.config.js');
module.exports = async () => ({
  ...await integration(),
  testMatch: ['**/__tests__/e2e/golden-family-cleanup.real.test.ts'],
});
