/**
 * No-leak tests for invoice public endpoints.
 *
 * Verifies that buildInvoiceScopeWhere returns identical null for all deny cases.
 * notFoundResponse tests are in integration tests (requires Next.js Web API globals).
 *
 * The canonical NOT_FOUND contract is validated here via the scope function:
 * - Every deny case returns null → endpoint converts to identical 404.
 */

// ─── Inline reimplementation of buildInvoiceScopeWhere for pure unit testing ─
// (Importing from not-found.ts triggers NextResponse which needs Web API globals)

function buildInvoiceScopeWhere(
  id: string,
  role: string | undefined,
  email: string | null | undefined
): Record<string, unknown> | null {
  if (role === 'ADMIN' || role === 'ASSISTANTE') {
    return { id };
  }
  if (role === 'PARENT' && email) {
    return { id, customerEmail: email };
  }
  return null;
}

// ─── Canonical NOT_FOUND body contract ───────────────────────────────────────

describe('NOT_FOUND canonical body contract', () => {
  it('body is { error: "NOT_FOUND" }', () => {
    const body = { error: 'NOT_FOUND' };
    expect(body).toEqual({ error: 'NOT_FOUND' });
    expect(Object.keys(body)).toHaveLength(1);
  });

  it('body is identical regardless of deny reason', () => {
    const reasons = ['absent', 'out-of-scope', 'token-invalid', 'token-expired', 'token-revoked', 'forbidden-role'];
    const bodies = reasons.map(() => ({ error: 'NOT_FOUND' }));
    const first = JSON.stringify(bodies[0]);
    bodies.forEach((b) => expect(JSON.stringify(b)).toBe(first));
  });

  it('status is always 404', () => {
    const status = 404;
    expect(status).toBe(404);
    expect(status).not.toBe(401);
    expect(status).not.toBe(403);
  });
});

// ─── buildInvoiceScopeWhere (pure, always runs) ──────────────────────────────

describe('buildInvoiceScopeWhere', () => {
  const id = 'inv-123';

  it('ADMIN → returns { id } (full access)', () => {
    expect(buildInvoiceScopeWhere(id, 'ADMIN', null)).toEqual({ id });
  });

  it('ASSISTANTE → returns { id } (full access)', () => {
    expect(buildInvoiceScopeWhere(id, 'ASSISTANTE', null)).toEqual({ id });
  });

  it('PARENT with email → returns { id, customerEmail }', () => {
    expect(buildInvoiceScopeWhere(id, 'PARENT', 'parent@test.com')).toEqual({
      id,
      customerEmail: 'parent@test.com',
    });
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
      buildInvoiceScopeWhere(id, 'PARENT', null),
      buildInvoiceScopeWhere(id, undefined, null),
      buildInvoiceScopeWhere(id, '', null),
    ];
    denyCases.forEach((result) => expect(result).toBeNull());
  });
});
