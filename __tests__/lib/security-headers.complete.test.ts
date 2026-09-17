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

  it('should keep assistant quote tool CDN exceptions out of the global CSP', () => {
    applySecurityHeaders(response);
    const csp = response.headers.get('Content-Security-Policy') || '';
    const scriptSrc = csp
      .split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith('script-src')) || '';

    expect(scriptSrc).not.toContain('https://cdn.tailwindcss.com');
    expect(scriptSrc).not.toContain('https://cdnjs.cloudflare.com');
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

  it('should set Permissions-Policy, scoping camera/microphone to the trusted Jitsi origin rather than blocking them everywhere', () => {
    applySecurityHeaders(response);
    const pp = response.headers.get('Permissions-Policy');
    // An empty allowlist (camera=()) would also block the Jitsi iframe
    // CSP's frame-src explicitly trusts — that contradiction is the bug
    // being fixed here, so this must NOT be an empty allowlist.
    expect(pp).toContain('camera=(self "https://meet.jit.si")');
    expect(pp).toContain('microphone=(self "https://meet.jit.si")');
    expect(pp).toContain('geolocation=()');
  });

  it('every origin the CSP frame-src trusts for camera/microphone use is also granted by Permissions-Policy — no contradiction between the two headers', () => {
    applySecurityHeaders(response);
    const csp = response.headers.get('Content-Security-Policy') ?? '';
    const pp = response.headers.get('Permissions-Policy') ?? '';
    const frameSrcMatch = csp.match(/frame-src ([^;]+)/);
    expect(frameSrcMatch).not.toBeNull();
    const jitsiOrigin = 'https://meet.jit.si';
    expect(frameSrcMatch![1]).toContain(jitsiOrigin);
    expect(pp).toContain(`camera=(self "${jitsiOrigin}")`);
    expect(pp).toContain(`microphone=(self "${jitsiOrigin}")`);
  });

  it('honours NEXT_PUBLIC_JITSI_SERVER_URL for both frame-src and Permissions-Policy — no hardcoded domain that ignores configuration', () => {
    const previous = process.env.NEXT_PUBLIC_JITSI_SERVER_URL;
    process.env.NEXT_PUBLIC_JITSI_SERVER_URL = 'https://visio.nexusreussite.academy';
    try {
      const configuredResponse = NextResponse.json({ ok: true });
      applySecurityHeaders(configuredResponse);
      const csp = configuredResponse.headers.get('Content-Security-Policy') ?? '';
      const pp = configuredResponse.headers.get('Permissions-Policy') ?? '';
      expect(csp).toContain('https://visio.nexusreussite.academy');
      expect(csp).not.toContain('meet.jit.si');
      expect(pp).toContain('camera=(self "https://visio.nexusreussite.academy")');
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_JITSI_SERVER_URL;
      else process.env.NEXT_PUBLIC_JITSI_SERVER_URL = previous;
    }
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
