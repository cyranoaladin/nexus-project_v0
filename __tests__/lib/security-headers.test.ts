import { applyCorsHeaders, applySecurityHeaders } from '@/lib/security-headers';

describe('Security Headers', () => {
  it('applies all security headers', () => {
    const response = applySecurityHeaders({ headers: new Headers() } as any);

    expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
    expect(response.headers.get('Strict-Transport-Security')).toBe(
      'max-age=31536000; includeSubDomains; preload'
    );
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('applies CORS headers with default origin', () => {
    const response = applyCorsHeaders({ headers: new Headers() } as any);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
      'Content-Type, Authorization, X-Requested-With'
    );
    expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
  });

  it('applies CORS headers with allowed origin', () => {
    const response = applyCorsHeaders(
      { headers: new Headers() } as any,
      ['https://example.com']
    );

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
  });
});
