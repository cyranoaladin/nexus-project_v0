import { act, render, screen } from '@testing-library/react';

jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
jest.mock('@/lib/espace/client/api', () => ({ espaceApi: { overview: jest.fn() } }));

import { LiveRoster } from '@/components/espace/teacher/LiveRoster';
import { espaceApi } from '@/lib/espace/client/api';
import type { TeacherOverview } from '@/lib/espace/overview';

const base: TeacherOverview = {
  activity: { slug: 'nsi-poo-objets-qui-agissent', title: 'Des objets qui agissent', stepsTotal: 7, subjectLabel: 'NSI' },
  counts: { students: 2, notStarted: 1, inProgress: 0, submitted: 1, corrected: 0, reopened: 0 },
  rows: [
    { studentId: 's1', name: 'Ada A', groupName: 'Principal', workId: 'w1', status: 'SUBMITTED', progressSteps: 7, currentStep: 6, lastSavedAt: new Date(Date.now() - 20_000).toISOString(), submittedAt: null },
    { studentId: 's2', name: 'Bob B', groupName: 'Principal', workId: null, status: 'NOT_STARTED', progressSteps: 0, currentStep: null, lastSavedAt: null, submittedAt: null },
  ],
  generatedAt: new Date().toISOString(),
};

describe('LiveRoster', () => {
  beforeEach(() => jest.clearAllMocks());

  it('affiche progression « n/7 » en texte, statut enseignant et lien seulement quand un travail existe', async () => {
    await act(async () => {
      render(<LiveRoster initial={base} />);
    });
    const rows = screen.getAllByTestId('roster-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('7/7');
    expect(rows[0]).toHaveTextContent('À corriger'); // « Remis » côté élève
    expect(rows[0].querySelector('a')).toHaveAttribute('href', '/espace/enseignant/corriger/w1');
    expect(rows[1].querySelector('a')).toBeNull();
    expect(rows[1]).toHaveTextContent('Pas commencé');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Mis à jour', { exact: false })).toBeInTheDocument();
    expect(espaceApi.overview).not.toHaveBeenCalled(); // pas d'appel avant l'intervalle
  });

  it('état vide explicite', async () => {
    await act(async () => {
      render(<LiveRoster initial={{ ...base, rows: [], counts: { ...base.counts, students: 0 } }} />);
    });
    expect(screen.getByText(/Aucun élève inscrit/)).toBeInTheDocument();
  });
});
