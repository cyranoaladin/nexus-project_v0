import '@testing-library/jest-dom';
import 'whatwg-fetch';

// Robust Prisma mock for UI tests (returns jest.fn for any model method)
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

// Mock Next Auth (server)
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock Next Auth (client) for UI tests to avoid spinner states
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'admin1', role: 'ADMIN', email: 'admin@nexus.com' } }, status: 'authenticated' }),
}));

// Mock authOptions used on server imports that might leak into UI bundles
jest.mock('@/lib/auth', () => ({ authOptions: { providers: [], adapter: {} } }));

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
