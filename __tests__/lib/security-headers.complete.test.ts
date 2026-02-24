/**
 * Security Headers — Complete Test Suite
 *
 * Tests: applySecurityHeaders, applyCorsHeaders
 *
 * Source: lib/security-headers.ts
 */

import { NextResponse } from 'next/server';
import { applySecurityHeaders, applyCorsHeaders } from '@/lib/security-headers';

// ─── applySecurityHeaders ────────────────────────────────────────────────────

describe('applySecurityHeaders', () => {
  let response: NextResponse;

  beforeEach(() => {
    response = NextResponse.json({ ok: true });
  });

  it('should set Content-Security-Policy header', () => {
    applySecurityHeaders(response);
    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
  });

  it('should include script-src in CSP', () => {
    applySecurityHeaders(response);
    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toContain('script-src');
  });

  it('should include frame-ancestors none in CSP', () => {
    applySecurityHeaders(response);
    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('should set Strict-Transport-Security header', () => {
    applySecurityHeaders(response);
    const hsts = response.headers.get('Strict-Transport-Security');
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('should set X-Frame-Options to DENY', () => {
    applySecurityHeaders(response);
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('should set X-Content-Type-Options to nosniff', () => {
    applySecurityHeaders(response);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('should set X-XSS-Protection', () => {
    applySecurityHeaders(response);
    expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
  });

  it('should set Referrer-Policy', () => {
    applySecurityHeaders(response);
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('should set Permissions-Policy', () => {
    applySecurityHeaders(response);
    const pp = response.headers.get('Permissions-Policy');
    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=()');
    expect(pp).toContain('geolocation=()');
  });

  it('should return the same response object', () => {
    const result = applySecurityHeaders(response);
    expect(result).toBe(response);
  });
});

// ─── applyCorsHeaders ────────────────────────────────────────────────────────

describe('applyCorsHeaders', () => {
  let response: NextResponse;

  beforeEach(() => {
    response = NextResponse.json({ ok: true });
  });

  it('should set Access-Control-Allow-Origin to * by default', () => {
    applyCorsHeaders(response);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('should set Access-Control-Allow-Origin to first allowed origin', () => {
    applyCorsHeaders(response, ['https://nexusreussite.academy']);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://nexusreussite.academy');
  });

  it('should set Access-Control-Allow-Methods', () => {
    applyCorsHeaders(response);
    const methods = response.headers.get('Access-Control-Allow-Methods');
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
    expect(methods).toContain('PUT');
    expect(methods).toContain('DELETE');
    expect(methods).toContain('OPTIONS');
  });

  it('should set Access-Control-Allow-Headers', () => {
    applyCorsHeaders(response);
    const headers = response.headers.get('Access-Control-Allow-Headers');
    expect(headers).toContain('Content-Type');
    expect(headers).toContain('Authorization');
  });

  it('should set Access-Control-Max-Age to 86400', () => {
    applyCorsHeaders(response);
    expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
  });

  it('should return the same response object', () => {
    const result = applyCorsHeaders(response);
    expect(result).toBe(response);
  });

  it('should use wildcard when empty origins array provided', () => {
    applyCorsHeaders(response, []);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
