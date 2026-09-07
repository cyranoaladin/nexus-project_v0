/**
 * Tâche 14 — "ASSISTANTE complète famille, activation, carte académique,
 * assignation, planning et facturation sans SQL ni Admin" (spec design,
 * bullet "Dashboard projections"). Cette page liait déjà assignations,
 * abonnements, paiements et facturation ; il manquait un lien vers le
 * planning des séances gouvernées (Tâches 10-13). Test de non-régression :
 * le lien existe, cible la page canonique, et la page ne mute jamais de
 * famille de façon générique (pas de formulaire de création d'utilisateur
 * PARENT/ELEVE sur cette page).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import StudentProfilePage from '@/app/dashboard/assistante/students/[studentId]/page';

const mockSession = { data: { user: { role: 'ASSISTANTE' } }, status: 'authenticated' };
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useParams: () => ({ studentId: 's1' }),
}));
jest.mock('next-auth/react', () => ({ useSession: () => mockSession, signOut: jest.fn() }));
jest.mock('@/components/dashboard/assistante/StudentDocumentsManager', () => ({
  __esModule: true,
  default: () => React.createElement('div', null, 'Documents élève'),
}));
jest.mock('@/components/dashboard/assistante/StudentAcademicMap', () => ({
  StudentAcademicMap: () => React.createElement('div', null, 'Carte académique'),
}));

const overviewResponse = {
  student: {
    id: 's1',
    gradeLevel: 'PREMIERE',
    academicTrack: 'GENERAL',
    user: { firstName: 'Nora', lastName: 'Test', email: 'nora@example.test' },
    parent: { user: { firstName: 'Parent', lastName: 'Test' } },
    subscriptions: [],
  },
  assignments: [],
};

describe('Assistante student page — operational sequence', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => overviewResponse });
  });

  it('links out to the canonical governed-planning page for the operational sequence', async () => {
    render(React.createElement(StudentProfilePage));
    const planningLink = await screen.findByRole('link', { name: 'Voir planning' });
    expect(planningLink).toHaveAttribute('href', '/dashboard/assistante/planning');
  });

  it('still links out to assignments (existing connective navigation, unchanged)', async () => {
    render(React.createElement(StudentProfilePage));
    const assignmentsLink = await screen.findByRole('link', { name: 'Voir assignations' });
    expect(assignmentsLink).toHaveAttribute('href', '/dashboard/assistante/assignments?studentId=s1');
  });

  it('never embeds a generic PARENT/ELEVE user-creation form on this page (Amendement 6)', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'app/dashboard/assistante/students/[studentId]/page.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/role:\s*["'](PARENT|ELEVE)["']/);
    expect(source).not.toContain('/api/admin/users');
  });
});
