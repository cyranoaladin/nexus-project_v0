import { prisma } from '@/lib/prisma';
import sitemap from '@/app/sitemap';

/**
 * Plan du site : la page session 2027 y figure en bonne place, et les dates
 * de modification sont stables (une date « maintenant » à chaque visite du robot
 * fait croire que tout change en permanence et n'apporte aucun signal).
 */
describe('Plan du site — pages publiques', () => {
  beforeEach(() => {
    (prisma.stage.findMany as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('contient /bac-candidat-libre avec une priorité élevée', async () => {
    const entree = (await sitemap()).find((e) => new URL(e.url).pathname === '/bac-candidat-libre');
    expect(entree).toBeDefined();
    expect(entree!.priority).toBeGreaterThanOrEqual(0.9);
  });

  it('les dates de modification ne dépendent pas de l’heure de la visite', async () => {
    jest.useFakeTimers({ now: new Date('2026-12-01T10:00:00Z') });
    const premiere = await sitemap();
    jest.setSystemTime(new Date('2027-01-15T10:00:00Z'));
    const seconde = await sitemap();
    const dates = (entrees: typeof premiere) =>
      entrees.filter((e) => !new URL(e.url).pathname.startsWith('/stages/')).map((e) => String(e.lastModified));
    expect(dates(seconde)).toEqual(dates(premiere));
  });
});
