import { render } from '@testing-library/react';
import { SurvivalHeroBanner } from '@/components/dashboard/eleve/survival/SurvivalHeroBanner';

describe('SurvivalHeroBanner', () => {
  it('matches snapshot', () => {
    const { container } = render(<SurvivalHeroBanner examDate={new Date('2026-06-08T08:00:00.000Z')} noteToday={4.5} />);
    expect(container).toMatchSnapshot();
  });
});
