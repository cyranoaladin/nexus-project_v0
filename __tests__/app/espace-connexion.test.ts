import { safeDestination } from '@/app/espace/connexion/ConnexionForm';

describe('safeDestination (anti open-redirect)', () => {
  it('accepte une page de l’espace', () => {
    expect(safeDestination('/espace/eleve/travaux')).toBe('/espace/eleve/travaux');
    expect(safeDestination('/espace/nsi/poo')).toBe('/espace/nsi/poo');
  });

  it.each([
    undefined,
    '',
    'https://evil.example/espace',
    '//evil.example/espace',
    '/\\evil.example',
    '/dashboard/admin',
    'javascript:alert(1)',
    '/espace\\..\\evil',
    'espace/eleve',
  ])('%p → /espace', (value) => {
    expect(safeDestination(value as string | undefined)).toBe('/espace');
  });
});
