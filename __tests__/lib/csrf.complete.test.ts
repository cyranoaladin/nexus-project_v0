/**
 * CSRF Protection — Complete Test Suite
 *
 * Tests: checkCsrf, checkBodySize
 *
 * Source: lib/csrf.ts
 */

import { NextRequest } from 'next/server';
import { checkCsrf, checkBodySize } from '@/lib/csrf';

// ─── checkCsrf ───────────────────────────────────────────────────────────────

describe('checkCsrf', () => {
  it('should allow GET requests', () => {
    const req = new NextRequest('http://localhost:3000/api/test', { method: 'GET' });
    expect(checkCsrf(req)).toBeNull();
  });

  it('should allow HEAD requests', () => {
    const req = new NextRequest('http://localhost:3000/api/test', { method: 'HEAD' });
    expect(checkCsrf(req)).toBeNull();
  });

  it('should allow OPTIONS requests', () => {
    const req = new NextRequest('http://localhost:3000/api/test', { method: 'OPTIONS' });
    expect(checkCsrf(req)).toBeNull();
  });

  it('should allow POST requests from same origin (localhost)', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(checkCsrf(req)).toBeNull();
  });

  it('should allow PUT requests from same origin (localhost)', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'PUT',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(checkCsrf(req)).toBeNull();
  });

  it('should allow DELETE requests from same origin (localhost)', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'DELETE',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(checkCsrf(req)).toBeNull();
  });

  it('should allow PATCH requests from same origin (localhost)', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'PATCH',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(checkCsrf(req)).toBeNull();
  });

  it('should allow POST from 127.0.0.1 on any port', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1:4000' },
    });
    expect(checkCsrf(req)).toBeNull();
  });

  it('should allow POST without origin/referer in non-production', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
    });
    // In non-production, missing origin/referer is allowed (curl, Postman)
    expect(checkCsrf(req)).toBeNull();
  });

  it('should allow POST from production domain', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { origin: 'https://nexusreussite.academy' },
    });
    expect(checkCsrf(req)).toBeNull();
  });

  it('should allow POST using referer header as fallback', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { referer: 'http://localhost:3000/dashboard' },
    });
    expect(checkCsrf(req)).toBeNull();
  });
});

// ─── checkBodySize ───────────────────────────────────────────────────────────

describe('checkBodySize', () => {
  it('should allow requests without content-length', () => {
    const req = new NextRequest('http://localhost:3000/api/test', { method: 'POST' });
    expect(checkBodySize(req)).toBeNull();
  });

  it('should allow requests within size limit', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'content-length': '1000' },
    });
    expect(checkBodySize(req)).toBeNull();
  });

  it('should allow requests at exactly the limit', () => {
    const maxBytes = 1024 * 1024; // 1MB
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'content-length': maxBytes.toString() },
    });
    expect(checkBodySize(req)).toBeNull();
  });

  it('should reject requests exceeding size limit', () => {
    const overLimit = (1024 * 1024 + 1).toString();
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'content-length': overLimit },
    });
    const result = checkBodySize(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(413);
  });

  it('should reject oversized requests with custom limit', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'content-length': '600' },
    });
    const result = checkBodySize(req, 500);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(413);
  });

  it('should allow requests within custom limit', () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'content-length': '400' },
    });
    expect(checkBodySize(req, 500)).toBeNull();
  });

  it('should include error message in rejection body', async () => {
    const req = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: { 'content-length': '9999999' },
    });
    const result = checkBodySize(req);
    expect(result).not.toBeNull();
    const body = await result!.json();
    expect(body.error).toContain('Payload too large');
  });
});
