import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Page from '@/app/auth/mot-de-passe-oublie/page';
jest.mock('@/components/layout/CorporateNavbar', () => ({ CorporateNavbar: () => null }));
jest.mock('@/components/layout/CorporateFooter', () => ({ CorporateFooter: () => null }));
afterEach(() => jest.restoreAllMocks());
it.each(['nonsense', 'bad@', '123', '   '])('rejects invalid identifier %s locally', async value => {
 const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ success: true }) } as Response);
 render(<Page />);
 const input = screen.getByLabelText('Téléphone WhatsApp ou email');
 fireEvent.change(input, { target: { value } });
 fireEvent.submit(input.closest('form')!);
 expect(await screen.findByRole('alert')).toHaveTextContent('valide');
 expect(fetchMock).not.toHaveBeenCalled();
});
it.each([
 [' parent@example.test ', '/api/auth/reset-password', { email: 'parent@example.test' }],
 [' +216 99192829 ', '/api/auth/parent-phone/recovery', { identifier: '+216 99192829' }],
])('trims a syntactically valid identifier without revealing existence', async (value, endpoint, body) => {
 const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ success: true }) } as Response);
 render(<Page />);
 const input = screen.getByLabelText('Téléphone WhatsApp ou email');
 fireEvent.change(input, { target: { value } });
 fireEvent.submit(input.closest('form')!);
 await waitFor(() => expect(fetchMock).toHaveBeenCalled());
 expect(fetchMock.mock.calls[0][0]).toBe(endpoint);
 expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual(body);
 expect(await screen.findByText(/Si votre identifiant correspond/)).toBeVisible();
});
