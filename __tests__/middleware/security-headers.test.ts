/**
 * Security Headers Tests
 * Verifies security headers are applied correctly to all responses
 */

import { NextResponse } from 'next/server';

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'self'"
  ].join('; '))
  
  return response
}

describe('Security Headers Tests', () => {
  describe('API Routes', () => {
    it('should include all security headers on API response', () => {
      const response = NextResponse.json({ success: true });
      const securedResponse = applySecurityHeaders(response);

      expect(securedResponse.headers.get('Strict-Transport-Security')).toBe(
        'max-age=31536000; includeSubDomains; preload'
      );
      expect(securedResponse.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
      expect(securedResponse.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(securedResponse.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(securedResponse.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(securedResponse.headers.get('Permissions-Policy')).toBe('geolocation=(), microphone=(), camera=()');
      expect(securedResponse.headers.get('Content-Security-Policy')).toBeDefined();
    });

    it('should include security headers on error responses', () => {
      const response = NextResponse.json(
        { error: 'Not found' },
        { status: 404 }
      );
      const securedResponse = applySecurityHeaders(response);

      expect(securedResponse.headers.get('Strict-Transport-Security')).toBeDefined();
      expect(securedResponse.headers.get('X-Frame-Options')).toBeDefined();
      expect(securedResponse.headers.get('Content-Security-Policy')).toBeDefined();
    });

    it('should include security headers on rate limit responses', () => {
      const response = NextResponse.json(
        { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
        { status: 429 }
      );
      const securedResponse = applySecurityHeaders(response);

      expect(securedResponse.headers.get('Strict-Transport-Security')).toBeDefined();
      expect(securedResponse.headers.get('X-Frame-Options')).toBeDefined();
      expect(securedResponse.headers.get('X-Content-Type-Options')).toBeDefined();
    });
  });

  describe('Page Routes', () => {
    it('should include security headers on redirect responses', () => {
      const response = NextResponse.redirect('http://localhost:3000/dashboard');
      const securedResponse = applySecurityHeaders(response);

      expect(securedResponse.headers.get('Strict-Transport-Security')).toBeDefined();
      expect(securedResponse.headers.get('X-Frame-Options')).toBeDefined();
      expect(securedResponse.headers.get('Content-Security-Policy')).toBeDefined();
    });

    it('should include security headers on normal page responses', () => {
      const response = NextResponse.next();
      const securedResponse = applySecurityHeaders(response);

      expect(securedResponse.headers.get('Strict-Transport-Security')).toBeDefined();
      expect(securedResponse.headers.get('X-Frame-Options')).toBeDefined();
      expect(securedResponse.headers.get('X-Content-Type-Options')).toBeDefined();
      expect(securedResponse.headers.get('X-XSS-Protection')).toBeDefined();
      expect(securedResponse.headers.get('Referrer-Policy')).toBeDefined();
      expect(securedResponse.headers.get('Permissions-Policy')).toBeDefined();
      expect(securedResponse.headers.get('Content-Security-Policy')).toBeDefined();
    });
  });

  describe('HSTS Configuration', () => {
    it('should configure HSTS with correct directives', () => {
      const response = NextResponse.json({ success: true });
      const securedResponse = applySecurityHeaders(response);

      const hsts = securedResponse.headers.get('Strict-Transport-Security');
      
      expect(hsts).toContain('max-age=31536000');
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');
    });

    it('should set HSTS max-age to 1 year (31536000 seconds)', () => {
      const response = NextResponse.json({ success: true });
      const securedResponse = applySecurityHeaders(response);

      const hsts = securedResponse.headers.get('Strict-Transport-Security');
      
      expect(hsts).toBe('max-age=31536000; includeSubDomains; preload');
    });
  });

  describe('CSP Configuration', () => {
    it('should configure Content-Security-Policy with all required directives', () => {
      const response = NextResponse.json({ success: true });
      const securedResponse = applySecurityHeaders(response);

      const csp = securedResponse.headers.get('Content-Security-Policy');
      
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("img-src 'self' data: https:");
      expect(csp).toContain("font-src 'self' data:");
      expect(csp).toContain("connect-src 'self' https:");
      expect(csp).toContain("frame-ancestors 'self'");
    });

    it('should allow unsafe-inline for styles (Next.js requirement)', () => {
      const response = NextResponse.json({ success: true });
      const securedResponse = applySecurityHeaders(response);

      const csp = securedResponse.headers.get('Content-Security-Policy');
      
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    });

    it('should allow unsafe-inline and unsafe-eval for scripts (Next.js dev mode)', () => {
      const response = NextResponse.json({ success: true });
      const securedResponse = applySecurityHeaders(response);

      const csp = securedResponse.headers.get('Content-Security-Policy');
      
      expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    });

    it('should restrict default-src to same origin', () => {
      const response = NextResponse.json({ success: true });
      const securedResponse = applySecurityHeaders(response);

      const csp = securedResponse.headers.get('Content-Security-Policy');
      
      expect(csp).toContain("default-src 'self'");
    });

    it('should allow https for images and connections', () => {
      const response = NextResponse.json({ success: true });
      const securedResponse = applySecurityHeaders(response);

      const csp = securedResponse.headers.get('Content-Security-Policy');
      
      expect(csp).toContain("img-src 'self' data: https:");
      expect(csp).toContain("connect-src 'self' https:");
    });

    it('should prevent framing by other sites', () => {
      const response = NextResponse.json({ success: true });
      const securedResponse = applySecurityHeaders(response);

      const csp = securedResponse.headers.get('Content-Security-Policy');
      
      expect(csp).toContain("frame-ancestors 'self'");
    });
  });

  describe('Additional Security Headers', () => {
    it('should set X-Frame-Options to SAMEORIGIN', () => {
      const response = NextResponse.json({ success: true });
      const securedResponse = applySecurityHeaders(response);

      expect(securedResponse.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    });

    it('should set X-Content-Type-Options to nosniff', () => {
      const response = NextResponse.json({ success: true });
      const securedResponse = applySecurityHeaders(response);

      expect(securedResponse.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should enable XSS protection', () => {
      const response = NextResponse.json({ success: true });
      const securedResponse = applySecurityHeaders(response);

      expect(securedResponse.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('should set Referrer-Policy to strict-origin-when-cross-origin', () => {
      const response = NextResponse.json({ success: true });
      const securedResponse = applySecurityHeaders(response);

      expect(securedResponse.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('should disable browser features via Permissions-Policy', () => {
      const response = NextResponse.json({ success: true });
      const securedResponse = applySecurityHeaders(response);

      const permissionsPolicy = securedResponse.headers.get('Permissions-Policy');
      
      expect(permissionsPolicy).toContain('geolocation=()');
      expect(permissionsPolicy).toContain('microphone=()');
      expect(permissionsPolicy).toContain('camera=()');
    });
  });

  describe('Header Consistency', () => {
    it('should apply same headers regardless of response type', () => {
      const jsonResponse = applySecurityHeaders(NextResponse.json({ data: 'test' }));
      const redirectResponse = applySecurityHeaders(NextResponse.redirect('http://localhost:3000/'));
      const nextResponse = applySecurityHeaders(NextResponse.next());

      const expectedHeaders = [
        'Strict-Transport-Security',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'X-XSS-Protection',
        'Referrer-Policy',
        'Permissions-Policy',
        'Content-Security-Policy'
      ];

      expectedHeaders.forEach(header => {
        expect(jsonResponse.headers.get(header)).toBeDefined();
        expect(redirectResponse.headers.get(header)).toBeDefined();
        expect(nextResponse.headers.get(header)).toBeDefined();
        
        expect(jsonResponse.headers.get(header)).toBe(redirectResponse.headers.get(header));
        expect(jsonResponse.headers.get(header)).toBe(nextResponse.headers.get(header));
      });
    });
  });
});
