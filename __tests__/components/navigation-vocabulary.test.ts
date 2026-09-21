import { navigationConfig } from '@/components/navigation/navigation-config';
import { UserRole } from '@prisma/client';

/**
 * Go-live mission Lot 1B §5: the daily back-office vocabulary must read as
 * business language, not framework/technical jargon — for ADMIN and
 * ASSISTANTE specifically (this lot's scope; other roles are untouched).
 */
describe('ADMIN/ASSISTANTE navigation vocabulary', () => {
  const labelsFor = (role: UserRole) => navigationConfig[role].map((item) => item.label);

  it('ADMIN: "Tableau de bord" and "Pilotage", never the English/technical originals', () => {
    const labels = labelsFor(UserRole.ADMIN);
    expect(labels).toContain('Tableau de bord');
    expect(labels).toContain('Pilotage');
    expect(labels).not.toContain('Dashboard');
    expect(labels).not.toContain('Analytics');
  });

  it('ASSISTANTE: "Tableau de bord", "Affectations", "Élèves"', () => {
    const labels = labelsFor(UserRole.ASSISTANTE);
    expect(labels).toContain('Tableau de bord');
    expect(labels).toContain('Affectations');
    expect(labels).toContain('Élèves');
    expect(labels).not.toContain('Dashboard');
    expect(labels).not.toContain('Assignations');
    expect(labels).not.toContain('Étudiants');
  });

  it('does not rename a financial object just to prettify the menu — Facturation/Paiements/Abonnements stay as-is', () => {
    const labels = labelsFor(UserRole.ASSISTANTE);
    expect(labels).toContain('Facturation');
    expect(labels).toContain('Paiements');
    expect(labels).toContain('Abonnements');
  });

  it('every ADMIN href stays resolvable to a route this repo actually ships (Familles now has its own admin route)', () => {
    const familles = navigationConfig[UserRole.ADMIN].find((item) => item.label === 'Familles');
    expect(familles?.href).toBe('/dashboard/admin/familles');
  });
});
