jest.mock('@/lib/prisma', () => ({
  prisma: {
    stage: {
      findMany: jest.fn().mockResolvedValue([
        { slug: 'pre-rentree-2026', updatedAt: new Date('2026-07-20T00:00:00Z') },
        { slug: 'toussaint-2026', updatedAt: new Date('2026-07-20T00:00:00Z') },
      ]),
    },
  },
}));

import sitemap from '@/app/sitemap';
import { getPreRentreeReleaseGate } from '@/lib/campaigns/pre-rentree-2026/release-gate';

describe('Pré-rentrée sitemap publication guard', () => {
  it('emits one canonical route only when the campaign is approved for indexing', async () => {
    const entries = await sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname);
    const campaignPaths = paths.filter((path) => path.includes('/stages/pre-rentree-2026'));

    expect(campaignPaths).toEqual(
      getPreRentreeReleaseGate().isPublicReady
        ? ['/stages/pre-rentree-2026']
        : [],
    );
    expect(paths).toContain('/stages/toussaint-2026');
  });
});
