import { authConfig } from '@/auth.config';

// Mock NextUrl properly
const mockNextUrl = (pathname: string) => {
    const url = new URL(`http://localhost${pathname}`);
    return url;
};

describe('Middleware Security Rules', () => {
  // @ts-ignore
  const authorized = authConfig.callbacks!.authorized!;

  // Mock Response
  const originalResponse = global.Response;
  
  beforeAll(() => {
    global.Response = {
        redirect: jest.fn((url: string | URL) => ({ status: 307, url: url.toString() }))
    } as any;
  });

  afterAll(() => {
    global.Response = originalResponse;
  });

  it('should redirect unauthenticated users away from dashboard', async () => {
    const req = { nextUrl: mockNextUrl('/dashboard') } as any;
    const auth = null;
    
    // @ts-ignore
    const result = await authorized({ auth, request: req });
    expect(result).toBe(false);
  });

  it('should allow authenticated users on dashboard', async () => {
    const req = { nextUrl: mockNextUrl('/dashboard') } as any;
    const auth = { user: { role: 'ELEVE' } } as any;
    
    // @ts-ignore
    const result = await authorized({ auth, request: req });
    expect(result).toBe(true);
  });
  
  it('should redirect authenticated users away from auth pages', async () => {
      const req = { nextUrl: mockNextUrl('/auth/signin') } as any;
      const auth = { user: { role: 'ELEVE' } } as any;
      
      // @ts-ignore
      const result = await authorized({ auth, request: req });
      
      // Should have called redirect
      expect(global.Response.redirect).toHaveBeenCalled();
  });
});
