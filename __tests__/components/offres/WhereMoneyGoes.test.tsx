import React from 'react';
import { render, screen } from '@testing-library/react';
import { WhereMoneyGoes } from '@/components/offres/WhereMoneyGoes';

describe('WhereMoneyGoes', () => {
  it('renders the "Où va votre argent ?" heading', () => {
    render(<WhereMoneyGoes />);
    expect(screen.getByText(/Où va votre argent/i)).toBeInTheDocument();
  });

  it('states what the monthly payment funds', () => {
    render(<WhereMoneyGoes />);
    expect(screen.getByText(/enseignant expert du programme français/i)).toBeInTheDocument();
    expect(screen.getByText(/suivi hors séance/i)).toBeInTheDocument();
    expect(screen.getByText(/tableaux de bord parent & élève/i)).toBeInTheDocument();
    expect(screen.getByText(/Cyclades \/ IFT/i)).toBeInTheDocument();
    expect(screen.getByText(/bilans réguliers/i)).toBeInTheDocument();
    expect(screen.getByText(/épreuves blanches sur grille officielle/i)).toBeInTheDocument();
  });

  it('contrasts with a classic private tutor stopping at the classroom door', () => {
    render(<WhereMoneyGoes />);
    expect(screen.getByText(/cours particulier classique.*porte de la salle/i)).toBeInTheDocument();
  });

  it('renders no TND amount (pure copy, no pricing figure)', () => {
    const { container } = render(<WhereMoneyGoes />);
    expect(container.textContent).not.toMatch(/TND/);
  });
});
