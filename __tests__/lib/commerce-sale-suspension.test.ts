import {
  SUSPENDED_SALE_SURFACES,
  isSaleSuspended,
  ARIA_SUSPENSION_REASON,
} from '@/lib/commerce/sale-suspension';

describe('suspension de vente des offres adossées à ARIA', () => {
  it('déclare suspendues les deux surfaces qui vendent ARIA', () => {
    expect(SUSPENDED_SALE_SURFACES).toContain('SUBSCRIPTION_PLAN');
    expect(SUSPENDED_SALE_SURFACES).toContain('ARIA_ADDON');
  });

  it('ferme la souscription aux abonnements et aux add-ons', () => {
    expect(isSaleSuspended('SUBSCRIPTION_PLAN')).toBe(true);
    expect(isSaleSuspended('ARIA_ADDON')).toBe(true);
  });

  it('laisse ouvertes les offres réellement livrables', () => {
    // Les packs (coaching, méthodologie, orientation) ne dépendent pas d'ARIA.
    expect(isSaleSuspended('SPECIAL_PACK')).toBe(false);
  });

  it('documente le motif : il devra être relu avant toute réouverture', () => {
    expect(ARIA_SUSPENSION_REASON).toMatch(/ARIA/);
    expect(ARIA_SUSPENSION_REASON.length).toBeGreaterThan(40);
  });
});
