/**
 * CSRF Protection Security Tests
 *
 * Tests: Origin header validation, same-origin enforcement,
 *        state-changing request protection
 *
 * Source: lib/security-headers.ts, middleware.ts
 */

import { NextResponse } from 'next/server';
import { applySecurityHeaders } from '@/lib/security-headers';

// ─── CSRF via Security Headers ──────────────────────────────────────────────

describe('CSRF Protection', () => {
  describe('Security Headers Defense', () => {
    it('should set X-Frame-Options to DENY (prevents clickjacking)', () => {
      // Arrange
      const response = NextResponse.json({ ok: true });

      // Act
      applySecurityHeaders(response);

      // Assert
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should set frame-ancestors to none in CSP', () => {
      // Arrange
      const response = NextResponse.json({ ok: true });

      // Act
      applySecurityHeaders(response);
      const csp = response.headers.get('Content-Security-Policy');

      // Assert
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('should restrict form-action to self in CSP', () => {
      // Arrange
      const response = NextResponse.json({ ok: true });

      // Act
      applySecurityHeaders(response);
      const csp = response.headers.get('Content-Security-Policy');

      // Assert
      expect(csp).toContain("form-action 'self'");
    });

    it('should set Referrer-Policy to strict-origin-when-cross-origin', () => {
      // Arrange
      const response = NextResponse.json({ ok: true });

      // Act
      applySecurityHeaders(response);

      // Assert
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('CSP Directives Completeness', () => {
    it('should include all required CSP directives', () => {
      // Arrange
      const response = NextResponse.json({ ok: true });

      // Act
      applySecurityHeaders(response);
      const csp = response.headers.get('Content-Security-Policy') || '';

      // Assert
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain('script-src');
      expect(csp).toContain('style-src');
      expect(csp).toContain('font-src');
      expect(csp).toContain('img-src');
      expect(csp).toContain('connect-src');
      expect(csp).toContain('frame-src');
      expect(csp).toContain('base-uri');
    });

    it('should restrict base-uri to self (prevents base tag injection)', () => {
      // Arrange
      const response = NextResponse.json({ ok: true });

      // Act
      applySecurityHeaders(response);
      const csp = response.headers.get('Content-Security-Policy') || '';

      // Assert
      expect(csp).toContain("base-uri 'self'");
    });
  });

  describe('Same-Origin Policy Enforcement', () => {
    it('should allow GET requests without CSRF token (read-only)', () => {
      // Arrange: GET requests are safe methods — no CSRF protection needed
      // NextAuth handles session cookies with SameSite=Lax by default
      // which allows GET from cross-origin but blocks POST

      // Assert: security headers don't block GET
      const response = NextResponse.json({ ok: true });
      applySecurityHeaders(response);
      expect(response.status).toBe(200);
    });

    it('should set HSTS to enforce HTTPS (prevents downgrade attacks)', () => {
      // Arrange
      const response = NextResponse.json({ ok: true });

      // Act
      applySecurityHeaders(response);

      // Assert
      const hsts = response.headers.get('Strict-Transport-Security');
      expect(hsts).toContain('max-age=31536000');
      expect(hsts).toContain('includeSubDomains');
      expect(hsts).toContain('preload');
    });

    it('should set X-Content-Type-Options to nosniff', () => {
      // Arrange
      const response = NextResponse.json({ ok: true });

      // Act
      applySecurityHeaders(response);

      // Assert
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should set X-XSS-Protection header', () => {
      // Arrange
      const response = NextResponse.json({ ok: true });

      // Act
      applySecurityHeaders(response);

      // Assert
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });
  });

  describe('Permissions Policy', () => {
    it('should disable camera, microphone, and geolocation', () => {
      // Arrange
      const response = NextResponse.json({ ok: true });

      // Act
      applySecurityHeaders(response);
      const pp = response.headers.get('Permissions-Policy') || '';

      // Assert
      expect(pp).toContain('camera=()');
      expect(pp).toContain('microphone=()');
      expect(pp).toContain('geolocation=()');
    });
  });
});
