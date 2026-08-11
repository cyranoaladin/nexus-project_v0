import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';

import { PreRentreeAssessmentCard } from '@/components/dashboard/eleve/PreRentreeAssessmentCard';

describe('PreRentreeAssessmentCard', () => {
  it('mène directement de l’espace élève à la sélection de matière', () => {
    render(<PreRentreeAssessmentCard />);

    expect(screen.getByRole('link', { name: 'Passer le bilan de pré-rentrée' })).toHaveAttribute(
      'href',
      '/bilan-gratuit/assessment',
    );
    expect(screen.getByText(/choisis d’abord la matière/i)).toBeInTheDocument();
  });
});
