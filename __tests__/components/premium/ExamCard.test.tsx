import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ExamCard } from '@/components/premium/ExamCard';

/**
 * ExamCard's schedule label must never say "mensualités identiques" when the
 * installments aren't actually identical (a real bug found after the 2026-09
 * sans-acompte pricing refonte: some offers round the last installment
 * differently, and the label said "identiques" while also printing a
 * different "dernière à" value — a self-contradicting sentence).
 *
 * These fixtures are minimal and not real commercial offers on purpose —
 * only the installments array shape matters to this component; the pricing
 * domain (data/pricing.canonical.json) is exercised elsewhere.
 */
describe('ExamCard — schedule label reflects real installment uniformity', () => {
  it('says "mensualités identiques" and omits "dernière à" when all installments are equal', () => {
    render(
      <ExamCard
        eyebrow="Test"
        title="Offre uniforme"
        price={5400}
        payment={{ deposit: 0, installments: [600, 600, 600, 600, 600, 600, 600, 600, 600] }}
        hideCta
      />,
    );

    const secondary = screen.getByTestId('price-secondary');
    expect(secondary).toHaveTextContent('mensualités identiques');
    expect(secondary).toHaveTextContent('pas d’acompte');
    expect(secondary).not.toHaveTextContent('dernière à');
  });

  it('says "mensualités" (not "identiques") and states "dernière à" when the last installment differs', () => {
    render(
      <ExamCard
        eyebrow="Test"
        title="Offre ajustée"
        price={3900}
        payment={{ deposit: 0, installments: [433, 433, 433, 433, 433, 433, 433, 433, 436] }}
        hideCta
      />,
    );

    const secondary = screen.getByTestId('price-secondary');
    expect(secondary).toHaveTextContent('9 mensualités');
    expect(secondary).not.toHaveTextContent('mensualités identiques');
    expect(secondary).toHaveTextContent('pas d’acompte');
    expect(secondary).toHaveTextContent('dernière à');
    expect(secondary).toHaveTextContent('436');
  });
});
