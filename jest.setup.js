import '@testing-library/jest-dom';

// Mock Prisma client
jest.mock('./lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    parentProfile: {
      create: jest.fn(),
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
    },
    coachProfile: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock Next Auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

// jest.setup.js
// Polyfill IntersectionObserver pour Jest/jsdom (Node global)
global.IntersectionObserver = global.IntersectionObserver || class {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};
