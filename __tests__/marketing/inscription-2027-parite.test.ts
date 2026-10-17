/**
 * Dossiers « Inscription 2027 » — parité entre la source auditée et la page servie.
 *
 * Le contenu de ces deux documents a été croisé avec l'arrêté du 10 juin 2025,
 * le calendrier national 2027, la notice de l'Institut français de Tunisie et
 * les notes de service Éduscol. Il est figé. Ce garde interdit qu'il dérive
 * en silence : la page servie est **engendrée** depuis la source, jamais
 * éditée, et ce test échoue si l'une des deux bouge sans l'autre.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PAGES, construire } from '@/scripts/inscription-2027/build-pages.mjs';

const racine = process.cwd();
const lire = (chemin: string) => readFileSync(join(racine, chemin), 'utf8');

/**
 * Texte visible du corps, espaces normalisés. On coupe après le dernier
 * `</style>`, commun aux deux documents : la tête diffère légitimement — le
 * `<title>` servi est rédigé pour le référencement, celui de la source est un
 * nom de travail.
 */
function texte(html: string): string {
  const apres = html.lastIndexOf('</style>');
  return html
    .slice(apres === -1 ? 0 : apres + '</style>'.length)
    // Drapeau i : <SCRIPT> majuscule est une balise comme une autre pour le navigateur.
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

describe.each(PAGES.map((page: { slug: string }) => page.slug))('Inscription 2027 — %s', (slug) => {
  const source = lire(`content/inscription-2027/source/${slug}.html`);
  const servi = lire(`public/inscription-bac-2027/${slug}.html`);

  test('la page servie est exactement ce que le générateur produit', () => {
    // Si ce test tombe, la page a été éditée à la main : régénérer avec
    // `node scripts/inscription-2027/build-pages.mjs`, ne pas rafistoler.
    const page = PAGES.find((p: { slug: string }) => p.slug === slug)!;
    expect(servi).toBe(construire(page));
  });

  test('tout le texte de la source auditée est servi, au mot près', () => {
    const attendu = texte(source);
    const obtenu = texte(servi);
    // La page servie ajoute le logo (alt « Nexus Réussite ») ; elle n'en retire rien.
    for (const phrase of attendu.split(/(?<=\.) /).filter((p) => p.length > 40)) {
      expect(obtenu).toContain(phrase);
    }
  });

  test('rien de la plateforme de rédaction ne subsiste', () => {
    expect(servi).not.toContain('claude:viewport-fit-sides');
    expect(servi).not.toMatch(/claude/i);
  });

  test('le document servi est complet : doctype, charset, viewport, socle', () => {
    expect(servi.startsWith('<!doctype html>\n<html lang="fr">')).toBe(true);
    expect(servi).toContain('<meta charset="utf-8">');
    expect(servi).toContain('viewport-fit=cover');
    // Sans cette règle, des blocs que le script masque par `el.hidden` s'afficheraient.
    expect(servi).toContain('[hidden]{display:none!important}');
    expect(servi).toContain('body{margin:0');
    expect(servi).toContain('img{max-width:100%}');
    expect(servi).toContain('env(safe-area-inset-top,0px)');
  });

  test('les trois fonctionnalités de la page sont intactes', () => {
    expect(servi).toContain(`nexus-bac-${slug === 'general' ? 'general' : 'stmg'}-2027-pieces`);
    expect(servi).toContain('Date.parse("2026-11-12T18:00:00+01:00")');
    expect(servi).toContain('navigator.clipboard.writeText');
  });

  test('les ancres du sommaire sont celles de la source, aucune renommée', () => {
    const ancres = (html: string) => [...html.matchAll(/href="#([a-z0-9-]+)"/g)].map((m) => m[1]).sort();
    expect(ancres(servi)).toEqual(ancres(source));
    expect(ancres(source)).toContain('essentiel');
    // Chaque ancre pointe sur un id qui existe.
    for (const ancre of new Set(ancres(servi))) expect(servi).toContain(`id="${ancre}"`);
  });

  /**
   * Les contrastes ne sont pas recalculés ici : `TESTS/test_contraste.py` les
   * vérifie déjà sur la source, au ratio WCAG 2.1, et il est vert. Ce qu'il
   * faut prouver côté site, c'est que le CSS servi porte EXACTEMENT les mêmes
   * jetons. Une réimplémentation de l'arithmétique des contrastes pourrait se
   * tromper ; une comparaison de caractères, non.
   */
  test('les trois blocs de thème sont servis au caractère près', () => {
    const bloc = (html: string, debut: string) => {
      const i = html.indexOf(debut);
      expect(i).toBeGreaterThan(-1);
      const j = html.indexOf('{', i);
      let profondeur = 0;
      for (let k = j; k < html.length; k += 1) {
        if (html[k] === '{') profondeur += 1;
        else if (html[k] === '}' && (profondeur -= 1) === 0) return html.slice(i, k + 1);
      }
      throw new Error(`bloc ${debut} non refermé`);
    };
    for (const debut of [':root{', '@media (prefers-color-scheme:dark)', ':root[data-theme="dark"]']) {
      expect(bloc(servi, debut)).toBe(bloc(source, debut));
    }
    // Le premier bloc `:root{` servi est celui des couleurs, pas mon socle :
    // l'outillage d'audit l'extrait par position dans le document.
    expect(bloc(servi, ':root{')).toContain('--rouge-texte');
    expect(bloc(servi, ':root{')).toContain('--sur-sombre-4');
  });

  test('le logo de la charte est servi, en clair et en blanc', () => {
    expect(servi).toContain('/inscription-bac-2027/nexus-logo-horizontal.svg');
    expect(servi).toContain('/inscription-bac-2027/nexus-logo-horizontal-blanc.svg');
    expect(servi).toContain('alt="Nexus Réussite"');
  });

  test('référencement : titre, description, canonique et image Open Graph', () => {
    expect(servi).toMatch(/<title>Inscription au bac (général|STMG) 2027/);
    expect(servi).toContain(`<link rel="canonical" href="https://nexusreussite.academy/inscription-bac-2027/${slug}">`);
    expect(servi).toContain('og-inscription-2027.png');
    expect(servi).toContain('<meta property="og:image:width" content="1200">');
  });
});
