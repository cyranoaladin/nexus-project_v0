// Integration test setup for Node.js environment

// Mock Next.js modules that don't work in Node.js test environment
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
      ...init
    })
  }
}));

// Mock Next Auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}));

// Mock auth module completely to avoid ES6 issues
jest.mock('./lib/auth', () => ({
  authOptions: {
    adapter: {},
    providers: []
  }
}));

// Mock Prisma for integration tests
jest.mock('./lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    parentProfile: {
      create: jest.fn(),
      count: jest.fn(),
    },
    studentProfile: {
      create: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    creditTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    coachProfile: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    subscription: {
      create: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    sessionBooking: {
      findUnique: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock external dependencies
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password')
}));

// Mock email service
jest.mock('./lib/email', () => ({
  sendWelcomeParentEmail: jest.fn().mockResolvedValue(undefined)
}));

// Mock rate limiter to always allow requests in tests
jest.mock('./lib/middleware/rateLimit', () => ({
  rateLimit: () => () => null,
  RateLimitPresets: {
    auth: () => null,
    api: () => null,
    expensive: () => null,
    public: () => null,
  },
  clearRateLimit: jest.fn(),
  getRateLimitStatus: jest.fn(() => ({ remaining: 100, resetTime: Date.now() + 60000 })),
}));

// Environment variables for tests
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5434/nexus_test?schema=public';

// Ensure all jest.fn() calls are cleared between tests to avoid cross-test leakage
afterEach(() => {
  jest.clearAllMocks();
});
