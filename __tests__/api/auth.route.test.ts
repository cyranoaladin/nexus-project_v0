const mockHandler = jest.fn();

jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(() => mockHandler),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: { providers: [] },
}));

describe('auth route handler', () => {
  it('exports GET and POST from NextAuth handler', () => {
    const { GET, POST } = require('@/app/api/auth/[...nextauth]/route');
    const NextAuth = require('next-auth').default as jest.Mock;

    expect(NextAuth).toHaveBeenCalledWith({ providers: [] });
    expect(GET).toBe(mockHandler);
    expect(POST).toBe(mockHandler);
  });
});
