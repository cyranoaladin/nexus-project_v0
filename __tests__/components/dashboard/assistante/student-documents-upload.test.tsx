import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Manager from '@/components/dashboard/assistante/StudentDocumentsManager';
const mockFetch = jest.fn();
const mockSuccess = jest.fn();
const mockError = jest.fn();
jest.mock('@/components/auth/SessionRecoveryProvider', () => ({ useProtectedFetch: () => mockFetch, useSessionMutationSuspended: () => false }));
jest.mock('sonner', () => ({ toast: { success: (...args: unknown[]) => mockSuccess(...args), error: (...args: unknown[]) => mockError(...args) } }));
beforeEach(() => jest.clearAllMocks());

it('uploads the selected file for the actual user and refreshes only after creation', async () => {
  const refresh = jest.fn();
  mockFetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ success: true }) });
  render(<Manager userId="user-target-not-student-id" studentName="Élève synthétique" onDocumentCreated={refresh} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
  expect(screen.queryByText('URL')).not.toBeInTheDocument();
  expect(screen.queryByText('Chemin local')).not.toBeInTheDocument();
  const file = new File(['safe synthetic document'], 'exercice.txt', { type: 'text/plain' });
  fireEvent.change(screen.getByLabelText('Fichier'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [url, init] = mockFetch.mock.calls[0];
  expect(url).toBe('/api/admin/documents');
  expect(init.method).toBe('POST');
  expect(init.headers).toBeUndefined();
  expect(init.body).toBeInstanceOf(FormData);
  expect(init.body.get('userId')).toBe('user-target-not-student-id');
  expect(init.body.get('file')).toBe(file);
  expect([...init.body.keys()].sort()).toEqual(['file', 'userId']);
  expect(mockSuccess).toHaveBeenCalledTimes(1);
});

it('keeps the form and reports a safe error when antivirus is unavailable', async () => {
  const refresh = jest.fn();
  mockFetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'DOCUMENT_SCAN_UNAVAILABLE' }) });
  render(<Manager userId="user-target" studentName="Élève synthétique" onDocumentCreated={refresh} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
  fireEvent.change(screen.getByLabelText('Fichier'), { target: { files: [new File(['safe'], 'exercice.pdf', { type: 'application/pdf' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
  await waitFor(() => expect(mockError).toHaveBeenCalledTimes(1));
  expect(refresh).not.toHaveBeenCalled();
  expect(mockSuccess).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Fichier')).toBeInTheDocument();
});
