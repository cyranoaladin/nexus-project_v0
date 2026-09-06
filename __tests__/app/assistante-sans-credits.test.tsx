import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StudentsPage from '@/app/dashboard/assistante/students/page';
import CreditsPage from '@/app/dashboard/assistante/credits/page';
import CreditRequestsPage from '@/app/dashboard/assistante/credit-requests/page';
import SubscriptionsPage from '@/app/dashboard/assistante/subscriptions/page';
import StudentProfilePage from '@/app/dashboard/assistante/students/[studentId]/page';
import { redirect } from 'next/navigation';
const mockRouter = { push: jest.fn() };
const mockSession = { data: { user: { role: 'ASSISTANTE' } }, status: 'authenticated' };
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter, useSearchParams: () => new URLSearchParams(), useParams: () => ({ studentId: 's1' }), redirect: jest.fn() }));
jest.mock('next-auth/react', () => ({ useSession: () => mockSession, signOut: jest.fn() }));
it.each([CreditsPage, CreditRequestsPage])('redirects old credit screens to payments', async Page => {
  (redirect as unknown as jest.Mock).mockClear();
  (redirect as unknown as jest.Mock).mockImplementationOnce(() => { throw new Error('NEXT_REDIRECT'); });
  expect(() => Page()).toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/dashboard/assistante/paiements');
});
it('loads the student directory without credit data and exposes profile links', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ students: [{ id: 's1', grade: 'Première', school: null, user: { firstName: 'Nora', lastName: 'Test', email: 'nora@example.test' } }], pagination: { total: 1, totalPages: 1 } }) });
  render(<StudentsPage />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/assistante/students?page=1&limit=20&search='));
  expect(await screen.findByText('Nora Test')).toHaveAttribute('href', '/dashboard/assistante/students/s1');
  expect(screen.queryByText(/crédits/i)).not.toBeInTheDocument();
});

jest.mock('@/components/dashboard/assistante/StudentDocumentsManager', () => ({ __esModule: true, default: () => <div>Documents élève</div> }));
it('shows admission requests without allocating or displaying credits', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ pendingSubscriptions: [{ id: 'sub1', planName: 'Accompagnement', monthlyPrice: 300, creditsPerMonth: 8, catalogCreditsPerMonth: 8, status: 'PENDING', createdAt: '2026-09-06', student: { id: 's1', firstName: 'Nora', lastName: 'Test', grade: 'Première' }, parent: { firstName: 'Parent', lastName: 'Test', email: 'parent@example.test' } }], allSubscriptions: [] }) });
  render(<SubscriptionsPage />);
  expect(await screen.findByText('Accompagnement — Nora Test')).toBeInTheDocument();
  expect(screen.queryByText(/crédits\/mois/i)).not.toBeInTheDocument();
});
it('shows a student profile with assignments and documents, without a credit balance', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ student: { id: 's1', gradeLevel: 'PREMIERE', academicTrack: 'GENERAL', user: { firstName: 'Nora', lastName: 'Test', email: 'nora@example.test', activatedAt: '2026-09-06' }, parent: { user: { firstName: 'Parent', lastName: 'Test' } }, subscriptions: [] }, assignments: [], creditBalance: 8, recentTransactions: [] }) });
  render(<StudentProfilePage />);
  expect(await screen.findByText('Documents élève')).toBeInTheDocument();
  expect(screen.queryByText('Crédits')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Facturation' })).toHaveAttribute('href', '/dashboard/assistante/facturation');
});

it('keeps search mounted while refreshing the directory', async () => {
  const response = { ok: true, json: async () => ({ students: [], pagination: { total: 0, totalPages: 0 } }) };
  global.fetch = jest.fn().mockResolvedValueOnce(response).mockImplementation(() => new Promise(() => {}));
  render(<StudentsPage />);
  const input = await screen.findByPlaceholderText('Rechercher un élève...');
  fireEvent.change(input, { target: { value: 'Nora' } });
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  expect(screen.getByPlaceholderText('Rechercher un élève...')).toBe(input);
});
it('proposes family creation with required phone, optional email and several children', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ students: [], pagination: { total: 0, totalPages: 0 } }) });
  render(<StudentsPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Créer.*(?:parent|foyer)/i }));
  expect(screen.getByRole('button', { name: 'Ajouter un enfant' })).toBeInTheDocument();
  expect(screen.getByLabelText('Téléphone du parent')).toBeRequired();
  expect(screen.getByLabelText('E-mail du parent (facultatif)')).not.toBeRequired();
  expect(screen.queryByLabelText('Email élève *')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Situation scolaire')).toBeInTheDocument();
});

it('distinguishes a queued invitation from verified registration on the student profile', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ student: { id: 's1', gradeLevel: 'PREMIERE', academicTrack: 'GENERAL', user: { firstName: 'Nora', lastName: 'Test', email: 'nora@example.test' }, parent: { user: { firstName: 'Parent', lastName: 'Test', parentPhoneState: 'RESERVED', registrationCompletedAt: null, activatedAt: null } }, subscriptions: [] }, assignments: [], parentInvitation: { status: 'PENDING', queuedAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z' } }) });
  render(<StudentProfilePage />);
  expect(await screen.findByText('Invitation en attente d’envoi')).toBeInTheDocument();
  expect(screen.getByText('Inscription à compléter')).toBeInTheDocument();
  expect(screen.queryByText('Invitation reçue')).not.toBeInTheDocument();
});
