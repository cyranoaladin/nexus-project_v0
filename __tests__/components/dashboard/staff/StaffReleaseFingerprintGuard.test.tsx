import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { StaffReleaseFingerprintGuard } from '@/components/dashboard/staff/StaffReleaseFingerprintGuard';
import { STAFF_RELEASE_FINGERPRINT_TIMEOUT_MS } from '@/components/dashboard/staff/StaffReleaseFingerprintGuard';

const CLIENT_SHA = '1111111111111111111111111111111111111111';
const SERVER_SHA = '2222222222222222222222222222222222222222';
const mockFetch = jest.fn();

describe('StaffReleaseFingerprintGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each(['ADMIN', 'ASSISTANTE'] as const)('reste silencieux pour %s quand les empreintes correspondent', async (staffRole) => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ status: 'ok', releaseSha: CLIENT_SHA }), { status: 200 }));

    render(<StaffReleaseFingerprintGuard staffRole={staffRole} clientReleaseSha={CLIENT_SHA} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/health', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
      signal: expect.any(AbortSignal),
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

  it('détecte un cutover ultérieur au focus sans perdre le formulaire', async () => {
    const reloadPage = jest.fn();
    let resolveInitial!: (response: Response) => void;
    mockFetch
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveInitial = resolve; }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', releaseSha: SERVER_SHA }), { status: 200 }));
    render(<>
      <StaffReleaseFingerprintGuard staffRole="ADMIN" clientReleaseSha={CLIENT_SHA} reloadPage={reloadPage} />
      <label htmlFor="long-draft">Brouillon long</label>
      <input id="long-draft" defaultValue="Initial" />
    </>);
    const draft = screen.getByLabelText('Brouillon long');
    fireEvent.change(draft, { target: { value: 'Saisie conservée' } });
    await act(async () => resolveInitial(new Response(JSON.stringify({ status: 'ok', releaseSha: CLIENT_SHA }), { status: 200 })));

    fireEvent.focus(window);

    expect(await screen.findByText('Une nouvelle version de Nexus est disponible — Recharger')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(draft).toHaveValue('Saisie conservée');
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('recontrôle quand un onglet redevient visible', async () => {
    const visibility = jest.spyOn(document, 'visibilityState', 'get');
    visibility.mockReturnValue('visible');
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', releaseSha: CLIENT_SHA }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', releaseSha: SERVER_SHA }), { status: 200 }));
    render(<StaffReleaseFingerprintGuard staffRole="ASSISTANTE" clientReleaseSha={CLIENT_SHA} reloadPage={jest.fn()} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    await act(async () => undefined);

    fireEvent(document, new Event('visibilitychange'));

    expect(await screen.findByText('Une nouvelle version de Nexus est disponible — Recharger')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    visibility.mockRestore();
  });

  it.each([
    ['réseau', () => Promise.reject(new TypeError('proxy unavailable'))],
    ['JSON proxy invalide', () => Promise.resolve(new Response('<html>proxy</html>', { status: 502 }))],
    ['proxy JSON non fiable', () => Promise.resolve(new Response(JSON.stringify({ releaseSha: SERVER_SHA }), { status: 502 }))],
  ] as const)('classe une panne %s comme inconnue puis récupère sur retry manuel', async (_case, firstResponse) => {
    const reloadPage = jest.fn();
    mockFetch
      .mockImplementationOnce(firstResponse)
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', releaseSha: CLIENT_SHA }), { status: 200 }));
    render(<StaffReleaseFingerprintGuard staffRole="ADMIN" clientReleaseSha={CLIENT_SHA} reloadPage={reloadPage} />);

    expect(await screen.findByText('Version impossible à vérifier')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Recharger' })).not.toBeInTheDocument();
    expect(reloadPage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    await waitFor(() => expect(screen.queryByText('Version impossible à vérifier')).not.toBeInTheDocument());
    expect(screen.queryByText('Une nouvelle version de Nexus est disponible — Recharger')).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('considère un health 503 avec la même SHA comme une correspondance', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ status: 'error', releaseSha: CLIENT_SHA }), { status: 503 }));

    render(<StaffReleaseFingerprintGuard staffRole="ADMIN" clientReleaseSha={CLIENT_SHA} reloadPage={jest.fn()} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    await act(async () => undefined);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('déduplique les déclencheurs concurrents et abandonne la requête au démontage', async () => {
    mockFetch.mockReturnValue(new Promise<Response>(() => undefined));
    const { unmount } = render(
      <StaffReleaseFingerprintGuard staffRole="ADMIN" clientReleaseSha={CLIENT_SHA} reloadPage={jest.fn()} />,
    );
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    fireEvent.focus(window);
    fireEvent.focus(window);
    fireEvent(document, new Event('visibilitychange'));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const signal = mockFetch.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('borne un health bloqué puis permet un retry manuel sans reload', async () => {
    jest.useFakeTimers();
    const reloadPage = jest.fn();
    mockFetch
      .mockImplementationOnce((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('timed out', 'AbortError')));
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ releaseSha: CLIENT_SHA }), { status: 200 }));
    render(<StaffReleaseFingerprintGuard staffRole="ADMIN" clientReleaseSha={CLIENT_SHA} reloadPage={reloadPage} />);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(STAFF_RELEASE_FINGERPRINT_TIMEOUT_MS + 1);
    });

    expect(screen.getByText('Version impossible à vérifier')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(reloadPage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await act(async () => undefined);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Version impossible à vérifier')).not.toBeInTheDocument();
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('ignore une ancienne réponse après changement de génération', async () => {
    let resolveOld!: (response: Response) => void;
    let resolveCurrent!: (response: Response) => void;
    mockFetch
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveOld = resolve; }))
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveCurrent = resolve; }));
    const { rerender } = render(
      <StaffReleaseFingerprintGuard staffRole="ADMIN" clientReleaseSha={CLIENT_SHA} reloadPage={jest.fn()} />,
    );
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const oldSignal = mockFetch.mock.calls[0][1].signal as AbortSignal;

    rerender(<StaffReleaseFingerprintGuard staffRole="ADMIN" clientReleaseSha={SERVER_SHA} reloadPage={jest.fn()} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => resolveCurrent(new Response(JSON.stringify({ releaseSha: SERVER_SHA }), { status: 200 })));
    await act(async () => resolveOld(new Response(JSON.stringify({ releaseSha: '3333333333333333333333333333333333333333' }), { status: 200 })));

    expect(screen.queryByText('Une nouvelle version de Nexus est disponible — Recharger')).not.toBeInTheDocument();
    expect(screen.queryByText('Version impossible à vérifier')).not.toBeInTheDocument();
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
