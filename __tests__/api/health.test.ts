/**
 * Health endpoint security tests
 * Ensures error responses don't leak sensitive information
 */

import { GET } from '@/app/api/health/route';
import { prisma } from '@/lib/prisma';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      count: jest.fn(),
    },
  },
}));

describe('GET /api/health', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return success when database is available', async () => {
    // Mock successful database query
    (prisma.user.count as jest.Mock).mockResolvedValue(42);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('success');
    expect(data.database.connected).toBe(true);
    expect(data.database.userCount).toBe(42);
  });

  it('should NOT expose error details in response when database fails', async () => {
    // Mock database error with sensitive info
    const sensitiveError = new Error('Connection refused at postgresql://admin:SECRET_PASSWORD@db.internal:5432/prod');
    (prisma.user.count as jest.Mock).mockRejectedValue(sensitiveError);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('error');
    expect(data.message).toBe('Service temporarily unavailable');

    // CRITICAL: Must NOT expose error details
    expect(data.error).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain('SECRET_PASSWORD');
    expect(JSON.stringify(data)).not.toContain('Connection refused');
    expect(JSON.stringify(data)).not.toContain('postgresql://');
  });

  it('should return 503 (not 500) when database is unavailable', async () => {
    (prisma.user.count as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await GET();

    // 503 Service Unavailable is more appropriate than 500 Internal Server Error
    expect(response.status).toBe(503);
  });

  it('should include timestamp in all responses', async () => {
    (prisma.user.count as jest.Mock).mockResolvedValue(10);

    const response = await GET();
    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0);
  });
});
