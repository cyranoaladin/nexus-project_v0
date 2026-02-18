// Set environment variables before any modules are imported
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_SECRET = 'test-secret-min-32-chars-long-for-unit-tests';
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nexus_test';
