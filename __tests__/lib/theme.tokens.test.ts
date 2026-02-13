import { designTokens, getColor } from '@/lib/theme/tokens';

describe('theme tokens', () => {
  it('exposes design tokens', () => {
    expect(designTokens.colors.brand.primary).toBe('#2563EB');
    expect(designTokens.radius.card).toBe('18px');
  });

  it('getColor resolves nested paths', () => {
    expect(getColor('brand.primary')).toBe('#2563EB');
    expect(getColor('neutral.900')).toBe('#111827');
  });

  it('getColor returns fallback when missing', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const color = getColor('missing.token');
    expect(color).toBe('#000000');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
