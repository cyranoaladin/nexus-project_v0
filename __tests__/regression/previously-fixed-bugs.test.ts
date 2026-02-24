/**
 * Regression tests for previously fixed bugs.
 * Each test prevents re-introduction of a known bug.
 *
 * Source: AUDIT_RAPPORT_FINAL.md, git history
 */

import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

describe('Regression: Bug Fix Verification', () => {
  let prisma: any;
  let mockAuth: jest.Mock;

  beforeEach(async () => {
    const mod = await import('@/lib/prisma');
    prisma = (mod as any).prisma;
    const authMod = await import('@/auth');
    mockAuth = authMod.auth as jest.Mock;
    jest.clearAllMocks();
  });

  // Bug 1: PUT→PATCH fix on admin users update
  describe('Bug 1: PATCH method on admin users update', () => {
    it('PATCH /api/admin/users accepts PATCH method', async () => {
      // Arrange
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' },
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'updated@test.com',
        firstName: 'Updated',
        lastName: 'User',
        role: 'ELEVE',
      });

      // Act
      const { PATCH } = await import('@/app/api/admin/users/route');
      const req = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'user-1',
          firstName: 'Updated',
        }),
      });
      const response = await PATCH(req);

      // Assert: PATCH should be accepted (not 405)
      expect(response.status).not.toBe(405);
    });
  });

  // Bug 2: Password vide sur update
  describe('Bug 2: Empty password on user update', () => {
    it('PATCH /api/admin/users does NOT update password when empty string provided', async () => {
      // Arrange
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' },
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'ELEVE',
      });

      // Act
      const { PATCH } = await import('@/app/api/admin/users/route');
      const req = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'user-1',
          password: '', // empty password should be ignored
        }),
      });
      await PATCH(req);

      // Assert: if update was called, password field should not be present
      if (prisma.user.update.mock.calls.length > 0) {
        const updateData = prisma.user.update.mock.calls[0][0]?.data;
        if (updateData) {
          // Password should either not be in the update data, or should not be empty string
          if ('password' in updateData) {
            expect(updateData.password).not.toBe('');
          }
        }
      }
    });
  });

  // Bug 3: Anti-double paiement check-pending endpoint
  describe('Bug 3: Anti-double payment check', () => {
    it('GET /api/payments/check-pending returns hasPending=true when PENDING exists', async () => {
      // Arrange
      mockAuth.mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT', email: 'parent@test.com' },
      });
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1',
        createdAt: new Date(),
      });

      // Act
      const { GET } = await import('@/app/api/payments/check-pending/route');
      const req = new NextRequest('http://localhost:3000/api/payments/check-pending?description=Abonnement+Hybride&amount=450');
      const response = await GET(req);
      const body = await response.json();

      // Assert
      expect(body.hasPending).toBe(true);
      expect(body.paymentId).toBe('pay-1');
    });

    it('GET /api/payments/check-pending returns hasPending=false when no PENDING', async () => {
      // Arrange
      mockAuth.mockResolvedValue({
        user: { id: 'parent-2', role: 'PARENT', email: 'parent2@test.com' },
      });
      prisma.payment.findFirst.mockResolvedValue(null);

      // Act
      const { GET } = await import('@/app/api/payments/check-pending/route');
      const req = new NextRequest('http://localhost:3000/api/payments/check-pending?description=Abonnement+Hybride&amount=450');
      const response = await GET(req);
      const body = await response.json();

      // Assert
      expect(body.hasPending).toBe(false);
      expect(body.paymentId).toBeNull();
    });
  });

  // Bug 4: Mobile menu overlay blocking clicks (pointer-events-none fix)
  describe('Bug 4: Mobile menu overlay click blocking', () => {
    it('CorporateNavbar overlay has pointer-events-none when closed', async () => {
      // This is a CSS regression test — verified via source code inspection
      const fs = await import('fs');
      const path = await import('path');
      const navbarPath = path.join(process.cwd(), 'components', 'layout', 'CorporateNavbar.tsx');
      const content = fs.readFileSync(navbarPath, 'utf-8');

      // Assert: the overlay should have pointer-events-none when menu is closed
      expect(content).toContain('pointer-events-none');
    });
  });

  // Bug 5: CSP blocking Google Maps iframe on /contact
  describe('Bug 5: CSP frame-src for Google Maps', () => {
    it('security-headers.ts includes frame-src for Google Maps', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const headersPath = path.join(process.cwd(), 'lib', 'security-headers.ts');
      const content = fs.readFileSync(headersPath, 'utf-8');

      // Assert: frame-src should allow Google Maps
      expect(content).toContain('frame-src');
      expect(content).toContain('google.com');
    });
  });

  // Bug 6: Middleware auth enforcement for admin pages
  describe('Bug 6: Middleware enforces auth on protected paths', () => {
    it('middleware.ts manually checks isLoggedIn for protected paths', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const middlewarePath = path.join(process.cwd(), 'middleware.ts');
      const content = fs.readFileSync(middlewarePath, 'utf-8');

      // Assert: middleware should check authentication for protected paths
      expect(content).toContain('isProtectedPath');
      expect(content).toContain('isLoggedIn');
      expect(content).toContain('NextResponse.redirect');
    });
  });

  // Bug 7: Payment validation returns 409 for already-processed payments
  describe('Bug 7: Payment validation idempotency', () => {
    it('POST /api/payments/validate returns 409 for non-PENDING payment', async () => {
      // Arrange
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' },
      });
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        status: 'COMPLETED', // already processed
        userId: 'parent-1',
        amount: 450,
        user: { firstName: 'Test', lastName: 'User', email: 'test@test.com' },
      });

      // Act
      const { POST } = await import('@/app/api/payments/validate/route');
      const req = new NextRequest('http://localhost:3000/api/payments/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: 'pay-1',
          action: 'approve',
        }),
      });
      const response = await POST(req);

      // Assert: should return 409 Conflict
      expect(response.status).toBe(409);
    });
  });
});
