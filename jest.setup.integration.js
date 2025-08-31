// Integration test setup for Node.js environment

// Increase default timeout for slower integration tests
jest.setTimeout(15000);

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
  getServerSession: jest.fn(),
}));
// Some NextAuth helpers reside in 'next-auth/next' in Next.js app router
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: { id: 'u1', role: 'ELEVE', firstName: 'Test', lastName: 'User', studentId: 's1', parentId: 'p1' },
  }),
}));

// Mock @auth/prisma-adapter (ESM) to avoid ESM parse issues in Jest
jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: jest.fn(() => ({})) }));

// Mock auth module completely
jest.mock('@/lib/auth', () => ({
  authOptions: { adapter: {}, providers: [] },
}));

// Robust Prisma mock for integration tests
const createModelMock = () => ({
  findMany: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
  groupBy: jest.fn(),
  aggregate: jest.fn(),
});
const prismaProxy = new Proxy({}, {
  get(target, prop) {
    if (!target[prop]) {
      if (prop === '$transaction' || prop === '$queryRaw') {
        target[prop] = jest.fn();
      } else {
        target[prop] = createModelMock();
      }
    }
    return target[prop];
  },
});

jest.mock('@/lib/prisma', () => ({ prisma: prismaProxy }));

// Mock email service
jest.mock('@/lib/email', () => ({ sendWelcomeParentEmail: jest.fn().mockResolvedValue(undefined) }));

// External deps
jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

// Provide and stabilize fetch to avoid hitting external/local services in tests
const __originalFetch = typeof global.fetch === 'function' ? global.fetch.bind(global) : undefined;

global.fetch = jest.fn(async (input, init) => {
  try {
    const url = typeof input === 'string' ? input : (input && input.url) ? input.url : String(input);
    // Avoid local service calls that are not running during tests
    if (/localhost:(8001|8002)/.test(url)) {
      // Simulate deterministic 500 for service endpoints; tests assert error branches
      return {
        ok: false,
        status: 500,
        json: async () => ({}),
        text: async () => 'err',
      };
    }
    if (__originalFetch) return __originalFetch(input, init);
    return { ok: true, status: 200, json: async () => ({}) };
  } catch {
    return { ok: false, status: 500, json: async () => ({}) };
  }
});

// Env
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_SECRET = 'test-secret';
