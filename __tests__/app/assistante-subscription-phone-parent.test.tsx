import { render, screen } from '@testing-library/react';
import Page from '@/app/dashboard/assistante/subscriptions/page';
const mockSession = { user: { role: 'ASSISTANTE', firstName: 'Staff' } };
const mockRouter = { push: jest.fn() };
const mockParams = new URLSearchParams('tab=requests');
jest.mock('next-auth/react', () => ({ useSession: () => ({ data: mockSession, status: 'authenticated' }), signOut: jest.fn() }));
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter, useSearchParams: () => mockParams }));
afterEach(() => jest.restoreAllMocks());
it('shows an explicit missing email for a phone-only requester', async () => {
 jest.spyOn(global, 'fetch').mockImplementation(async url => ({ ok: true, json: async () => String(url).includes('subscription-requests') ? { requests: [{ id: 'r1', studentId: 's1', requestType: 'PLAN_CHANGE', planName: 'Parcours', monthlyPrice: 100, status: 'PENDING', requestedBy: 'p1', requestedByEmail: null, createdAt: '2026-09-06', student: { user: { firstName: 'Child', lastName: 'Test' }, parent: { user: { firstName: 'Parent', lastName: 'Test', email: null } } } }] } : { pendingSubscriptions: [], allSubscriptions: [] } }) as Response);
 render(<Page />);
 expect(await screen.findByText('Non renseigné')).toBeVisible();
});
