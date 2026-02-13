jest.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

import { GET } from '@/app/api/health/route';
import { prisma } from '@/lib/prisma';

describe('health route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ok when DB is responsive', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce(1);
    const res = await GET();
    const json = await (res as any).json();
    expect(res.status).toBe(200);
    expect(json.status).toBe('ok');
  });

  it('returns 503 when DB check fails', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('db down'));
    const res = await GET();
    const json = await (res as any).json();
    expect(res.status).toBe(503);
    expect(json.status).toBe('error');
  });
});
