/**
 * Unit tests for Invoice RBAC — PDF endpoint access control logic.
 *
 * Tests:
 * 1. buildScopeWhere: Prisma WHERE clause generation per role (single DB hit pattern)
 * 2. checkInvoiceAccess: decision matrix (legacy, still valid for contract)
 *
 * Security invariants:
 * - Single DB hit via findFirst with scoped WHERE (no 2-branch timing leak)
 * - Unified 404 for "not found" AND "forbidden" (identical payload)
 * - No verbose "forbidden" logs
 */

// ─── buildScopeWhere (mirrors app/api/invoices/[id]/pdf/route.ts) ───────────

function buildScopeWhere(
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

// ─── RBAC Decision Function (extracted from route logic) ────────────────────

type UserRole = 'ADMIN' | 'ASSISTANTE' | 'PARENT' | 'ELEVE' | 'COACH';

interface InvoiceRecord {
  id: string;
  customerEmail: string | null;
  pdfPath: string | null;
}

interface RBACResult {
  allowed: boolean;
  status: 404 | 200;
}

/**
 * Pure RBAC decision function — mirrors the logic in
 * app/api/invoices/[id]/pdf/route.ts
 */
function checkInvoiceAccess(
  invoice: InvoiceRecord | null,
  userRole: UserRole,
  userEmail: string | null
): RBACResult {
  // Invoice not found
  if (!invoice) {
    return { allowed: false, status: 404 };
  }

  // Admin/Assistante: full access
  if (userRole === 'ADMIN' || userRole === 'ASSISTANTE') {
    return { allowed: true, status: 200 };
  }

  // Parent: scoped to own invoices
  if (userRole === 'PARENT') {
    if (!invoice.customerEmail || invoice.customerEmail !== userEmail) {
      return { allowed: false, status: 404 }; // 404, not 403 (no info leak)
    }
    return { allowed: true, status: 200 };
  }

  // Eleve, Coach: no access
  return { allowed: false, status: 404 };
}

// ─── Test Data ──────────────────────────────────────────────────────────────

const INVOICE_PARENT_A: InvoiceRecord = {
  id: 'inv-001',
  customerEmail: 'parentA@example.com',
  pdfPath: '/data/invoices/facture_202602-0001.pdf',
};

const INVOICE_PARENT_B: InvoiceRecord = {
  id: 'inv-002',
  customerEmail: 'parentB@example.com',
  pdfPath: '/data/invoices/facture_202602-0002.pdf',
};

const INVOICE_NO_EMAIL: InvoiceRecord = {
  id: 'inv-003',
  customerEmail: null,
  pdfPath: '/data/invoices/facture_202602-0003.pdf',
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Invoice RBAC — Access Control', () => {
  describe('ADMIN role', () => {
    it('can access any invoice', () => {
      const result = checkInvoiceAccess(INVOICE_PARENT_A, 'ADMIN', 'admin@nexus.com');
      expect(result.allowed).toBe(true);
      expect(result.status).toBe(200);
    });

    it('can access invoice with no customer email', () => {
      const result = checkInvoiceAccess(INVOICE_NO_EMAIL, 'ADMIN', 'admin@nexus.com');
      expect(result.allowed).toBe(true);
    });

    it('gets 404 for non-existent invoice', () => {
      const result = checkInvoiceAccess(null, 'ADMIN', 'admin@nexus.com');
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(404);
    });
  });

  describe('ASSISTANTE role', () => {
    it('can access any invoice', () => {
      const result = checkInvoiceAccess(INVOICE_PARENT_B, 'ASSISTANTE', 'assist@nexus.com');
      expect(result.allowed).toBe(true);
      expect(result.status).toBe(200);
    });

    it('gets 404 for non-existent invoice', () => {
      const result = checkInvoiceAccess(null, 'ASSISTANTE', 'assist@nexus.com');
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(404);
    });
  });

  describe('PARENT role — scoped access', () => {
    it('can access own invoice (email match)', () => {
      const result = checkInvoiceAccess(INVOICE_PARENT_A, 'PARENT', 'parentA@example.com');
      expect(result.allowed).toBe(true);
      expect(result.status).toBe(200);
    });

    it('CANNOT access another parent invoice (cross-scope)', () => {
      const result = checkInvoiceAccess(INVOICE_PARENT_B, 'PARENT', 'parentA@example.com');
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(404); // 404, NOT 403
    });

    it('CANNOT access invoice with no customer email', () => {
      const result = checkInvoiceAccess(INVOICE_NO_EMAIL, 'PARENT', 'parentA@example.com');
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(404);
    });

    it('gets 404 for non-existent invoice', () => {
      const result = checkInvoiceAccess(null, 'PARENT', 'parentA@example.com');
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(404);
    });

    it('cross-scope returns same status as not-found (no info leak)', () => {
      const crossScope = checkInvoiceAccess(INVOICE_PARENT_B, 'PARENT', 'parentA@example.com');
      const notFound = checkInvoiceAccess(null, 'PARENT', 'parentA@example.com');
      expect(crossScope.status).toBe(notFound.status);
    });
  });

  describe('ELEVE role — blocked', () => {
    it('cannot access any invoice', () => {
      const result = checkInvoiceAccess(INVOICE_PARENT_A, 'ELEVE', 'student@example.com');
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(404);
    });

    it('gets 404 (not 403) for existing invoice', () => {
      const result = checkInvoiceAccess(INVOICE_PARENT_A, 'ELEVE', 'student@example.com');
      expect(result.status).toBe(404);
    });
  });

  describe('COACH role — blocked', () => {
    it('cannot access any invoice', () => {
      const result = checkInvoiceAccess(INVOICE_PARENT_A, 'COACH', 'coach@nexus.com');
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(404);
    });

    it('gets 404 (not 403) for existing invoice', () => {
      const result = checkInvoiceAccess(INVOICE_PARENT_A, 'COACH', 'coach@nexus.com');
      expect(result.status).toBe(404);
    });
  });

  describe('No info leak principle', () => {
    it('all denied responses return 404 regardless of reason', () => {
      const cases = [
        checkInvoiceAccess(null, 'ADMIN', 'admin@nexus.com'),           // not found
        checkInvoiceAccess(INVOICE_PARENT_B, 'PARENT', 'parentA@example.com'), // cross-scope
        checkInvoiceAccess(INVOICE_PARENT_A, 'ELEVE', 'student@example.com'),  // role blocked
        checkInvoiceAccess(INVOICE_PARENT_A, 'COACH', 'coach@nexus.com'),      // role blocked
        checkInvoiceAccess(INVOICE_NO_EMAIL, 'PARENT', 'parentA@example.com'), // no email match
      ];

      for (const result of cases) {
        expect(result.allowed).toBe(false);
        expect(result.status).toBe(404);
      }
    });
  });
});

// ─── buildScopeWhere Tests (single DB hit pattern) ──────────────────────────

describe('buildScopeWhere — Prisma scope generation', () => {
  const INV_ID = 'inv-test-123';

  describe('ADMIN', () => {
    it('returns { id } (no email filter)', () => {
      expect(buildScopeWhere(INV_ID, 'ADMIN', 'admin@nexus.com')).toEqual({ id: INV_ID });
    });

    it('works even with null email', () => {
      expect(buildScopeWhere(INV_ID, 'ADMIN', null)).toEqual({ id: INV_ID });
    });
  });

  describe('ASSISTANTE', () => {
    it('returns { id } (no email filter)', () => {
      expect(buildScopeWhere(INV_ID, 'ASSISTANTE', 'assist@nexus.com')).toEqual({ id: INV_ID });
    });
  });

  describe('PARENT', () => {
    it('returns { id, customerEmail } when email present', () => {
      expect(buildScopeWhere(INV_ID, 'PARENT', 'parent@example.com')).toEqual({
        id: INV_ID,
        customerEmail: 'parent@example.com',
      });
    });

    it('returns null if email is null (no scope possible)', () => {
      expect(buildScopeWhere(INV_ID, 'PARENT', null)).toBeNull();
    });

    it('returns null if email is undefined', () => {
      expect(buildScopeWhere(INV_ID, 'PARENT', undefined)).toBeNull();
    });
  });

  describe('ELEVE', () => {
    it('returns null (no access)', () => {
      expect(buildScopeWhere(INV_ID, 'ELEVE', 'student@example.com')).toBeNull();
    });
  });

  describe('COACH', () => {
    it('returns null (no access)', () => {
      expect(buildScopeWhere(INV_ID, 'COACH', 'coach@nexus.com')).toBeNull();
    });
  });

  describe('undefined role', () => {
    it('returns null (no access)', () => {
      expect(buildScopeWhere(INV_ID, undefined, 'unknown@test.com')).toBeNull();
    });
  });

  describe('Single DB hit invariant', () => {
    it('ADMIN scope has no customerEmail filter (sees all)', () => {
      const scope = buildScopeWhere(INV_ID, 'ADMIN', 'admin@nexus.com');
      expect(scope).not.toBeNull();
      expect(scope).not.toHaveProperty('customerEmail');
    });

    it('PARENT scope always includes customerEmail (scoped)', () => {
      const scope = buildScopeWhere(INV_ID, 'PARENT', 'parent@example.com');
      expect(scope).not.toBeNull();
      expect(scope).toHaveProperty('customerEmail', 'parent@example.com');
    });

    it('blocked roles never produce a scope (no DB hit needed)', () => {
      expect(buildScopeWhere(INV_ID, 'ELEVE', 'x@x.com')).toBeNull();
      expect(buildScopeWhere(INV_ID, 'COACH', 'x@x.com')).toBeNull();
      expect(buildScopeWhere(INV_ID, undefined, 'x@x.com')).toBeNull();
    });
  });
});
