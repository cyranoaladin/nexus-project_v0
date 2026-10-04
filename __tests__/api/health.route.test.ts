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
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('db down'));
    const res = await GET();
    const json = await (res as any).json();
    expect(res.status).toBe(503);
    expect(json.status).toBe('error');
    errSpy.mockRestore();
  });

  it('never logs underlying database connection details', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      jest.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('SYNTHETIC_PRIVATE_DATABASE_DETAIL'));
      expect((await GET()).status).toBe(503);
      expect(JSON.stringify(errSpy.mock.calls)).not.toContain('SYNTHETIC_PRIVATE_DATABASE_DETAIL');
      expect(errSpy).toHaveBeenCalled();
    } finally { errSpy.mockRestore(); }
  });
});
