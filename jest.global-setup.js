/**
 * Global setup for Jest integration tests
 * 
 * This runs once before all integration tests to ensure a completely clean database.
 * It resets the schema to avoid constraint violations from previous test runs.
 */

module.exports = async function globalSetup() {
  // Only run if we're in CI or explicitly testing
  if (process.env.CI || process.env.RUN_INTEGRATION_TESTS) {
    console.log('🔧 Running global setup for integration tests...');
    
    try {
      // Dynamically import to avoid issues with Jest environment
      const { testPrisma, resetTestDatabase } = require('./__tests__/setup/test-database');
      
      // Reset database schema
      await resetTestDatabase();
      
      console.log('✅ Global setup complete - database is clean');
    } catch (error) {
      console.warn('⚠️  Global setup warning:', error);
      // Don't fail the entire run, tests will handle connection errors
    }
  }
};
