import { render, screen, waitFor } from '@testing-library/react';
import Page from '@/app/dashboard/eleve/documents/page';
const mockFetch = jest.fn();
let authority = 'V1';
const router = { push: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => router }));
jest.mock('@/components/auth/SessionRecoveryProvider', () => ({
  useProtectedFetch: () => mockFetch, useSessionMutationSuspended: () => false,
  useCanonicalSession: () => ({ status: 'authenticated', data: { user: { id: 'synthetic-student', role: 'ELEVE', authority } } }),
}));
beforeEach(() => { jest.clearAllMocks(); authority = 'V1'; });

test('loads and downloads through the existing owner-scoped student API', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ documents: [{ id: 'synthetic-doc', title: 'Cours synthétique', originalName: 'cours.pdf', sizeBytes: 1200, createdAt: '2026-10-08T00:00:00Z' }] }) });
  render(<Page />);
  expect(await screen.findByRole('link', { name: 'Télécharger Cours synthétique' })).toHaveAttribute('href', '/api/student/documents/synthetic-doc/download');
  expect(mockFetch.mock.calls.map(([url]) => url)).toEqual(['/api/student/documents']);
});

test('a loading failure is visible instead of claiming an empty document collection', async () => {
  mockFetch.mockResolvedValue({ ok: false, status: 503 });
  render(<Page />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger les documents');
  expect(screen.queryByText('Aucune ressource disponible pour le moment.')).not.toBeInTheDocument();
});

test('a Core-only account is directed to its implemented diagnostics without fetching legacy documents', async () => {
  authority = 'CORE_V2';
  render(<Page />);
  expect(await screen.findByRole('link', { name: 'Consulter mes diagnostics' })).toHaveAttribute('href', '/dashboard/eleve/diagnostics-libres');
  await waitFor(() => expect(mockFetch).not.toHaveBeenCalled());
});
