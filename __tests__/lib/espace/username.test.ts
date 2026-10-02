import { normalizeUsername } from '@/lib/espace/username';

describe('normalizeUsername', () => {
  it('met en minuscules et retire les espaces autour', () => {
    expect(normalizeUsername('  Adam.C ')).toBe('adam.c');
  });

  it('accepte les identifiants du cahier des charges', () => {
    for (const u of ['adam.c', 'alexandre.c', 'yassine.bh', 'ines.by', 'alaeddine']) {
      expect(normalizeUsername(u)).toBe(u);
    }
  });

  it('refuse ce qui ressemble à un email, un espace interne ou un caractère exotique', () => {
    for (const u of ['adam@nexus.tn', 'adam c', 'adam/../c', 'adam;c', '<b>x</b>', 'a'.repeat(40), '', '   ', '.adam', 'a']) {
      expect(normalizeUsername(u)).toBeNull();
    }
  });

  it('refuse un non-texte', () => {
    expect(normalizeUsername(undefined)).toBeNull();
    expect(normalizeUsername(42 as unknown)).toBeNull();
    expect(normalizeUsername(null)).toBeNull();
  });

  it('ne confond pas Adam CHOUKALI (adam.c) et Adem KHELIL (adem.k)', () => {
    expect(normalizeUsername('adam.c')).not.toBe(normalizeUsername('adem.k'));
  });

  it("normalise les formes Unicode équivalentes (pas de doublon par accent composé)", () => {
    // « é » composé vs décomposé : refusés tous deux (ASCII uniquement), jamais acceptés différemment
    expect(normalizeUsername('réda')).toBeNull();
    expect(normalizeUsername('réda')).toBeNull();
  });
});
