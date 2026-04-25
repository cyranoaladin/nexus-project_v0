import { render } from '@testing-library/react';
import { PhraseMagiqueCard } from '@/components/dashboard/eleve/survival/PhraseMagiqueCard';
import { PHRASES_MAGIQUES } from '@/lib/survival/phrases';

describe('PhraseMagiqueCard', () => {
  it.each([0, 3, 10])('matches snapshot with copy count %i', (copiedCount) => {
    const { container } = render(<PhraseMagiqueCard phrase={PHRASES_MAGIQUES[0]} copiedCount={copiedCount} />);
    expect(container).toMatchSnapshot();
  });
});
