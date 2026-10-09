import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CoachDocumentsPanel } from '@/components/dashboard/coach/CoachDocumentsPanel';
const mockFetch = jest.fn();
jest.mock('@/components/auth/SessionRecoveryProvider', () => ({ useProtectedFetch: () => mockFetch, useSessionMutationSuspended: () => false }));
beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => ({ ok: true, status: init?.method === 'POST' ? 201 : 200, json: async () => ({ documents: [], students: [{ id: 'student-a', name: 'Élève A' }, { id: 'student-b', name: 'Élève B' }] }) }));
});

it('requires a file and no longer offers URL-only publication', async () => {
  render(<CoachDocumentsPanel studentId="student-a" />);
  await screen.findByText('Élève B');
  expect(screen.queryByPlaceholderText(/Lien externe ou hébergé/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText(/Corrigé Épreuve/), { target: { value: 'Exercice synthétique' } });
  fireEvent.click(screen.getByRole('button', { name: 'Déposer le document' }));
  expect(await screen.findByText('Veuillez sélectionner un fichier.')).toBeInTheDocument();
  expect(mockFetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
});

it('keeps scanned multipart upload for each selected recipient', async () => {
  render(<CoachDocumentsPanel studentId="student-a" />);
  await screen.findByText('Élève B');
  fireEvent.change(screen.getByPlaceholderText(/Corrigé Épreuve/), { target: { value: 'Exercice synthétique' } });
  fireEvent.click(screen.getByLabelText('Élève B'));
  const file = new File(['synthetic pdf'], 'exercice.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('Fichier'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Déposer le document' }));
  await waitFor(() => expect(mockFetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(2));
  for (const [url, init] of mockFetch.mock.calls.filter(([, options]) => options?.method === 'POST')) {
    expect(['/api/coach/students/student-a/documents', '/api/coach/students/student-b/documents']).toContain(url);
    expect(init.headers).toBeUndefined();
    expect(init.body.get('file')).toBe(file);
    expect(init.body.get('title')).toBe('Exercice synthétique');
    expect(init.body.get('documentType')).toBe('COURS');
    expect(init.body.has('url')).toBe(false);
    expect(init.body.has('localPath')).toBe(false);
  }
  await waitFor(() => expect(screen.getByPlaceholderText(/Corrigé Épreuve/)).toHaveValue(''));
});
