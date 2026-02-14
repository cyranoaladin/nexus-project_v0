/**
 * Global setup for Jest integration tests
 * 
 * This runs once before all integration tests to ensure the database is ready.
 * The CI already runs migrations, so we just verify the connection here.
 */

module.exports = async function globalSetup() {
  // Only run if we're in CI or explicitly testing
  if (process.env.CI || process.env.RUN_INTEGRATION_TESTS) {
    console.log('🔧 Running global setup for integration tests...');
    
    try {
      // Dynamically import to avoid issues with Jest environment
      const { testPrisma, canConnectToTestDb } = require('./__tests__/setup/test-database');
      
      // Verify database connection
      const isConnected = await canConnectToTestDb();
      if (!isConnected) {
        throw new Error('Cannot connect to test database');
      }
      
      console.log('✅ Global setup complete - database is ready');
    } catch (error) {
      console.warn('⚠️  Global setup warning:', error);
      // Don't fail the entire run, tests will handle connection errors
    }
  }
};
