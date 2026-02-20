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
    json: (data, init) => {
      const headers = new Map();
      if (init?.headers) {
        const headerEntries = init.headers instanceof Headers 
          ? Array.from(init.headers.entries())
          : Object.entries(init.headers);
        headerEntries.forEach(([key, value]) => headers.set(key, value));
      }
      
      return {
        json: async () => data,
        status: init?.status || 200,
        headers: {
          get: (name) => headers.get(name),
          set: (name, value) => headers.set(name, value),
          has: (name) => headers.has(name),
          delete: (name) => headers.delete(name),
          entries: () => headers.entries(),
          keys: () => headers.keys(),
          values: () => headers.values(),
          forEach: (cb) => headers.forEach(cb),
        },
        ...init
      };
    },
    redirect: (url, init) => {
      const headers = new Map();
      if (init?.headers) {
        const headerEntries = init.headers instanceof Headers 
          ? Array.from(init.headers.entries())
          : Object.entries(init.headers);
        headerEntries.forEach(([key, value]) => headers.set(key, value));
      }
      
      return {
        status: init?.status || 307,
        headers: {
          get: (name) => headers.get(name),
          set: (name, value) => headers.set(name, value),
          has: (name) => headers.has(name),
          delete: (name) => headers.delete(name),
          entries: () => headers.entries(),
          keys: () => headers.keys(),
          values: () => headers.values(),
          forEach: (cb) => headers.forEach(cb),
        },
        url,
        ...init
      };
    },
    next: (init) => {
      const headers = new Map();
      if (init?.headers) {
        const headerEntries = init.headers instanceof Headers 
          ? Array.from(init.headers.entries())
          : Object.entries(init.headers);
        headerEntries.forEach(([key, value]) => headers.set(key, value));
      }
      
      return {
        status: 200,
        headers: {
          get: (name) => headers.get(name),
          set: (name, value) => headers.set(name, value),
          has: (name) => headers.has(name),
          delete: (name) => headers.delete(name),
          entries: () => headers.entries(),
          keys: () => headers.keys(),
          values: () => headers.values(),
          forEach: (cb) => headers.forEach(cb),
        },
        ...init
      };
    }
  }
}));

// Mock Next Auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}));

// Mock auth module
jest.mock('@/auth', () => ({
  auth: jest.fn(),
  handlers: { GET: jest.fn(), POST: jest.fn() },
  signIn: jest.fn(),
  signOut: jest.fn(),
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
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
      findFirst: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    studentBadge: {
      findMany: jest.fn(),
    },
    assessment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    stageReservation: {
      count: jest.fn(),
    },
    diagnostic: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
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

// Mock @paralleldrive/cuid2 to avoid ESM import issues
jest.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'test-cuid-' + Math.random().toString(36).slice(2, 10),
  init: jest.fn(),
  getConstants: jest.fn(),
  isCuid: () => true,
}));

// Mock uuid module to avoid ES6 module issues
jest.mock('uuid', () => {
  const actual = jest.requireActual('crypto');
  return {
    v4: () => actual.randomUUID(),
    v1: () => actual.randomUUID(),
    v5: () => actual.randomUUID(),
    v3: () => actual.randomUUID(),
    v6: () => actual.randomUUID(),
    v7: () => actual.randomUUID(),
    validate: () => true,
    version: () => 4,
  };
});

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
process.env.TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/nexus_test?schema=public';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

// Ensure all jest.fn() calls are cleared between tests to avoid cross-test leakage
afterEach(() => {
  jest.clearAllMocks();
});
