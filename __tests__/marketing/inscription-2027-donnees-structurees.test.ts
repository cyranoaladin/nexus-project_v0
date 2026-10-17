/**
 * Données structurées des deux dossiers « Inscription 2027 ».
 *
 * Ces pages sont servies telles quelles : elles n'héritent d'aucun composant
 * React, donc d'aucun JSON-LD du site. Le générateur en dépose un, entièrement
 * dérivé du document audité — titre, questions des parents, adresse du portail.
 * Rien n'y est saisi : une valeur saisie finit par mentir.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PAGES, construire, donneesStructurees, questionsDesParents } from '@/scripts/inscription-2027/build-pages.mjs';

const racine = process.cwd();
const lire = (chemin: string) => readFileSync(join(racine, chemin), 'utf8');
const source = (slug: string) => lire(`content/inscription-2027/source/${slug}.html`);
const SITE = 'https://nexusreussite.academy';

/** Un nœud de graphe : son type est garanti, le reste est libre par nature. */
type Noeud = { '@type': string } & Record<string, unknown>;
type Maillon = { '@type': 'ListItem'; position: number; name: string; item: string };
type Entree = { '@type': 'Question'; name: string; acceptedAnswer: { '@type': 'Answer'; text: string } };

function grapheServi(slug: string): Noeud[] {
  const servi = lire(`public/inscription-bac-2027/${slug}.html`);
  const blocs = [...servi.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  expect(blocs).toHaveLength(1);
  return JSON.parse(blocs[0][1])['@graph'];
}

describe.each(PAGES.map((p: { slug: string }) => p.slug))('données structurées — %s', (slug) => {
  const graphe = () => grapheServi(slug);
  const typeDu = (type: string): Noeud => {
    const noeud = graphe().find((n) => n['@type'] === type);
    if (!noeud) throw new Error(`NOEUD_ABSENT: ${type}`);
    return noeud;
  };

  test('un seul bloc, analysable, sans échappement cassé', () => {
    const graphe2 = graphe();
    expect(graphe2.map((n) => n['@type']).sort()).toEqual(['Article', 'BreadcrumbList', 'FAQPage']);
    // Aucun « < » brut : un </script> dans une réponse fermerait la balise.
    const brut = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(lire(`public/inscription-bac-2027/${slug}.html`))![1];
    expect(brut).not.toContain('<');
  });

  test('l’article reprend le titre du document, pas un titre saisi', () => {
    const article = typeDu('Article');
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(source(slug))![1].replace(/<[^>]+>/g, '').trim();
    expect(article.headline).toBe(h1);
    expect(article.inLanguage).toBe('fr');
    expect((article.publisher as { '@id': string })['@id']).toBe(`${SITE}/#organisation`);
    expect(article.mainEntityOfPage).toBe(`${SITE}/inscription-bac-2027/${slug}`);
  });

  test('la FAQ est celle du document, et son texte est visible sur la page', () => {
    const faq = typeDu('FAQPage');
    const attendues = questionsDesParents(source(slug));
    expect(attendues.length).toBeGreaterThanOrEqual(5);
    expect(faq.mainEntity).toHaveLength(attendues.length);
    const servi = lire(`public/inscription-bac-2027/${slug}.html`);
    (faq.mainEntity as Entree[]).forEach((entree, i) => {
      expect(entree['@type']).toBe('Question');
      expect(entree.name).toBe(attendues[i].question);
      expect(entree.acceptedAnswer.text).toBe(attendues[i].reponse);
      // Règle de Google : une question déclarée doit être lisible par l'humain.
      expect(servi).toContain(attendues[i].question.replace(/ /g, ' '));
    });
  });

  test('le fil d’Ariane mène de l’accueil au dossier', () => {
    const fil = typeDu('BreadcrumbList');
    expect((fil.itemListElement as Maillon[]).map((e) => e.item)).toEqual([
      `${SITE}/`,
      `${SITE}/inscription-bac-2027`,
      `${SITE}/inscription-bac-2027/${slug}`,
    ]);
    expect((fil.itemListElement as Maillon[]).map((e) => e.position)).toEqual([1, 2, 3]);
  });

  test('la page servie est toujours exactement ce que le générateur produit', () => {
    const page = PAGES.find((p: { slug: string }) => p.slug === slug)!;
    expect(lire(`public/inscription-bac-2027/${slug}.html`)).toBe(construire(page));
  });
});

describe('le générateur refuse plutôt que de deviner', () => {
  test('un document sans le bloc des parents arrête la fabrication', () => {
    const ampute = source('general').replace('id="parents"', 'id="autre-chose"');
    expect(() => questionsDesParents(ampute)).toThrow('QUESTIONS_DES_PARENTS_INTROUVABLES');
  });

  /** Glisse `ajout` dans la première question du bloc des parents. */
  function altererPremiereQuestion(ajout: string): string {
    const document = source('general');
    const debut = document.indexOf('id="parents"');
    const fin = document.indexOf('</summary>', debut);
    return document.slice(0, fin) + ajout + document.slice(fin);
  }

  test('un chevron que le nettoyage ne peut pas retirer arrête la fabrication', () => {
    // « a < b » ne forme pas une balise : aucun nettoyage ne l'enlève, et il
    // n'a rien à faire dans un JSON-LD. On vérifie au lieu de rogner.
    expect(() => questionsDesParents(altererPremiereQuestion(' a < b'))).toThrow('FRAGMENT_NON_TEXTUEL');
  });

  test('une entité HTML inconnue arrête la fabrication plutôt que d’être servie telle quelle', () => {
    expect(() => questionsDesParents(altererPremiereQuestion(' &copy;'))).toThrow('ENTITE_INCONNUE');
  });

  test('le JSON-LD d’un document sain ne porte aucun chevron brut', () => {
    const page = PAGES.find((p: { slug: string }) => p.slug === 'general')!;
    expect(JSON.stringify(donneesStructurees(source('general'), page))).not.toContain('<');
  });
});

describe('l’index /inscription-bac-2027', () => {
  test('déclare la collection des deux dossiers et son fil d’Ariane', () => {
    const page = lire('app/inscription-bac-2027/page.tsx');
    expect(page).toContain('CollectionPage');
    expect(page).toContain('BreadcrumbList');
    // Les deux dossiers viennent du manifeste, jamais d'une liste recopiée :
    // ni leur chemin, ni leur titre, ni leur description ne sont saisis ici.
    expect(page).toContain('hasPart: pages.map');
    expect(page).not.toContain('/inscription-bac-2027/general');
    expect(page).not.toContain('/inscription-bac-2027/stmg');
  });
});
