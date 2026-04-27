import { fireEvent, render, screen } from '@testing-library/react';
import DecisionHelper from '@/components/sections/homepage/DecisionHelper';

describe('DecisionHelper', () => {
  it('renders the need-selection buttons', () => {
    render(<DecisionHelper />);
    expect(screen.getByRole('button', { name: /suivi toute l'année/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stage de vacances/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /préparation eaf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pack objectif/i })).toBeInTheDocument();
  });

  it('recommends stages intensifs when user picks stage', () => {
    render(<DecisionHelper />);
    fireEvent.click(screen.getByRole('button', { name: /stage de vacances/i }));
    expect(screen.getByText(/stages intensifs de vacances/i)).toBeInTheDocument();
  });

  it('recommends EAF platform when user picks eaf', () => {
    render(<DecisionHelper />);
    fireEvent.click(screen.getByRole('button', { name: /préparation eaf/i }));
    expect(screen.getByText(/Plateforme EAF & préparation Bac de français/i)).toBeInTheDocument();
  });

  it('recommends cours hebdomadaires when user picks suivi', () => {
    render(<DecisionHelper />);
    fireEvent.click(screen.getByRole('button', { name: /suivi toute l'année/i }));
    expect(screen.getByText(/Cours hebdomadaires & suivi personnalisé/i)).toBeInTheDocument();
  });
});
