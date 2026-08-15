import '@testing-library/jest-dom';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const replace = jest.fn();
const refresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

import { PaperEntryGrid } from '@/components/bilans/PaperEntryGrid';
import { PaperEntryStudentSearch } from '@/components/bilans/PaperEntryStudentSearch';
import { PaperEntryWorkflowSteps } from '@/components/bilans/PaperEntryWorkflowSteps';
import { PaperEntryFamilyForm } from '@/app/dashboard/assistante/bilans/saisie-papier/family-form';

const fetchMock = jest.fn();

function fillFamilyWithoutEmail() {
  fireEvent.change(screen.getByLabelText('Prénom du parent'), { target: { value: 'Claire' } });
  fireEvent.change(screen.getByLabelText('Nom du parent'), { target: { value: 'Bernard' } });
  fireEvent.change(screen.getByLabelText('Téléphone du parent'), { target: { value: '+216 99 19 28 29' } });
  fireEvent.change(screen.getByLabelText('Prénom de l’enfant'), { target: { value: 'Inès' } });
}

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

describe('Fil guidé de saisie papier', () => {
  it('affiche les cinq étapes et l’étape courante', () => {
    render(<PaperEntryWorkflowSteps currentStep={3} stepHrefs={{ 1: '/foyers', 2: '/enfants' }} />);

    expect(screen.getByRole('list', { name: 'Progression de la saisie papier' })).toBeInTheDocument();
    for (const label of [
      'Créer ou sélectionner le foyer',
      'Ajouter ou sélectionner l’enfant',
      'Choisir la matière',
      'Saisir les réponses',
      'Valider',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Choisir la matière').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('link', { name: /Créer ou sélectionner le foyer/ })).toHaveAttribute('href', '/foyers');
    expect(screen.getByRole('link', { name: /Ajouter ou sélectionner l’enfant/ })).toHaveAttribute('href', '/enfants');
  });

  it('exige le téléphone mais permet de créer sans e-mail', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      children: [{ studentId: 'student-1' }],
    }), { status: 201, headers: { 'content-type': 'application/json' } }));
    render(<PaperEntryFamilyForm />);

    expect(screen.getByLabelText('Téléphone du parent')).toBeRequired();

    fireEvent.change(screen.getByLabelText('Prénom du parent'), { target: { value: 'Claire' } });
    fireEvent.change(screen.getByLabelText('Nom du parent'), { target: { value: 'Bernard' } });
    fireEvent.change(screen.getByLabelText('Prénom de l’enfant'), { target: { value: 'Inès' } });
    expect(screen.getByRole('button', { name: 'Créer le foyer et continuer' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Téléphone du parent'), { target: { value: '99 19 28 29' } });
    expect(screen.getByRole('button', { name: 'Créer le foyer et continuer' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Créer le foyer et continuer' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request[1].body));
    expect(body).toMatchObject({
      parentPhone: '99 19 28 29',
      parentFirstName: 'Claire',
      parentLastName: 'Bernard',
    });
    expect(body).not.toHaveProperty('parentEmail');
    expect(replace).toHaveBeenCalledWith(
      '/dashboard/assistante/bilans/saisie-papier?studentId=student-1',
    );
  });

  it('active le bouton de création et envoie le numéro international saisi (Qatar)', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      children: [{ studentId: 'student-qatar' }],
    }), { status: 201, headers: { 'content-type': 'application/json' } }));
    render(<PaperEntryFamilyForm />);

    fireEvent.change(screen.getByLabelText('Prénom du parent'), { target: { value: 'Nasser' } });
    fireEvent.change(screen.getByLabelText('Nom du parent'), { target: { value: 'Al-Thani' } });
    fireEvent.change(screen.getByLabelText('Prénom de l’enfant'), { target: { value: 'Fatima' } });
    expect(screen.getByRole('button', { name: 'Créer le foyer et continuer' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Téléphone du parent'), { target: { value: '+97466298752' } });
    expect(screen.getByRole('button', { name: 'Créer le foyer et continuer' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Créer le foyer et continuer' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request[1].body));
    expect(body).toMatchObject({ parentPhone: '+97466298752' });
    expect(replace).toHaveBeenCalledWith(
      '/dashboard/assistante/bilans/saisie-papier?studentId=student-qatar',
    );
  });

  it('affiche une erreur claire et garde le bouton désactivé pour un numéro invalide', () => {
    render(<PaperEntryFamilyForm />);

    fireEvent.change(screen.getByLabelText('Prénom du parent'), { target: { value: 'Claire' } });
    fireEvent.change(screen.getByLabelText('Nom du parent'), { target: { value: 'Bernard' } });
    fireEvent.change(screen.getByLabelText('Prénom de l’enfant'), { target: { value: 'Inès' } });
    fireEvent.change(screen.getByLabelText('Téléphone du parent'), { target: { value: '123' } });

    expect(screen.getByRole('button', { name: 'Créer le foyer et continuer' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Numéro de téléphone invalide.');
  });

  it('sur un même téléphone, laisse rattacher le foyer suggéré d’un clic', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: 'POTENTIAL_DUPLICATE' },
        enteredPhone: '99 19 28 29',
        candidates: [{
          parentUserId: 'parent-existant',
          parentName: 'Claire Bernard',
          phone: '99 19 28 29',
          matchStrength: 'PHONE',
          children: [{ studentId: 'student-existant', studentName: 'Inès Bernard', gradeLevel: 'TERMINALE' }],
        }],
      }), { status: 409, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        children: [{ studentId: 'student-2' }],
      }), { status: 201, headers: { 'content-type': 'application/json' } }));
    render(<PaperEntryFamilyForm />);
    fillFamilyWithoutEmail();

    fireEvent.click(screen.getByRole('button', { name: 'Créer le foyer et continuer' }));

    expect(await screen.findByText(/Même téléphone — s’agit-il du même foyer/)).toBeInTheDocument();
    const firstHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    fireEvent.click(screen.getByRole('button', { name: 'Rattacher à Claire Bernard' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const secondRequest = fetchMock.mock.calls[1] as [string, RequestInit];
    const secondHeaders = secondRequest[1].headers as Record<string, string>;
    expect(secondHeaders['idempotency-key']).not.toBe(firstHeaders['idempotency-key']);
    expect(JSON.parse(String(secondRequest[1].body))).toMatchObject({
      duplicateResolution: { mode: 'ATTACH', parentUserId: 'parent-existant' },
    });
  });

  it('sur une homonymie au téléphone différent, avertit et exige la confirmation avant de rattacher', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: 'POTENTIAL_DUPLICATE' },
        enteredPhone: '99 19 28 29',
        candidates: [{
          parentUserId: 'parent-homonyme',
          parentName: 'Claire Bernard',
          phone: '20 00 00 00',
          matchStrength: 'NAME_ONLY',
          children: [{ studentId: 'student-homonyme', studentName: 'Léa Bernard', gradeLevel: 'SECONDE' }],
        }],
      }), { status: 409, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        children: [{ studentId: 'student-3' }],
      }), { status: 201, headers: { 'content-type': 'application/json' } }));
    render(<PaperEntryFamilyForm />);
    fillFamilyWithoutEmail();

    fireEvent.click(screen.getByRole('button', { name: 'Créer le foyer et continuer' }));

    // Avertissement d'homonymie, divergence de téléphone visible, création par défaut.
    expect(await screen.findByText('Attention — un autre foyer porte ce nom')).toBeInTheDocument();
    expect(screen.getByText(/téléphone saisi \(99 19 28 29\) diffère de celui de ce foyer \(20 00 00 00\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer un nouveau foyer' })).toBeEnabled();

    // Le rattachement est inerte tant que « je confirme » n'est pas coché.
    const attach = screen.getByRole('button', { name: 'Rattacher malgré le téléphone différent' });
    expect(attach).toBeDisabled();
    fireEvent.click(attach);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Après confirmation explicite, le rattachement part avec confirmed: true.
    fireEvent.click(screen.getByRole('checkbox'));
    expect(attach).toBeEnabled();
    fireEvent.click(attach);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body))).toMatchObject({
      duplicateResolution: { mode: 'ATTACH', parentUserId: 'parent-homonyme', confirmed: true },
    });
  });

  it('rend l’état de saisie visible et nomme explicitement la validation', () => {
    render(
      <PaperEntryGrid
        studentId="student-1"
        studentName="Élève Test"
        packSlug="entree-seconde-maths-v1"
        packTitle="Entrée en Seconde · Mathématiques"
        items={[{
          id: 'q1',
          position: 1,
          prompt: 'Question test',
          options: [{ id: 'A', label: 'Réponse A' }],
        }]}
      />,
    );

    expect(screen.getByText(/0 réponses saisies · 1 sur 1 restant/)).toBeInTheDocument();
    expect(screen.getByText('Saisir les réponses').closest('li')).toHaveAttribute('aria-current', 'step');
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]);
    fireEvent.click(radios[4]);
    expect(screen.getByText(/1 réponse saisie · 0 sur 1 restants?/)).toBeInTheDocument();
    expect(screen.getByText('Valider').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('link', { name: /Choisir la matière/ })).toHaveAttribute(
      'href',
      '/dashboard/assistante/bilans/saisie-papier?studentId=student-1',
    );
    expect(screen.getByRole('button', { name: 'Valider la saisie papier' })).toBeEnabled();
  });

  it('actualise la recherche après un court délai tout en gardant un envoi GET', () => {
    jest.useFakeTimers();
    render(<PaperEntryStudentSearch initialQuery="" />);

    const input = screen.getByRole('searchbox', { name: 'Rechercher un foyer ou un enfant' });
    fireEvent.change(input, { target: { value: 'Ben Salah' } });
    expect(replace).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(300); });

    expect(replace).toHaveBeenCalledWith(
      '/dashboard/assistante/bilans/saisie-papier?q=Ben+Salah',
    );
    expect(screen.getByRole('button', { name: 'Rechercher' })).toHaveAttribute('type', 'submit');
    jest.useRealTimers();
  });
});
