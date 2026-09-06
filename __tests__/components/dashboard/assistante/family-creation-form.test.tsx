import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FamilyForm } from '@/components/dashboard/assistante/FamilyForm';
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }) }));
afterEach(() => jest.restoreAllMocks());
it('creates siblings with one phone invitation and no required student email', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ children: [{ studentId: 's1' }, { studentId: 's2' }], invitationQueued: true }) } as Response);
  render(<FamilyForm mode="WHATSAPP" />);
  fireEvent.change(screen.getByLabelText('Prénom du parent'), { target: { value: 'Claire' } });
  fireEvent.change(screen.getByLabelText('Nom du parent'), { target: { value: 'Test' } });
  fireEvent.change(screen.getByLabelText('Téléphone du parent'), { target: { value: '+216 99192829' } });
  fireEvent.change(screen.getByLabelText('Prénom de l’enfant'), { target: { value: 'Nora' } });
  fireEvent.change(screen.getByLabelText('Nom de l’enfant'), { target: { value: 'Distinct' } });
  fireEvent.change(screen.getByLabelText('Situation scolaire'), { target: { value: 'INDIVIDUAL' } });
  fireEvent.change(screen.getByLabelText('Niveau'), { target: { value: 'Première' } });
  expect(screen.queryByLabelText('Objectif déclaré')).not.toBeInTheDocument();
  expect(screen.getByText(/Le projet bac sera renseigné dans le dossier candidat/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Niveau'), { target: { value: 'Terminale' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter un enfant' }));
  fireEvent.change(screen.getAllByLabelText('Prénom de l’enfant')[1], { target: { value: 'Ali' } });
  fireEvent.change(screen.getAllByLabelText('Nom de l’enfant')[1], { target: { value: 'Autre' } });
  fireEvent.click(screen.getByRole('button', { name: 'Créer le foyer et continuer' }));
  expect(await screen.findByText('Foyer enregistré')).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  const [url, request] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('/api/assistante/families');
  expect(request.headers['idempotency-key']).toMatch(/^foyer-/);
  expect(JSON.parse(request.body)).toMatchObject({ parentPhone: '+216 99192829', children: [{ firstName: 'Nora', lastName: 'Distinct', schoolingStatus: 'INDIVIDUAL' }, { firstName: 'Ali', lastName: 'Autre' }] });
  expect(JSON.parse(request.body)).not.toHaveProperty('parentEmail');
  expect(JSON.parse(request.body).children[0]).not.toHaveProperty('candidateProfile');
  expect(screen.getByText(/mise en file ne confirme pas/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Compléter le dossier candidat de Nora' })).toHaveAttribute('href', '/dashboard/assistante/students/s1/candidat');
});

it.each(['Téléphone du parent', 'Prénom du parent', 'Nom du parent'])('does not force a selected parent after changing %s', async label => {
 const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ children: [{ studentId: 's1' }], invitationQueued: false }) } as Response);
 render(<FamilyForm mode="WHATSAPP" existingParent={{ parentUserId: 'p1', parentFirstName: 'Claire', parentLastName: 'Test', parentPhone: '+21699192829' }} />);
 fireEvent.change(screen.getByLabelText(label), { target: { value: label === 'Téléphone du parent' ? '+21622123456' : 'Changed' } });
 fireEvent.change(screen.getByLabelText('Prénom de l’enfant'), { target: { value: 'Nora' } });
 fireEvent.change(screen.getByLabelText('Nom de l’enfant'), { target: { value: 'Test' } });
 fireEvent.click(screen.getByRole('button', { name: 'Ajouter l’enfant au foyer' }));
 await waitFor(() => expect(fetchMock).toHaveBeenCalled());
 expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).not.toHaveProperty('duplicateResolution');
});

it('keeps the selected household when only the phone formatting changes', async () => {
 const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ children: [{ studentId: 's1' }], invitationQueued: false }) } as Response);
 render(<FamilyForm mode="WHATSAPP" existingParent={{ parentUserId: 'p1', parentFirstName: 'Claire', parentLastName: 'Test', parentPhone: '+21699192829' }} />);
 fireEvent.change(screen.getByLabelText('Téléphone du parent'), { target: { value: '99 192 829' } });
 fireEvent.change(screen.getByLabelText('Prénom de l’enfant'), { target: { value: 'Nora' } });
 fireEvent.change(screen.getByLabelText('Nom de l’enfant'), { target: { value: 'Test' } });
 fireEvent.click(screen.getByRole('button', { name: 'Ajouter l’enfant au foyer' }));
 await waitFor(() => expect(fetchMock).toHaveBeenCalled());
 expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).duplicateResolution).toEqual({ mode: 'ATTACH', parentUserId: 'p1' });
});
it('offers explicit manual invitation for a newly created pending parent', async () => {
 jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ parentUserId: 'p1', children: [{ studentId: 's1' }], invitationQueued: false, invitationMode: 'MANUAL', invitationRequired: true }) } as Response);
 render(<FamilyForm mode="WHATSAPP" existingParent={{ parentUserId: 'p1', parentFirstName: 'Claire', parentLastName: 'Test', parentPhone: '+21699192829' }} />);
 fireEvent.change(screen.getByLabelText('Prénom de l’enfant'), { target: { value: 'Nora' } });
 fireEvent.change(screen.getByLabelText('Nom de l’enfant'), { target: { value: 'Test' } });
 fireEvent.click(screen.getByRole('button', { name: 'Ajouter l’enfant au foyer' }));
 expect(await screen.findByRole('button', { name: 'Préparer l’invitation WhatsApp' })).toBeVisible();
 expect(screen.queryByText(/Les accès du parent sont conservés|mise en file/)).not.toBeInTheDocument();
});

it('does not claim automatic delivery when no invitation was queued', async () => {
 jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ parentUserId: 'p1', children: [{ studentId: 's1' }], invitationQueued: false, invitationMode: 'AUTOMATIC', invitationRequired: false }) } as Response);
 render(<FamilyForm mode="WHATSAPP" existingParent={{ parentUserId: 'p1', parentFirstName: 'Claire', parentLastName: 'Test', parentPhone: '+21699192829' }} />);
 fireEvent.change(screen.getByLabelText('Prénom de l’enfant'), { target: { value: 'Nora' } });
 fireEvent.change(screen.getByLabelText('Nom de l’enfant'), { target: { value: 'Test' } });
 fireEvent.click(screen.getByRole('button', { name: 'Ajouter l’enfant au foyer' }));
 expect(await screen.findByText('Foyer enregistré')).toBeInTheDocument();
 expect(screen.getByText('Les accès du parent sont conservés. Il pourra confirmer la nouvelle liste de ses enfants dans son espace.')).toBeVisible();
 expect(screen.queryByText(/Invitation WhatsApp mise en file/)).not.toBeInTheDocument();
 expect(screen.queryByText(/mise en file ne confirme pas/)).not.toBeInTheDocument();
});
