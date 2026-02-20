/**
 * Setup for real DB integration tests.
 *
 * NO mocks — uses real Prisma client against docker-compose.test.yml Postgres.
 * Requires DATABASE_URL pointing to the test database.
 */

// Mock next/server for route handlers
jest.mock('next/server', () => ({
  NextRequest: class {
    constructor(url, init) {
      this.url = url;
      this.method = init?.method || 'GET';
      this.headers = new Map(Object.entries(init?.headers || {}));
      this._body = init?.body;
    }
    async json() {
      return JSON.parse(this._body);
    }
  },
  NextResponse: {
    json: (data, init) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

// Mock next-auth (no real auth in DB tests)
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/auth', () => ({
  auth: jest.fn(),
  handlers: { GET: jest.fn(), POST: jest.fn() },
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(null),
  }),
}));

// Mock BilanGenerator to avoid LLM calls
jest.mock('./lib/assessments/generators', () => ({
  BilanGenerator: {
    generate: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock SSN computation (tested separately)
jest.mock('./lib/core/ssn/computeSSN', () => ({
  computeAndPersistSSN: jest.fn().mockResolvedValue(undefined),
}));

// Environment
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_SECRET = 'test-secret-db';

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://nexus_user:test_password_change_in_real_prod@localhost:5434/nexus_test?schema=public';
}

afterEach(() => {
  jest.clearAllMocks();
});
