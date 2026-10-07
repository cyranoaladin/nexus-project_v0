import { formatClock, formatRelative } from '@/lib/espace/format';

describe('formatRelative', () => {
  const now = new Date('2026-10-02T18:00:00Z');
  const ago = (s: number) => new Date(now.getTime() - s * 1000);

  it.each([
    [2, 'à l’instant'],
    [20, 'il y a 20 s'],
    [4 * 60, 'il y a 4 min'],
    [3 * 3600, 'il y a 3 h'],
    [2 * 86400, 'il y a 2 j'],
  ])('%i s → %s', (s, expected) => {
    expect(formatRelative(ago(s), now)).toBe(expected);
  });

  it('une date absente donne un tiret, une date future reste « à l’instant »', () => {
    expect(formatRelative(null, now)).toBe('—');
    expect(formatRelative(new Date(now.getTime() + 60_000), now)).toBe('à l’instant');
  });
});

describe('formatClock', () => {
  it("affiche l'heure dans le fuseau de l'organisation, pas celui de la machine", () => {
    expect(formatClock('2026-10-02T17:42:00Z', 'Africa/Tunis')).toBe('18:42'); // Tunis = UTC+1, sans heure d'été
    expect(formatClock('2026-10-02T17:42:00Z', 'UTC')).toBe('17:42');
  });
});
