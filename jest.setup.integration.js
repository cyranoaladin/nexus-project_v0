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
      ...init,
    }),
  },
}));

// Mock Next.js server primitives
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
    json: (data, init) => ({ json: async () => data, status: init?.status || 200, ...init }),
  },
}));

// Mock Next Auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));
// Some NextAuth helpers reside in 'next-auth/next' in Next.js app router
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: {
      id: 'u1',
      role: 'ELEVE',
      firstName: 'Test',
      lastName: 'User',
      studentId: 's1',
      parentId: 'p1',
    },
  }),
}));

// Mock @auth/prisma-adapter (ESM) to avoid ESM parse issues in Jest
jest.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: jest.fn(() => ({})) }));

// Mock auth module completely
jest.mock('@/lib/auth', () => ({
  authOptions: { adapter: {}, providers: [] },
}));

// Mock Prisma for integration tests (alias path)
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    parentProfile: { create: jest.fn(), count: jest.fn() },
    studentProfile: { create: jest.fn() },
    session: { create: jest.fn(), findFirst: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    creditTransaction: { create: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    coachProfile: { findFirst: jest.fn(), count: jest.fn() },
    subscription: {
      create: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    payment: { groupBy: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    ariaConversation: { findFirst: jest.fn(), create: jest.fn() },
    ariaMessage: { findMany: jest.fn(), create: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  },
}));

// Mock email service
jest.mock('@/lib/email', () => ({
  sendWelcomeParentEmail: jest.fn().mockResolvedValue(undefined),
}));

// External deps
jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

// Env
process.env.NODE_ENV = 'test';
process.env.NEXTAUTH_SECRET = 'test-secret';
