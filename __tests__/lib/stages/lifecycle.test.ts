import { getActiveStageEndDateFilter, isStageExpired } from '@/lib/stages/lifecycle';

describe('stage lifecycle', () => {
  const now = new Date('2026-08-13T12:00:00.000Z');

  describe('isStageExpired', () => {
    it('considère comme expiré un stage terminé en avril', () => {
      expect(isStageExpired(new Date('2026-04-25T17:00:00.000Z'), now)).toBe(true);
    });

    it('conserve un stage dont la fin est future', () => {
      expect(isStageExpired(new Date('2026-10-25T17:00:00.000Z'), now)).toBe(false);
    });

    it("conserve un stage dont la fin est exactement à l'heure courante", () => {
      expect(isStageExpired(now, now)).toBe(false);
    });
  });

  it('produit le filtre de fin active inclusif pour Prisma', () => {
    expect(getActiveStageEndDateFilter(now)).toEqual({ gte: now });
  });
});
