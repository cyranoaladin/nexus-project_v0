import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CandidatIndividuelShell } from '@/components/dashboard/assistante/CandidatIndividuelShell';
import { CANDIDATE_STUDENT_HANDOFF_KEY, stageCandidateStudentHandoff } from '@/lib/quotes/candidat-individuel-navigation';

const refresh = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
jest.mock('@/components/dashboard/assistante/CandidatIndividuelWorkspace', () => ({
  CandidatIndividuelWorkspace: ({ staffRole }: { staffRole: string }) => (
    <div data-testid="candidate-workspace" data-role={staffRole} />
  ),
}));
jest.mock('@/components/dashboard/staff/StaffReleaseFingerprintGuard', () => ({
  StaffReleaseFingerprintGuard: () => null,
}));

const mockFetch = jest.fn();

describe('CandidatIndividuelShell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
    window.sessionStorage.clear();
  });

  it('shows the ADMIN OFF state and activates through the audited config API', async () => {
    let resolvePatch!: (value: Response) => void;
    mockFetch.mockReturnValue(new Promise<Response>((resolve) => { resolvePatch = resolve; }));
    render(<CandidatIndividuelShell staffRole="ADMIN" initialPipelineState="OFF" />);

    expect(screen.getByText('Désactivé')).toBeInTheDocument();
    expect(screen.getByText('Le simulateur candidat individuel est désactivé.')).toBeInTheDocument();
    const activate = screen.getByRole('button', { name: "Activer pour l'équipe" });
    fireEvent.click(activate);
    expect(screen.getByRole('button', { name: 'Activation en cours' })).toBeDisabled();
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        namespace: 'pricing.candidatIndividuelPipeline',
        key: 'state',
        value: 'ACTIVE_INTERNAL',
      }),
    });

    resolvePatch(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    expect(await screen.findByText("Le simulateur est actif pour l'équipe.")).toBeInTheDocument();
    expect(screen.getByTestId('candidate-workspace')).toHaveAttribute('data-role', 'ADMIN');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('lets ADMIN disable ACTIVE_INTERNAL through the same audited endpoint', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<CandidatIndividuelShell staffRole="ADMIN" initialPipelineState="ACTIVE_INTERNAL" />);

    fireEvent.click(screen.getByRole('button', { name: 'Désactiver' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/admin/config', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        namespace: 'pricing.candidatIndividuelPipeline',
        key: 'state',
        value: 'OFF',
      }),
    })));
    expect(await screen.findByText('Le simulateur candidat individuel est désactivé.')).toBeInTheDocument();
  });

  it('shows an accessible error and retry after a failed activation', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'refus' }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<CandidatIndividuelShell staffRole="ADMIN" initialPipelineState="OFF" />);

    fireEvent.click(screen.getByRole('button', { name: "Activer pour l'équipe" }));
    expect(await screen.findByRole('alert')).toHaveTextContent("L'activation a échoué. Réessayez.");
    fireEvent.click(screen.getByRole('button', { name: "Réessayer l'activation" }));

    expect(await screen.findByTestId('candidate-workspace')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it.each(['ADMIN', 'ASSISTANTE'] as const)('purge le handoff quand le pipeline est OFF pour %s', (staffRole) => {
    stageCandidateStudentHandoff(window.sessionStorage, staffRole, 'cm1studentopaqueidentifier01');
    render(<CandidatIndividuelShell staffRole={staffRole} initialPipelineState="OFF" />);

    expect(screen.getByText(staffRole === 'ADMIN'
      ? 'Le simulateur candidat individuel est désactivé.'
      : "Le simulateur n'est pas encore activé par un administrateur.")).toBeInTheDocument();
    if (staffRole === 'ASSISTANTE') expect(screen.queryByRole('button', { name: /Activer|Désactiver/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('candidate-workspace')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
  });

  it('reste fail-closed sans planter si le navigateur refuse sessionStorage en état OFF', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => { throw new DOMException('denied', 'SecurityError'); },
    });
    try {
      expect(() => render(
        <CandidatIndividuelShell staffRole="ADMIN" initialPipelineState="OFF" />,
      )).not.toThrow();
      expect(screen.getByText('Le simulateur candidat individuel est désactivé.')).toBeInTheDocument();
      expect(screen.queryByTestId('candidate-workspace')).not.toBeInTheDocument();
    } finally {
      if (descriptor) Object.defineProperty(window, 'sessionStorage', descriptor);
    }
  });

  it.each(['ADMIN', 'ASSISTANTE'] as const)('mounts the shared workspace for %s when ACTIVE_INTERNAL', (staffRole) => {
    render(<CandidatIndividuelShell staffRole={staffRole} initialPipelineState="ACTIVE_INTERNAL" />);

    expect(screen.getByTestId('candidate-workspace')).toHaveAttribute('data-role', staffRole);
  });

  it.each(['SHADOW', 'ACTIVE_PUBLIC', 'ACTIVE_PUBLIC_PERCENTAGE', 'UNKNOWN'])('fails closed for state %s', (state) => {
    render(<CandidatIndividuelShell staffRole="ADMIN" initialPipelineState={state} />);

    expect(screen.queryByTestId('candidate-workspace')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Désactivé')).toBeInTheDocument();
  });
});
