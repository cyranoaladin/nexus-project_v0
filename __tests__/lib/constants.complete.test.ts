/**
 * Business Constants — Complete Test Suite
 *
 * Tests: SUBSCRIPTION_PLANS, SPECIAL_PACKS, ARIA_ADDONS, CREDIT_COSTS
 *
 * Source: lib/constants.ts
 */

import {
  SUBSCRIPTION_PLANS,
  SPECIAL_PACKS,
  ARIA_ADDONS,
  CREDIT_COSTS,
} from '@/lib/constants';

// ─── SUBSCRIPTION_PLANS ──────────────────────────────────────────────────────

describe('SUBSCRIPTION_PLANS', () => {
  it('should have 3 plans', () => {
    expect(Object.keys(SUBSCRIPTION_PLANS)).toHaveLength(3);
  });

  it('should have ACCES_PLATEFORME plan', () => {
    const plan = SUBSCRIPTION_PLANS.ACCES_PLATEFORME;
    expect(plan.name).toBe('ACCÈS PLATEFORME');
    expect(plan.price).toBe(150);
    expect(plan.credits).toBe(0);
    expect(plan.features.length).toBeGreaterThan(0);
  });

  it('should have HYBRIDE plan marked as popular', () => {
    const plan = SUBSCRIPTION_PLANS.HYBRIDE;
    expect(plan.name).toBe('HYBRIDE');
    expect(plan.price).toBe(450);
    expect(plan.credits).toBe(0);
    expect(plan.popular).toBe(true);
  });

  it('should have IMMERSION plan', () => {
    const plan = SUBSCRIPTION_PLANS.IMMERSION;
    expect(plan.name).toBe('IMMERSION');
    expect(plan.price).toBe(750);
    expect(plan.credits).toBe(0);
  });

  it('should have increasing prices', () => {
    expect(SUBSCRIPTION_PLANS.ACCES_PLATEFORME.price).toBeLessThan(SUBSCRIPTION_PLANS.HYBRIDE.price);
    expect(SUBSCRIPTION_PLANS.HYBRIDE.price).toBeLessThan(SUBSCRIPTION_PLANS.IMMERSION.price);
  });

  it('retains every plan without granting or advertising credits', () => {
    Object.values(SUBSCRIPTION_PLANS).forEach((plan) => {
      expect(plan.credits).toBe(0);
      expect(plan.features.join(' ')).not.toMatch(/cr[ée]dit/i);
    });
  });

  it('should have non-empty features for all plans', () => {
    Object.values(SUBSCRIPTION_PLANS).forEach((plan) => {
      expect(plan.features.length).toBeGreaterThan(0);
      plan.features.forEach((f) => expect(f.length).toBeGreaterThan(0));
    });
  });
});

// ─── SPECIAL_PACKS ───────────────────────────────────────────────────────────

describe('SPECIAL_PACKS', () => {
  it('should have 3 packs', () => {
    expect(Object.keys(SPECIAL_PACKS)).toHaveLength(3);
  });

  it('should have GRAND_ORAL pack', () => {
    expect(SPECIAL_PACKS.GRAND_ORAL.name).toContain('Grand Oral');
    expect(SPECIAL_PACKS.GRAND_ORAL.price).toBe(750);
  });

  it('should have BAC_FRANCAIS pack', () => {
    expect(SPECIAL_PACKS.BAC_FRANCAIS.name).toContain('Français');
    expect(SPECIAL_PACKS.BAC_FRANCAIS.price).toBe(1200);
  });

  it('should have ORIENTATION pack', () => {
    expect(SPECIAL_PACKS.ORIENTATION.name).toContain('Orientation');
    expect(SPECIAL_PACKS.ORIENTATION.price).toBe(900);
  });

  it('should have descriptions for all packs', () => {
    Object.values(SPECIAL_PACKS).forEach((pack) => {
      expect(pack.description.length).toBeGreaterThan(0);
    });
  });

  it('should have non-empty features for all packs', () => {
    Object.values(SPECIAL_PACKS).forEach((pack) => {
      expect(pack.features.length).toBeGreaterThan(0);
    });
  });
});

// ─── ARIA_ADDONS ─────────────────────────────────────────────────────────────

describe('ARIA_ADDONS', () => {
  it('should have 2 add-ons', () => {
    expect(Object.keys(ARIA_ADDONS)).toHaveLength(2);
  });

  it('should have MATIERE_SUPPLEMENTAIRE add-on', () => {
    expect(ARIA_ADDONS.MATIERE_SUPPLEMENTAIRE.price).toBe(50);
    expect(ARIA_ADDONS.MATIERE_SUPPLEMENTAIRE.name).toContain('ARIA');
  });

  it('should have ANALYSE_APPROFONDIE add-on', () => {
    expect(ARIA_ADDONS.ANALYSE_APPROFONDIE.price).toBe(75);
    expect(ARIA_ADDONS.ANALYSE_APPROFONDIE.name).toContain('ARIA');
  });

  it('should have positive prices', () => {
    Object.values(ARIA_ADDONS).forEach((addon) => {
      expect(addon.price).toBeGreaterThan(0);
    });
  });
});

// ─── CREDIT_COSTS ────────────────────────────────────────────────────────────

describe('CREDIT_COSTS', () => {
  it('retains the service catalog with no active credit costs', () => {
    expect(CREDIT_COSTS).toEqual({
      COURS_ONLINE: 0,
      COURS_PRESENTIEL: 0,
      ATELIER_GROUPE: 0,
    });
  });
});
