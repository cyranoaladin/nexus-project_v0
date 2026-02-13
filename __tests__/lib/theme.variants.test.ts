import { getVariantDescription, componentVariants } from '@/lib/theme/variants';

describe('theme variants', () => {
  it('returns description for known variant', () => {
    const desc = getVariantDescription('button', 'variant', 'default');
    expect(desc).toContain('Primary button');
  });

  it('returns fallback description for unknown variant', () => {
    const desc = getVariantDescription('badge', 'variant', 'unknown');
    expect(desc).toBe('unknown variant');
  });

  it('exposes component variants', () => {
    expect(componentVariants.card.variant.default.label).toBe('Default');
  });
});
