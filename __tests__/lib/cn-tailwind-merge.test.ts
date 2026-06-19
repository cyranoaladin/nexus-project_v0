import { cn } from '@/lib/utils';

describe('cn() with tailwind-merge — token conflict resolution', () => {
  it('bg-lux-white wins over bg-surface-card (Card override)', () => {
    expect(cn('bg-surface-card', 'bg-lux-white')).toBe('bg-lux-white');
  });

  it('bg-lux-ink wins over bg-surface-card', () => {
    expect(cn('bg-surface-card', 'bg-lux-ink')).toBe('bg-lux-ink');
  });

  it('text-lux-ink wins over text-neutral-100 (Card text override)', () => {
    expect(cn('text-neutral-100', 'text-lux-ink')).toBe('text-lux-ink');
  });

  it('text-lux-ivory wins over text-neutral-100', () => {
    expect(cn('text-neutral-100', 'text-lux-ivory')).toBe('text-lux-ivory');
  });

  it('text-lux-slate wins over text-neutral-200 (Badge override)', () => {
    expect(cn('text-neutral-200', 'text-lux-slate')).toBe('text-lux-slate');
  });

  it('preserves non-conflicting classes', () => {
    const result = cn('rounded-xl border bg-surface-card text-neutral-100', 'bg-lux-white text-lux-ink lux-shadow');
    expect(result).toContain('rounded-xl');
    expect(result).toContain('border');
    expect(result).toContain('bg-lux-white');
    expect(result).toContain('text-lux-ink');
    expect(result).toContain('lux-shadow');
    expect(result).not.toContain('bg-surface-card');
    expect(result).not.toContain('text-neutral-100');
  });

  it('last bg wins in same group', () => {
    expect(cn('bg-lux-paper', 'bg-lux-white')).toBe('bg-lux-white');
  });
});
