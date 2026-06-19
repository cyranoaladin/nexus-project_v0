import { frenchTypography } from '@/lib/typography/fr';

describe('frenchTypography', () => {
  it('replaces straight apostrophe with typographic', () => {
    expect(frenchTypography("l'épreuve")).toBe('l\u2019épreuve');
    expect(frenchTypography("n'est")).toBe('n\u2019est');
    expect(frenchTypography("d'un")).toBe('d\u2019un');
  });

  it('adds non-breaking space before high punctuation', () => {
    expect(frenchTypography('Bonjour :')).toBe('Bonjour\u00A0:');
    expect(frenchTypography('Oui !')).toBe('Oui\u00A0!');
    expect(frenchTypography('Vraiment ?')).toBe('Vraiment\u00A0?');
    expect(frenchTypography('A ; B')).toBe('A\u00A0; B');
  });

  it('formats guillemets with non-breaking spaces', () => {
    expect(frenchTypography('« test »')).toBe('«\u00A0test\u00A0»');
    expect(frenchTypography('«test»')).toBe('«\u00A0test\u00A0»');
  });

  it('replaces three dots with ellipsis', () => {
    expect(frenchTypography('etc...')).toBe('etc…');
  });

  it('adds non-breaking space in N%', () => {
    expect(frenchTypography('30 %')).toBe('30\u00A0%');
    expect(frenchTypography('30%')).toBe('30\u00A0%');
  });
});
