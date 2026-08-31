import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { StaffReleaseFingerprintGuard } from '@/components/dashboard/staff/StaffReleaseFingerprintGuard';

const CLIENT_SHA = '1111111111111111111111111111111111111111';
const SERVER_SHA = '2222222222222222222222222222222222222222';
const mockFetch = jest.fn();

describe('StaffReleaseFingerprintGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  it.each(['ADMIN', 'ASSISTANTE'] as const)('reste silencieux pour %s quand les empreintes correspondent', async (staffRole) => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ status: 'ok', releaseSha: CLIENT_SHA }), { status: 200 }));

    render(<StaffReleaseFingerprintGuard staffRole={staffRole} clientReleaseSha={CLIENT_SHA} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/health', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
    }));
    expect(screen.queryByText('Une nouvelle version de Nexus est disponible — Recharger')).not.toBeInTheDocument();
  });

  it('affiche le mismatch sans recharger automatiquement et attend un clic explicite', async () => {
    const reloadPage = jest.fn();
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ status: 'ok', releaseSha: SERVER_SHA }), { status: 200 }));

    render(<StaffReleaseFingerprintGuard staffRole="ADMIN" clientReleaseSha={CLIENT_SHA} reloadPage={reloadPage} />);

    expect(await screen.findByText('Une nouvelle version de Nexus est disponible — Recharger')).toBeInTheDocument();
    expect(reloadPage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Recharger' }));
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it('préserve l’état de formulaire quand le bandeau apparaît', async () => {
    let resolveHealth!: (response: Response) => void;
    mockFetch.mockReturnValue(new Promise<Response>((resolve) => { resolveHealth = resolve; }));
    render(<>
      <StaffReleaseFingerprintGuard staffRole="ADMIN" clientReleaseSha={CLIENT_SHA} reloadPage={jest.fn()} />
      <label htmlFor="draft-name">Brouillon</label>
      <input id="draft-name" defaultValue="Valeur initiale" />
    </>);
    const draft = screen.getByLabelText('Brouillon');
    fireEvent.change(draft, { target: { value: 'Valeur saisie non perdue' } });

    resolveHealth(new Response(JSON.stringify({ status: 'ok', releaseSha: SERVER_SHA }), { status: 200 }));

    expect(await screen.findByText('Une nouvelle version de Nexus est disponible — Recharger')).toBeInTheDocument();
    expect(draft).toHaveValue('Valeur saisie non perdue');
  });

  it.each([
    ['client absent', null, SERVER_SHA],
    ['client invalide', 'not-a-sha', SERVER_SHA],
    ['serveur absent', CLIENT_SHA, null],
    ['serveur invalide', CLIENT_SHA, 'not-a-sha'],
  ])('échoue visiblement si l’empreinte est %s', async (_case, clientReleaseSha, releaseSha) => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ status: 'ok', releaseSha }), { status: 200 }));

    render(<StaffReleaseFingerprintGuard staffRole="ASSISTANTE" clientReleaseSha={clientReleaseSha} reloadPage={jest.fn()} />);

    expect(await screen.findByText('Une nouvelle version de Nexus est disponible — Recharger')).toBeInTheDocument();
  });
});
