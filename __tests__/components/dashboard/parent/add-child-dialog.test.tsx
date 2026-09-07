import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
/**
 * Radix Select n'expose pas de `combobox` sous jsdom (il dépend d'API pointeur
 * absentes). On le remplace par un `select` natif : ces tests portent sur le
 * panneau de confirmation et la répétabilité, pas sur le composant de sélection.
 */
jest.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select aria-label="Niveau" value={value ?? ''} onChange={(e) => onValueChange?.(e.target.value)}>
      <option value="">--</option>
      {['Seconde', 'Première', 'Terminale'].map((g) => <option key={g} value={g}>{g}</option>)}
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));

import AddChildDialog from '@/app/dashboard/parent/add-child-dialog';

describe('AddChildDialog', () => {
  test('opens when a controlled open prop is set to true (banner CTA use case)', () => {
    render(<AddChildDialog onChildAdded={jest.fn()} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/prénom/i)).toBeInTheDocument();
  });

  test('stays closed by default when no controlled open prop is given', () => {
    render(<AddChildDialog onChildAdded={jest.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /**
   * Amendement 7 : cette action ne crée plus de compte immédiatement -- elle
   * dépose une FamilyRequest que le staff qualifie et convertit. Il n'y a
   * donc plus de lien d'activation à afficher ici, seulement une
   * confirmation que la demande a bien été transmise.
   */
  it('affiche une confirmation de demande envoyée, sans lien d’activation', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, message: "Votre demande d'ajout d'enfant a bien été reçue." }),
    })) as unknown as typeof fetch;

    render(<AddChildDialog onChildAdded={() => {}} open onOpenChange={() => {}} />);

    fireEvent.change(screen.getByLabelText(/^Prénom/), { target: { value: 'Ahmed' } });
    fireEvent.change(screen.getByLabelText(/^Nom/), { target: { value: 'Test' } });
    await userEvent.selectOptions(screen.getByLabelText('Niveau'), 'Terminale');
    await userEvent.click(screen.getByRole('button', { name: /Demander l.?ajout/i }));

    expect(await screen.findByText(/demande pour Ahmed a bien été envoyée/i)).toBeInTheDocument();
    // Plus de compte créé à ce stade, donc plus de lien d'activation à
    // copier ici -- juste une confirmation que la demande est partie.
    expect(screen.queryByRole('button', { name: /copier/i })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/^https?:\/\//)).not.toBeInTheDocument();
  });

  /** Demander l'ajout d'un second enfant ne doit pas obliger à rouvrir la boîte. */
  it('permet d’enchaîner sur un autre enfant sans quitter l’écran', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true, json: async () => ({ success: true }),
    })) as unknown as typeof fetch;

    render(<AddChildDialog onChildAdded={() => {}} open onOpenChange={() => {}} />);

    fireEvent.change(screen.getByLabelText(/^Prénom/), { target: { value: 'Ahmed' } });
    fireEvent.change(screen.getByLabelText(/^Nom/), { target: { value: 'Test' } });
    await userEvent.selectOptions(screen.getByLabelText('Niveau'), 'Terminale');
    await userEvent.click(screen.getByRole('button', { name: /Demander l.?ajout/i }));

    await userEvent.click(await screen.findByRole('button', { name: /Demander l.?ajout d.?un autre enfant/i }));

    // Le formulaire revient, vide, sans avoir fermé la boîte.
    expect(await screen.findByLabelText(/^Prénom/)).toHaveValue('');
  });

  it('affiche une erreur et ne montre aucune confirmation lorsque la requête échoue', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({ error: 'Invalid child payload' }),
    })) as unknown as typeof fetch;

    render(<AddChildDialog onChildAdded={() => {}} open onOpenChange={() => {}} />);

    fireEvent.change(screen.getByLabelText(/^Prénom/), { target: { value: 'Ahmed' } });
    fireEvent.change(screen.getByLabelText(/^Nom/), { target: { value: 'Test' } });
    await userEvent.selectOptions(screen.getByLabelText('Niveau'), 'Terminale');
    await userEvent.click(screen.getByRole('button', { name: /Demander l.?ajout/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid child payload');
    expect(screen.queryByText(/a bien été envoyée/i)).not.toBeInTheDocument();
  });
});
