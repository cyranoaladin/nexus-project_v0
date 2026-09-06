import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FamilyForm } from '@/components/dashboard/assistante/FamilyForm';
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }) }));

it('requires an explicit staff decision to release a stale reservation without attaching children', async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({
      error: { code: 'POTENTIAL_DUPLICATE' }, candidates: [{
        parentUserId: 'old-parent', parentName: 'Ancien Foyer', phone: '20 11 22 33',
        matchStrength: 'PHONE', children: [], phoneReservation: { version: 3, canRelease: true },
      }],
    }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ released: true }) });
  render(<FamilyForm mode="WHATSAPP" />);
  for (const [label, value] of [['Prénom du parent', 'Nouveau'], ['Nom du parent', 'Foyer'],
    ['Téléphone du parent', '20112233'], ['Prénom de l’enfant', 'Enfant'], ['Nom de l’enfant', 'Foyer']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Créer le foyer et continuer' }));
  const release = await screen.findByRole('button', { name: 'Libérer ce numéro réservé' });
  expect(release).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /Je confirme que cette réservation expirée/ }));
  fireEvent.click(release);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  const [url, options] = (global.fetch as jest.Mock).mock.calls[1];
  expect(url).toBe('/api/assistante/parents/old-parent/phone-reservation/release');
  expect(JSON.parse(options.body)).toEqual({ expectedPhoneVersion: 3 });
  expect(await screen.findByText(/Réservation libérée/)).toBeInTheDocument();
  expect(screen.queryByText('Foyer enregistré')).not.toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
