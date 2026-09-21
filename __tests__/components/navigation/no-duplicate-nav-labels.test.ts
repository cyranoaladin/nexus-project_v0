import { navigationConfig } from '@/components/navigation/navigation-config';
import { UserRole } from '@/types/enums';

/**
 * Go-live mission (Jalon B reconciliation): PR #312 renames ADMIN's
 * "Analytics" nav item to "Pilotage"; this branch separately adds a NEW
 * operational-indicators entry. Naming both "Pilotage" would make the final
 * menu show two rubriques with the same label and different functions —
 * this branch's entry is deliberately named "Suivi opérationnel" instead.
 * The second test below is the general invariant: no role's menu may ever
 * contain two items sharing a label, regardless of which future PR adds one.
 */
describe('navigation labels never collide', () => {
  test('the operational-indicators entry is named distinctly from any historical/analytics "Pilotage" entry', () => {
    for (const role of [UserRole.ADMIN, UserRole.ASSISTANTE] as const) {
      const operational = navigationConfig[role].find((item) => item.href.endsWith('/pilotage'));
      expect(operational?.label).toBe('Suivi opérationnel');
      expect(operational?.label).not.toBe('Pilotage');
    }
  });

  test.each(Object.values(UserRole))('%s has no two navigation items sharing the same label', (role) => {
    const labels = navigationConfig[role as UserRole].map((item) => item.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
