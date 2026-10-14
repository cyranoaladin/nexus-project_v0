import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Maillage interne de la page /bac-candidat-libre (session 2027) :
 * elle doit être atteignable depuis le menu, le pied de page, l'accueil,
 * le catalogue, la page guide « candidat libre » et le plan du site.
 */
const ROOT = join(__dirname, '../..');
const lire = (fichier: string) => readFileSync(join(ROOT, fichier), 'utf-8');

describe('maillage /bac-candidat-libre', () => {
  test.each([
    ['menu principal', 'components/layout/CorporateNavbar.tsx'],
    ['pied de page', 'components/layout/CorporateFooter.tsx'],
    ['accueil', 'app/HomePageClient.tsx'],
    ['plan du site', 'app/sitemap.ts'],
    ['catalogue (cartes)', 'components/marketing/CandidatsLibresParcours.tsx'],
  ])('%s → /bac-candidat-libre', (_lieu, fichier) => {
    expect(lire(fichier)).toContain("/bac-candidat-libre");
  });

  test('l’accueil n’envoie plus les candidats libres vers l’ancienne section du catalogue', () => {
    expect(lire('app/HomePageClient.tsx')).not.toContain('/offres#section-libre');
  });

  test('/devis-bac (ancien constructeur de devis) redirige vers la page session 2027', () => {
    const config = lire('next.config.mjs');
    expect(config).toMatch(/source:\s*'\/devis-bac',\s*destination:\s*'\/bac-candidat-libre'/);
  });
});
