import { NextResponse } from 'next/server';

/** Financial JSON must never enter a shared cache, including refusals/errors. */
export function privateFinancialJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store');
  const vary = new Set((headers.get('Vary') ?? '').split(',').map(value => value.trim()).filter(Boolean));
  vary.add('Cookie');
  vary.add('Authorization');
  headers.set('Vary', [...vary].join(', '));
  return NextResponse.json(body, { ...init, headers });
}
