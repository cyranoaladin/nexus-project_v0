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

describe('Pré-rentrée sitemap publication guard', () => {
  it('excludes both static and database routes while the campaign is not approved for indexing', async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls.filter((url) => url.includes('/stages/pre-rentree-2026'))).toHaveLength(0);
    expect(urls.map((url) => new URL(url).pathname)).toContain('/stages/toussaint-2026');
  });
});
