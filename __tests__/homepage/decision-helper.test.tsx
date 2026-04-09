import { fireEvent, render, screen } from '@testing-library/react';
import DecisionHelper from '@/components/sections/homepage/DecisionHelper';

describe('DecisionHelper', () => {
  it('recommends the Pack Doublé Anticipé for Première + Les deux', () => {
    render(<DecisionHelper />);

    fireEvent.click(screen.getByRole('button', { name: 'Première' }));
    fireEvent.click(screen.getByRole('button', { name: 'Les deux' }));

    expect(screen.getByText(/pack doublé anticipé/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /voir toutes les formules/i })).toHaveAttribute('href', '/stages#tarifs');
    expect(screen.getByRole('link', { name: /découvrir les stages printemps/i })).toHaveAttribute('href', '/stages');
  });

  it('supports the back button and terminale nsi path', () => {
    render(<DecisionHelper />);

    fireEvent.click(screen.getByRole('button', { name: 'Terminale' }));
    fireEvent.click(screen.getByRole('button', { name: /retour/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminale' }));
    fireEvent.click(screen.getByRole('button', { name: 'NSI' }));

    expect(screen.getByText(/pack full stack nsi/i)).toBeInTheDocument();
    expect(screen.getByText(/grand oral inclus/i)).toBeInTheDocument();
  });

  it('recommends the plateforme eaf for Première bac de français', () => {
    render(<DecisionHelper />);

    fireEvent.click(screen.getByRole('button', { name: 'Première' }));
    fireEvent.click(screen.getByRole('button', { name: /bac de français/i }));

    expect(screen.getByText(/plateforme eaf/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /commencer gratuitement/i })).toHaveAttribute(
      'href',
      'https://eaf.nexusreussite.academy'
    );
  });
});
