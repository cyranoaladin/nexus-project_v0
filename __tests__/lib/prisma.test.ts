let created = 0;

jest.mock(
  '@prisma/client',
  () => ({
    PrismaClient: jest.fn().mockImplementation(() => {
      created += 1;
      return { __id: created };
    }),
  }),
  { virtual: true }
);

describe('prisma singleton', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    jest.resetModules();
    created = 0;
    (process.env as any).NODE_ENV = originalEnv;
    delete (globalThis as any).prisma;
  });

  it('reuses instance in non-production', () => {
    (process.env as any).NODE_ENV = 'development';
    delete (globalThis as any).prisma;

    let first: any;
    let second: any;

    jest.isolateModules(() => {
      jest.unmock('@/lib/prisma');
      first = require('@/lib/prisma').prisma;
    });
    jest.isolateModules(() => {
      jest.unmock('@/lib/prisma');
      second = require('@/lib/prisma').prisma;
    });

    expect(first).toBe(second);
    expect(created).toBe(1);
  });

  it('does not attach to global in production', () => {
    (process.env as any).NODE_ENV = 'production';
    delete (globalThis as any).prisma;

    let instance: any;
    jest.isolateModules(() => {
      jest.unmock('@/lib/prisma');
      instance = require('@/lib/prisma').prisma;
    });

    expect(instance).toBeDefined();
    expect((globalThis as any).prisma).toBeUndefined();
    expect(created).toBe(1);
  });
});
