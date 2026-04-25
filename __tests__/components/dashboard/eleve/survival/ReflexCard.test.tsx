import { render } from '@testing-library/react';
import { ReflexCard } from '@/components/dashboard/eleve/survival/ReflexCard';
import { REFLEXES } from '@/lib/survival/reflex-data';

describe('ReflexCard', () => {
  it.each(['ACQUIS', 'REVOIR', 'PAS_VU'] as const)('matches snapshot for state %s', (state) => {
    const { container } = render(<ReflexCard reflex={REFLEXES[0]} state={state} />);
    expect(container).toMatchSnapshot();
  });
});
