import { render } from '@testing-library/react';
import { SurvivalHeroBanner } from '@/components/dashboard/eleve/survival/SurvivalHeroBanner';

describe('SurvivalHeroBanner', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('matches snapshot', () => {
    const { container } = render(<SurvivalHeroBanner examDate={new Date('2026-06-08T08:00:00.000Z')} noteToday={4.5} />);
    expect(container).toMatchSnapshot();
  });
});
