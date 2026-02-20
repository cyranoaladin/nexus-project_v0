/**
 * Unit Tests - NextAuth API Route
 */

jest.mock('@/auth', () => ({
  __esModule: true,
  default: jest.fn(() => 'handler'),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: { providers: ['credentials'] },
}));

describe('/api/auth/[...nextauth]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('exports dynamic metadata', async () => {
    const route = await import('@/app/api/auth/[...nextauth]/route');
    expect(route.dynamic).toBe('force-dynamic');
  });

  it('wires NextAuth with authOptions and exports handler for GET/POST', async () => {
    const { authOptions } = await import('@/lib/auth');
    const { default: NextAuth } = await import('next-auth');
    const route = await import('@/app/api/auth/[...nextauth]/route');

    expect(NextAuth).toHaveBeenCalledWith(authOptions);
    expect(route.GET).toBe('handler');
    expect(route.POST).toBe('handler');
  });
});
