import { prisma } from '@/lib/prisma';
import sitemap from '@/app/sitemap';

const NOW = new Date('2026-08-13T12:00:00.000Z');
const PAST_STAGE = {
  slug: 'stage-expire-visible',
  updatedAt: new Date('2026-04-25T17:00:00.000Z'),
};
const FUTURE_STAGE = {
  slug: 'toussaint-2026',
  updatedAt: new Date('2026-10-20T08:00:00.000Z'),
};

describe('Sitemap des stages expirés', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    (prisma.stage.findMany as jest.Mock).mockImplementation(({ where } = {}) => {
      const activeFrom = where?.endDate?.gte;

      return Promise.resolve(
        activeFrom instanceof Date && activeFrom.getTime() === NOW.getTime()
          ? [FUTURE_STAGE]
          : [PAST_STAGE, FUTURE_STAGE],
      );
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('requête uniquement les stages non terminés et exclut le passé', async () => {
    const entries = await sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname);

    expect(prisma.stage.findMany).toHaveBeenCalledWith({
      where: {
        isVisible: true,
        endDate: { gte: NOW },
      },
      select: { slug: true, updatedAt: true },
    });
    expect(paths).toEqual(expect.arrayContaining([
      '/stages/toussaint-2026',
      '/stages/toussaint-2026/inscription',
    ]));
    expect(paths).not.toContain('/stages/stage-expire-visible');
    expect(paths).not.toContain('/stages/stage-expire-visible/inscription');
  });
});
