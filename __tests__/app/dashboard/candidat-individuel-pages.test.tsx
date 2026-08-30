import { render, screen } from '@testing-library/react';

import AdminCandidatIndividuelPage from '@/app/dashboard/admin/candidat-individuel/page';
import AssistanteCandidatIndividuelPage from '@/app/dashboard/assistante/candidat-individuel/page';
import { auth } from '@/auth';
import { ensureFresh } from '@/lib/config';
import { getPipelineState } from '@/lib/quotes/pipeline-flag';
import { redirect } from 'next/navigation';

jest.mock('@/components/dashboard/assistante/CandidatIndividuelShell', () => ({
  CandidatIndividuelShell: ({ staffRole, initialPipelineState }: { staffRole: string; initialPipelineState: string }) => (
    <div data-testid="candidate-shell" data-role={staffRole} data-state={initialPipelineState} />
  ),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

jest.mock('@/lib/config', () => ({ ensureFresh: jest.fn() }));
jest.mock('@/lib/quotes/pipeline-flag', () => ({ getPipelineState: jest.fn() }));

const mockAuth = auth as unknown as jest.Mock;
const mockEnsureFresh = ensureFresh as jest.Mock;
const mockGetPipelineState = getPipelineState as jest.Mock;
const mockRedirect = redirect as unknown as jest.Mock;

describe('candidat individuel staff pages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureFresh.mockResolvedValue(undefined);
    mockGetPipelineState.mockReturnValue('OFF');
  });

  it('renders the ADMIN surface with a fresh pipeline state', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });

    render(await AdminCandidatIndividuelPage());

    expect(mockEnsureFresh).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('candidate-shell')).toHaveAttribute('data-role', 'ADMIN');
    expect(screen.getByTestId('candidate-shell')).toHaveAttribute('data-state', 'OFF');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('renders the ASSISTANTE surface with a fresh pipeline state', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'assistante-1', role: 'ASSISTANTE' } });
    mockGetPipelineState.mockReturnValue('ACTIVE_INTERNAL');

    render(await AssistanteCandidatIndividuelPage());

    expect(mockEnsureFresh).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('candidate-shell')).toHaveAttribute('data-role', 'ASSISTANTE');
    expect(screen.getByTestId('candidate-shell')).toHaveAttribute('data-state', 'ACTIVE_INTERNAL');
  });

  it.each([
    ['ADMIN', AdminCandidatIndividuelPage, '/dashboard/admin/candidat-individuel'],
    ['ASSISTANTE', AssistanteCandidatIndividuelPage, '/dashboard/assistante/candidat-individuel'],
  ] as const)('redirects anonymous access to signin for %s', async (_role, page, callbackUrl) => {
    mockAuth.mockResolvedValue(null);

    await expect(page()).rejects.toThrow(`NEXT_REDIRECT:/auth/signin?callbackUrl=${callbackUrl}`);
  });

  it.each([
    ['ASSISTANTE', AdminCandidatIndividuelPage, '/dashboard/assistante'],
    ['ADMIN', AssistanteCandidatIndividuelPage, '/dashboard/admin'],
    ['PARENT', AdminCandidatIndividuelPage, '/dashboard'],
    ['ELEVE', AdminCandidatIndividuelPage, '/dashboard'],
    ['COACH', AssistanteCandidatIndividuelPage, '/dashboard'],
  ] as const)('refuses %s on the wrong surface', async (role, page, target) => {
    mockAuth.mockResolvedValue({ user: { id: `${role.toLowerCase()}-1`, role } });

    await expect(page()).rejects.toThrow(`NEXT_REDIRECT:${target}`);
  });
});
