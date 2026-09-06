import { render, screen } from '@testing-library/react';
import Page from '@/app/dashboard/assistante/students/[studentId]/page';
const mockSession = { user: { role: 'ASSISTANTE' } };
const mockRouter = { push: jest.fn() };
jest.mock('next-auth/react', () => ({ useSession: () => ({ data: mockSession, status: 'authenticated' }) }));
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter, useParams: () => ({ studentId: 's1' }) }));
jest.mock('@/components/dashboard/assistante/StudentDocumentsManager', () => ({ __esModule: true, default: () => null }));
afterEach(() => jest.restoreAllMocks());
it.each([null, '2026-09-06'])('offers the appropriate manual access action for parent activatedAt=%s', async activatedAt => {
 jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ success: true, invitationMode: 'MANUAL', student: { id: 's1', userId: 'u1', gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', user: { firstName: 'Student' }, parent: { user: { id: 'p1', firstName: 'Parent', activatedAt, registrationCompletedAt: null } }, subscriptions: [] }, assignments: [] }) } as Response);
 render(<Page />);
 expect(await screen.findByRole('button', { name: activatedAt ? 'Préparer un lien de récupération WhatsApp' : 'Préparer l’invitation WhatsApp' })).toBeVisible();
 expect(screen.getByText('Inscription à compléter')).toBeVisible();
});
