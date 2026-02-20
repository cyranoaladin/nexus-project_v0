import { GET, POST } from '@/app/api/auth/[...nextauth]/route';

// Mock handlers from @/auth
jest.mock('@/auth', () => ({
  handlers: {
    GET: jest.fn(),
    POST: jest.fn(),
  }
}));

describe('Auth Route Handler', () => {
  it('should export GET and POST handlers from v5 config', () => {
    expect(GET).toBeDefined();
    expect(POST).toBeDefined();
  });
});
