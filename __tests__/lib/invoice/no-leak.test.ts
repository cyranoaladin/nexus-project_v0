/**
 * No-leak tests for invoice public endpoints.
 *
 * Verifies that buildInvoiceScopeWhere returns identical null for all deny cases.
 * notFoundResponse tests are in integration tests (requires Next.js Web API globals).
 *
 * The canonical NOT_FOUND contract is validated here via the scope function:
 * - Every deny case returns null → endpoint converts to identical 404.
 */

import { buildInvoiceScopeWhere, notFoundResponse } from '@/lib/invoice/not-found';

// Exercise canonical response generation rather than a copy of its implementation.
describe('NOT_FOUND canonical body contract', () => {
  it('canonical response contains only NOT_FOUND and cannot expose auth state', async () => {
    const response = notFoundResponse();
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'NOT_FOUND' });
  });
  it('fresh deny responses have identical body, status and headers', async () => {
    const responses = Array.from({ length: 6 }, () => notFoundResponse());
    const bodies = await Promise.all(responses.map(response => response.json()));
    expect(bodies).toEqual(Array(6).fill({ error: 'NOT_FOUND' }));
    expect(responses.map(response => response.status)).toEqual(Array(6).fill(404));
    const headers = responses.map(response => Array.from(response.headers.entries()));
    headers.forEach(value => expect(value).toEqual(headers[0]));
  });
  it('deny response never substitutes 401 or 403', () => {
    expect(notFoundResponse().status).not.toBe(401);
    expect(notFoundResponse().status).not.toBe(403);
  });
});

// ─── buildInvoiceScopeWhere (pure, always runs) ──────────────────────────────

describe('buildInvoiceScopeWhere', () => {
  const id = 'inv-123';

  it('ADMIN → returns { id } (full access)', () => {
    expect(buildInvoiceScopeWhere(id, 'ADMIN', null)).toEqual({ id });
  });

  it('ASSISTANTE → canonical staff scope permits private invoice management', () => {
    expect(buildInvoiceScopeWhere(id, 'ASSISTANTE', null)).toEqual({ id });
  });

  it('PARENT with email alone → denied without payer authority', () => {
    expect(buildInvoiceScopeWhere(id, 'PARENT', 'parent@test.com')).toBeNull();
  });

  it('PARENT without email → returns null (no access)', () => {
    expect(buildInvoiceScopeWhere(id, 'PARENT', null)).toBeNull();
  });

  it('PARENT with undefined email → returns null', () => {
    expect(buildInvoiceScopeWhere(id, 'PARENT', undefined)).toBeNull();
  });

  it('ELEVE → returns null (no access)', () => {
    expect(buildInvoiceScopeWhere(id, 'ELEVE', 'eleve@test.com')).toBeNull();
  });

  it('COACH → returns null (no access)', () => {
    expect(buildInvoiceScopeWhere(id, 'COACH', 'coach@test.com')).toBeNull();
  });

  it('undefined role → returns null (no access)', () => {
    expect(buildInvoiceScopeWhere(id, undefined, 'any@test.com')).toBeNull();
  });

  it('unknown role → returns null (no access)', () => {
    expect(buildInvoiceScopeWhere(id, 'SUPERADMIN', 'any@test.com')).toBeNull();
  });

  it('all deny cases produce null (consistent no-access)', () => {
    const denyCases = [
      buildInvoiceScopeWhere(id, 'ELEVE', 'e@t.com'),
      buildInvoiceScopeWhere(id, 'COACH', 'c@t.com'),
      buildInvoiceScopeWhere(id, 'UNKNOWN', null),
      buildInvoiceScopeWhere(id, 'PARENT', null),
      buildInvoiceScopeWhere(id, undefined, null),
      buildInvoiceScopeWhere(id, '', null),
    ];
    denyCases.forEach((result) => expect(result).toBeNull());
  });
});
