import {
  assertHumanRenderIdentity,
  buildHumanRenderIdentity,
  formatPersonName,
} from '@/lib/bilans/render/human-identity';

describe('Capitalisation des noms de personnes', () => {
  it('capitalise un prénom et un nom saisis en minuscules', () => {
    expect(buildHumanRenderIdentity({ firstName: 'kamel', lastName: 'ben rhouma' }).displayName)
      .toBe('Kamel Ben Rhouma');
  });

  it('recompose un nom saisi tout en majuscules', () => {
    expect(formatPersonName('JEAN-PIERRE DUPONT')).toBe('Jean-Pierre Dupont');
  });

  it('capitalise chaque composant d’un prénom composé', () => {
    expect(formatPersonName('anne-sophie de la tour')).toBe('Anne-Sophie De La Tour');
  });

  it('préserve une casse mixte volontaire', () => {
    expect(formatPersonName('Kamel McGregor')).toBe('Kamel McGregor');
  });

  it('gère les apostrophes droites et typographiques', () => {
    expect(formatPersonName("d'angelo")).toBe("D'Angelo");
    expect(formatPersonName('n’guessan')).toBe('N’Guessan');
  });

  it('capitalise aussi via assertHumanRenderIdentity (chemin de rendu)', () => {
    expect(assertHumanRenderIdentity({ displayName: '  kamel   ben rhouma ' }).displayName)
      .toBe('Kamel Ben Rhouma');
  });

  it('préserve les accents lors de la capitalisation', () => {
    expect(formatPersonName('élise ben salah')).toBe('Élise Ben Salah');
  });
});
