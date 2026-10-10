import type { EspaceActor } from '@/lib/espace/guards';

const enrollmentList = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    espaceEnrollment: { findMany: (...a: unknown[]) => enrollmentList(...a) },
    espaceSession: { findMany: jest.fn().mockResolvedValue([]) },
    espaceWork: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

import { getStudentDashboard } from '@/lib/espace/overview';

const SLUG = 'maths-second-degre';
const actor = { id: 'eleve-test', role: 'ELEVE', firstName: 'Élève' } as EspaceActor;
const mathsSlugs = async () => (await getStudentDashboard(actor)).subjects.find((s) => s.subject === 'MATHEMATIQUES')?.activities.map((a) => a.slug) ?? [];

describe('le parcours « Le second degré » est proposé aux élèves de Première seulement', () => {
  it('élève inscrit en maths dans le groupe premiere-generale : visible, avec les autres modules de maths inchangés', async () => {
    enrollmentList.mockResolvedValue([{ subject: 'MATHEMATIQUES', group: { slug: 'premiere-generale' } }]);
    const slugs = await mathsSlugs();
    expect(slugs).toContain(SLUG);
    expect(slugs).toEqual(expect.arrayContaining(['maths-fonctions-limites', 'maths-suites-synthese']));
  });

  it('élève de Terminale : jamais proposé', async () => {
    enrollmentList.mockResolvedValue([{ subject: 'MATHEMATIQUES', group: { slug: 'terminale-principal' } }]);
    const slugs = await mathsSlugs();
    expect(slugs).not.toContain(SLUG);
    expect(slugs).toContain('maths-fonctions-limites');
  });

  it('le groupe de Première suivi dans une AUTRE matière ne suffit pas', async () => {
    enrollmentList.mockResolvedValue([
      { subject: 'MATHEMATIQUES', group: { slug: 'terminale-principal' } },
      { subject: 'NSI', group: { slug: 'premiere-generale' } },
    ]);
    expect(await mathsSlugs()).not.toContain(SLUG);
  });

  it('inscriptions dans plusieurs groupes : un seul groupe de Première suffit', async () => {
    enrollmentList.mockResolvedValue([
      { subject: 'MATHEMATIQUES', group: { slug: 'terminale-principal' } },
      { subject: 'MATHEMATIQUES', group: { slug: 'premiere-generale' } },
    ]);
    expect(await mathsSlugs()).toContain(SLUG);
  });
});
