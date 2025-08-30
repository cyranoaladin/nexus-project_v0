import { render, screen, waitFor } from '@testing-library/react';
import { waitForElementToBeRemoved } from '@testing-library/dom';
import DashboardEleve from '@/app/dashboard/eleve/page';

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    status: 'authenticated',
    data: { user: { role: 'ELEVE', firstName: 'Test', lastName: 'User', id: 'u1' } },
  }),
}));

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    student: {},
    credits: { balance: 2 },
    nextSession: null,
    recentSessions: [],
    ariaStats: { totalConversations: 0 },
    badges: [
      {
        id: 'b1',
        name: 'ASSIDUITE_BRONZE',
        description: '3 sessions suivies',
        icon: '🥉',
        earnedAt: new Date().toISOString(),
      },
    ],
  }),
});

describe('Dashboard Élève - badges', () => {
  it('affiche les badges renvoyés par l’API', async () => {
    render((<DashboardEleve />) as any);
    // wait for main page loading to disappear
    try {
      await waitForElementToBeRemoved(() => screen.getByText(/Chargement de votre espace/i), { timeout: 3000 });
    } catch {}
    await waitFor(() => expect(screen.getAllByText(/ASSIDUITE_BRONZE/i).length).toBeGreaterThan(0));
  });
});
