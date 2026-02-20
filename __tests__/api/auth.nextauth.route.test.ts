/**
 * Unit Tests - NextAuth API Route
 *
 * The route re-exports { GET, POST } from @/auth handlers.
 */

jest.mock('@/auth', () => ({
  handlers: {
    GET: jest.fn(),
    POST: jest.fn(),
  },
  auth: jest.fn(),
}));

describe('/api/auth/[...nextauth]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('exports GET and POST handlers from @/auth', async () => {
    const route = await import('@/app/api/auth/[...nextauth]/route');
    expect(route.GET).toBeDefined();
    expect(route.POST).toBeDefined();
  });
});
