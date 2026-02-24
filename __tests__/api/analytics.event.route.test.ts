/**
 * Analytics Event API — Complete Test Suite
 *
 * Tests: POST /api/analytics/event
 *
 * Source: app/api/analytics/event/route.ts
 */

import { POST } from '@/app/api/analytics/event/route';
import { NextRequest } from 'next/server';

describe('POST /api/analytics/event', () => {
  it('should accept valid JSON event', async () => {
    const req = new NextRequest('http://localhost:3000/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'page_view', params: { path: '/' } }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('should return 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it('should accept empty object', async () => {
    const req = new NextRequest('http://localhost:3000/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
