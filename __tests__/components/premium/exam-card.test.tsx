import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ExamCard } from '@/components/premium/ExamCard';

describe('ExamCard — deposit label', () => {
  it('shows "Acompte {amount} (X %)" when depositPct is provided (stages/ponctuels, unchanged)', () => {
    render(
      <ExamCard
        eyebrow="Intensif"
        title="Stage test"
        price={720}
        payment={{ deposit: 220, installments: [250, 250], depositPct: 30 }}
        ctaHref="#"
      />
    );

    expect(screen.getByText(/Acompte 220\s?TND \(30\s?%\)/)).toBeInTheDocument();
    expect(screen.getAllByText('Acompte').length).toBeGreaterThan(0);
  });

  it('shows "Réservation {amount} TND" with no percentage when depositLabel is set and depositPct is absent', () => {
    render(
      <ExamCard
        eyebrow="Terminale · Présentiel"
        title="Terminale Spécialité simple"
        price={3900}
        payment={{ deposit: 250, installments: Array(9).fill(365).concat([365]), depositLabel: 'Réservation' }}
        ctaHref="#"
      />
    );

    const priceSecondary = screen.getByTestId('price-secondary');
    expect(priceSecondary.textContent).toMatch(/^Réservation 250\s?TND, puis 10 mensualités \(365\s?TND\)\. Total 3\s?900\s?TND\s?\/\s?an\.$/);
    expect(priceSecondary.textContent).not.toContain('%');
    expect(priceSecondary.textContent).not.toContain('Acompte');

    // Échéancier row label follows the same override
    expect(screen.getAllByText('Réservation').length).toBeGreaterThan(0);
    expect(screen.queryByText('Acompte')).not.toBeInTheDocument();
  });

  it('defaults to "Acompte" with no percentage when neither depositPct nor depositLabel is set', () => {
    render(
      <ExamCard
        eyebrow="Boussole"
        title="Pack coaching"
        price={540}
        payment={{ deposit: 160, installments: [190, 190] }}
        ctaHref="#"
      />
    );

    const priceSecondary = screen.getByTestId('price-secondary');
    expect(priceSecondary.textContent).toMatch(/^Acompte 160\s?TND, puis 2 mensualités \(190\s?TND\)/);
    expect(priceSecondary.textContent).not.toContain('%');
  });
});
