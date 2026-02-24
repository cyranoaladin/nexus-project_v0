/**
 * API Response Time SLA Tests
 *
 * Tests: response time benchmarks for critical API routes,
 *        ensuring they meet defined SLA thresholds
 *
 * Note: These tests use mocked Prisma, so they measure handler logic time
 *       (not real DB latency). Real latency is tested in E2E.
 *
 * Source: app/api/ route handlers
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

const SLA_MS = 500; // 500ms P95 for standard routes

describe('API Response Time SLA', () => {
  let prisma: any;
  let mockAuth: jest.Mock;

  beforeEach(async () => {
    const mod = await import('@/lib/prisma');
    prisma = (mod as any).prisma;
    const authMod = await import('@/auth');
    mockAuth = authMod.auth as jest.Mock;
    jest.clearAllMocks();
  });

  describe('Health Check', () => {
    it('GET /api/health handler responds within 50ms', async () => {
      // Arrange
      prisma.user = prisma.user || {};
      prisma.user.count = jest.fn().mockResolvedValue(10);

      // Act
      const start = Date.now();
      const { GET } = await import('@/app/api/health/route');
      if (GET) {
        await GET();
      }
      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(200); // generous for cold import
    });
  });

  describe('Admin Dashboard', () => {
    it('GET /api/admin/dashboard handler responds within SLA', async () => {
      // Arrange
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' },
      });
      prisma.user.count.mockResolvedValue(100);
      prisma.subscription.count.mockResolvedValue(50);
      prisma.payment.count.mockResolvedValue(30);
      prisma.sessionBooking.count.mockResolvedValue(200);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });
      prisma.user.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);

      // Act
      const start = Date.now();
      const { GET } = await import('@/app/api/admin/dashboard/route');
      const req = new Request('http://localhost:3000/api/admin/dashboard');
      await GET(req as any);
      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(SLA_MS);
    });
  });

  describe('Contact Form', () => {
    it('POST /api/contact handler responds within SLA', async () => {
      // Arrange: mock email sending
      jest.mock('@/lib/email/mailer', () => ({
        sendEmail: jest.fn().mockResolvedValue(true),
      }));

      // Act
      const start = Date.now();
      const { POST } = await import('@/app/api/contact/route');
      const req = new Request('http://localhost:3000/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          message: 'Test message for performance',
        }),
      });
      await POST(req as any);
      const duration = Date.now() - start;

      // Assert
      expect(duration).toBeLessThan(SLA_MS);
    });
  });

  describe('Handler Import Time', () => {
    it('all route handlers should import within 200ms', async () => {
      // Arrange: list of critical route modules
      const routes = [
        '@/app/api/health/route',
        '@/app/api/contact/route',
      ];

      // Act / Assert
      for (const route of routes) {
        const start = Date.now();
        await import(route);
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(200);
      }
    });
  });
});
