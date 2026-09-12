import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { useSession } from 'next-auth/react';

jest.mock('next-auth/react', () => {
  const session = {
    data: { user: { role: 'PARENT', firstName: 'Parent', lastName: 'Test' } },
    status: 'authenticated',
  };
  return {
    signOut: jest.fn(),
    useSession: jest.fn(() => session),
  };
});

jest.mock('next/navigation', () => {
  const router = { push: jest.fn() };
  return { useRouter: () => router };
});

jest.mock('@/components/dashboard/BilanGratuitBanner', () => ({
  BilanGratuitBanner: () => <div>Bannière bilan</div>,
}));

jest.mock('@/components/dashboard/parent/ChildCard', () => ({
  ChildCard: ({ child }: { child: { firstName: string } }) => <div>{child.firstName}</div>,
}));

jest.mock('@/app/dashboard/parent/add-child-dialog', () => ({
  __esModule: true,
  default: ({ onChildAdded }: { onChildAdded: () => void }) => (
    <button type="button" onClick={onChildAdded}>Simuler l’ajout réussi</button>
  ),
}));

import DashboardParent from '@/app/dashboard/parent/page';

describe('DashboardParent — guidage après ajout', () => {
  it('cannot display a late previous-household response after recovery changes the session owner', async () => {
    let completePrevious!: (value: unknown) => void;
    (useSession as jest.Mock).mockReturnValue({ data: { user: { id: 'parent-a', role: 'PARENT' } }, status: 'authenticated' });
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ children: [{ id: 'child-a', firstName: 'Synthetic child A' }] }) })
      .mockImplementationOnce(() => new Promise(resolve => { completePrevious = resolve; }))
      .mockResolvedValue({ ok: true, json: async () => ({ children: [{ id: 'child-b', firstName: 'Synthetic child B' }] }) });
    const view = render(<DashboardParent />);
    await screen.findByText('Synthetic child A');
    await userEvent.click(screen.getByRole('button', { name: 'Simuler l’ajout réussi' }));
    (useSession as jest.Mock).mockReturnValue({ data: { user: { id: 'parent-b', role: 'PARENT' } }, status: 'authenticated' });
    view.rerender(<DashboardParent />);
    await screen.findByText('Synthetic child B');
    await act(async () => completePrevious({ ok: true, json: async () => ({ children: [{ id: 'child-a', firstName: 'Synthetic child A' }] }) }));
    expect(screen.queryByText('Synthetic child A')).not.toBeInTheDocument();
  });

  it('conserve l’écran et la boîte de succès pendant le rafraîchissement des enfants', async () => {
    let resolveRefresh!: (response: Response) => void;
    const pendingRefresh = new Promise<Response>((resolve) => { resolveRefresh = resolve; });

    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ children: [] }) } as Response)
      .mockReturnValueOnce(pendingRefresh) as unknown as typeof fetch;

    render(<DashboardParent />);

    await screen.findByRole('heading', { name: /Mes Enfants/ });
    await userEvent.click(screen.getByRole('button', { name: 'Simuler l’ajout réussi' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    expect(screen.getByText('Espace Famille')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Mes Enfants/ })).toBeInTheDocument();

    await act(async () => {
      resolveRefresh({ ok: true, json: async () => ({ children: [] }) } as Response);
      await pendingRefresh;
    });
  });
});
