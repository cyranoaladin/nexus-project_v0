/**
 * « Valider et diffuser aux familles » : chaque condition non remplie
 * s'explique en toutes lettres au bouton — un bouton désactivé muet est un
 * bug d'UX, pas une sécurité (défaut du 13/08/2026 : bilan d'un foyer sans
 * e-mail, bouton grisé sans explication à côté). Le garde lui-même n'est pas
 * affaibli : la validation humaine et le contact parent restent requis.
 */

import { diffusionBlockedReasons, type RecentReportReview } from '@/lib/bilans/staff/review-service';

function review(overrides: Partial<{
  diffusable: boolean;
  actionable: boolean;
  parentEmailMissing: boolean;
  validationFailures: readonly string[];
}>): RecentReportReview {
  return {
    diffusable: overrides.diffusable ?? false,
    actionable: overrides.actionable ?? true,
    parentEmailMissing: overrides.parentEmailMissing ?? false,
    validationFailures: overrides.validationFailures ?? [],
  } as unknown as RecentReportReview;
}

describe('diffusionBlockedReasons', () => {
  it('aucun motif quand la diffusion est possible', () => {
    expect(diffusionBlockedReasons(review({ diffusable: true }))).toEqual([]);
  });

  it('e-mail parent manquant — le cas des foyers créés sans e-mail', () => {
    const reasons = diffusionBlockedReasons(review({ parentEmailMissing: true }));
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('e-mail du parent');
    expect(reasons[0]).toContain('aucun bilan ne part sans contact famille');
  });

  it('points bloquants de validation présents', () => {
    const reasons = diffusionBlockedReasons(review({ validationFailures: ['Identité élève à compléter'] }));
    expect(reasons.some((r) => r.includes('points bloquants'))).toBe(true);
  });

  it('bilan qui n’est plus en attente (diffusé, rejeté ou en correction)', () => {
    const reasons = diffusionBlockedReasons(review({ actionable: false }));
    expect(reasons.some((r) => r.includes('plus en attente de diffusion'))).toBe(true);
  });

  it('les motifs se cumulent sans doublon', () => {
    const reasons = diffusionBlockedReasons(review({
      parentEmailMissing: true,
      validationFailures: ['x'],
    }));
    expect(reasons).toHaveLength(2);
    expect(new Set(reasons).size).toBe(2);
  });
});
