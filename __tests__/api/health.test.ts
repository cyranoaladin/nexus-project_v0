/**
 * Health endpoint security tests
 * Ensures error responses don't leak sensitive information
 */

import { GET } from '@/app/api/health/route';
import { prisma } from '@/lib/prisma';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

describe('GET /api/health', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return success when database is available', async () => {
    // Mock successful database query
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();

    // CRITICAL: Should NOT expose sensitive metrics
    expect(data.database).toBeUndefined();
    expect(data.userCount).toBeUndefined();
  });

  it('should NOT expose error details in response when database fails', async () => {
    // Mock database error with sensitive info
    const sensitiveError = new Error('Connection refused at postgresql://admin:SECRET_PASSWORD@db.internal:5432/prod');
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(sensitiveError);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('error');
    expect(data.message).toBe('Service temporarily unavailable');

    // CRITICAL: Must NOT expose error details
    expect(data.error).toBeUndefined();
    expect(data.database).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain('SECRET_PASSWORD');
    expect(JSON.stringify(data)).not.toContain('Connection refused');
    expect(JSON.stringify(data)).not.toContain('postgresql://');
  });

  it('should return 503 (not 500) when database is unavailable', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await GET();

    // 503 Service Unavailable is more appropriate than 500 Internal Server Error
    expect(response.status).toBe(503);
  });

  it('should include timestamp in all responses', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0);
  });

  it('should NOT expose internal metrics like userCount', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await GET();
    const data = await response.json();

    // Healthcheck should be minimal - no business metrics exposed
    expect(data).toEqual({
      status: 'ok',
      timestamp: expect.any(String)
    });
  });
});
