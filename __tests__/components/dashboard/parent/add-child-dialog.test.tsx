import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
/**
 * Radix Select n'expose pas de `combobox` sous jsdom (il dépend d'API pointeur
 * absentes). On le remplace par un `select` natif : ces tests portent sur le
 * panneau de succès et la répétabilité, pas sur le composant de sélection.
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
   * Le lien d'activation partait dans un `window.alert()` : URL nue,
   * incopiable, sans explication. Le parent doit pouvoir le lire, le copier,
   * et comprendre à quoi il sert.
   */
  it('affiche le lien d’activation avec un libellé explicite après ajout', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ activation: { activationUrl: 'https://exemple.test/activer/abc' } }),
    })) as unknown as typeof fetch;

    render(<AddChildDialog onChildAdded={() => {}} open onOpenChange={() => {}} />);

    fireEvent.change(screen.getByLabelText(/^Prénom/), { target: { value: 'Ahmed' } });
    fireEvent.change(screen.getByLabelText(/^Nom/), { target: { value: 'Test' } });
    await userEvent.selectOptions(screen.getByLabelText('Niveau'), 'Terminale');
    await userEvent.click(screen.getByRole('button', { name: /Ajouter l'Enfant/i }));

    expect(await screen.findByText(/Ahmed peut maintenant passer son bilan/i)).toBeInTheDocument();
    expect(screen.getByText("Remettez ce lien à votre enfant pour qu'il passe son bilan.")).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://exemple.test/activer/abc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copier/i })).toBeInTheDocument();
  });

  /** Ajouter un second enfant ne doit pas obliger à rouvrir la boîte. */
  it('permet d’enchaîner sur un autre enfant sans quitter l’écran', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true, json: async () => ({ activation: { activationUrl: 'https://exemple.test/a' } }),
    })) as unknown as typeof fetch;

    render(<AddChildDialog onChildAdded={() => {}} open onOpenChange={() => {}} />);

    fireEvent.change(screen.getByLabelText(/^Prénom/), { target: { value: 'Ahmed' } });
    fireEvent.change(screen.getByLabelText(/^Nom/), { target: { value: 'Test' } });
    await userEvent.selectOptions(screen.getByLabelText('Niveau'), 'Terminale');
    await userEvent.click(screen.getByRole('button', { name: /Ajouter l'Enfant/i }));

    await userEvent.click(await screen.findByRole('button', { name: /Ajouter un autre enfant/i }));

    // Le formulaire revient, vide, sans avoir fermé la boîte.
    expect(await screen.findByLabelText(/^Prénom/)).toHaveValue('');
  });
});
