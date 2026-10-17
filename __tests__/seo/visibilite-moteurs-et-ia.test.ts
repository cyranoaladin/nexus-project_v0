/**
 * Visibilité dans les moteurs de recherche et les assistants génératifs
 * (ChatGPT, Gemini, Claude, Perplexity…) : données structurées de l'organisation,
 * règles robots explicites, fichiers /llms.txt et /llms-full.txt générés depuis
 * les sources canoniques (prix, adresses), donc toujours cohérents avec le site.
 */
import robots from '@/app/robots';
import { GET as llmsTxt } from '@/app/llms.txt/route';
import { GET as llmsFullTxt } from '@/app/llms-full.txt/route';
import { buildOrganisationJsonLd } from '@/lib/organisation-jsonld';
import { LEGAL, horairesLisibles } from '@/lib/legal';
import { getPagesInscription2027 } from '@/lib/inscription-2027';

const ROBOTS_IA = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'Google-Extended',
  'PerplexityBot',
  'Perplexity-User',
  'Applebot-Extended',
];

const sansEspaces = (texte: string) => texte.replace(/\s/g, ' ');

describe('robots.txt', () => {
  const config = robots();
  const regles = Array.isArray(config.rules) ? config.rules : [config.rules];

  test.each(ROBOTS_IA)('%s est explicitement autorisé sur les pages publiques', (robot) => {
    const regle = regles.find((r) => [r.userAgent].flat().includes(robot));
    expect(regle).toBeDefined();
    expect(regle!.allow).toEqual(expect.arrayContaining(['/', '/llms.txt', '/llms-full.txt']));
  });

  test('les espaces privés restent fermés à tous les robots', () => {
    for (const regle of regles) {
      expect(regle.disallow).toEqual(expect.arrayContaining(['/dashboard/', '/api/', '/auth/', '/espace/']));
    }
  });
});

describe('Données structurées de l’organisation', () => {
  const graphe = buildOrganisationJsonLd()['@graph'] as Record<string, any>[];
  const organisation = graphe.find((n) => n['@id']?.endsWith('#organisation'))!;
  const centre = graphe.find((n) => n['@id']?.endsWith('#centre-pedagogique'))!;

  test('organisation : coordonnées, logo, siège social', () => {
    expect(organisation.telephone).toBe(LEGAL.contact.phone);
    expect(organisation.email).toBe(LEGAL.contact.email);
    expect(organisation.logo).toMatch(/^https:\/\/.+\.png$/);
    expect(organisation.address.streetAddress).toContain('Centre Urbain Nord');
    expect(organisation.legalName).toBe(LEGAL.entity.name);
  });

  test('centre pédagogique distinct, au 17 rue Ali Zlitni, Manar III', () => {
    expect(centre['@type']).toEqual(expect.arrayContaining(['EducationalOrganization', 'LocalBusiness']));
    expect(centre.address.streetAddress).toBe('17 rue Ali Zlitni');
    expect(centre.address.addressLocality).toContain('Manar III');
    expect(centre.parentOrganization['@id']).toBe(organisation['@id']);
  });

  test('fourchette de prix : sans les offres candidat libre retirées, avec la grille 2026-2027', () => {
    const offre = organisation.offers;
    expect(offre.priceCurrency).toBe('TND');
    expect(Number(offre.highPrice)).toBe(11600);
  });

  test('profils officiels déclarés : l’entité est reconnaissable hors du site', () => {
    expect(organisation.sameAs).toEqual(LEGAL.web.profils);
    for (const profil of organisation.sameAs) expect(profil).toMatch(/^https:\/\//);
  });

  test('le centre est localisé : coordonnées de la fiche Maps et lien vers elle', () => {
    expect(centre.geo).toEqual({
      '@type': 'GeoCoordinates',
      latitude: LEGAL.addresses.pedagogique.geo.latitude,
      longitude: LEGAL.addresses.pedagogique.geo.longitude,
    });
    // Les coordonnées viennent de la fiche Maps de Nexus Réussite, pas d'une
    // estimation : une épingle fausse coûte plus cher qu'une épingle absente.
    expect(centre.geo.latitude).toBeGreaterThan(36.8);
    expect(centre.geo.latitude).toBeLessThan(36.9);
    expect(centre.geo.longitude).toBeGreaterThan(10.1);
    expect(centre.geo.longitude).toBeLessThan(10.2);
    expect(centre.hasMap).toBe(LEGAL.addresses.pedagogique.maps);
    expect(centre.hasMap).toMatch(/^https:\/\/maps\.google\.com\/\?cid=\d+$/);
    expect(centre.sameAs).toContain(LEGAL.addresses.pedagogique.maps);
  });

  test('le centre porte son code postal : une adresse incomplète se fait distancer en local', () => {
    expect(centre.address.postalCode).toBe(LEGAL.addresses.pedagogique.postalCode);
    expect(centre.address.postalCode).toMatch(/^\d{4}$/);
  });

  test('les horaires d’ouverture sont déclarés : sept jours, deux créneaux', () => {
    const creneaux = centre.openingHoursSpecification as Record<string, any>[];
    expect(Array.isArray(creneaux)).toBe(true);
    expect(creneaux).toHaveLength(2);
    const jours = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const creneau of creneaux) {
      expect(creneau['@type']).toBe('OpeningHoursSpecification');
      expect(creneau.dayOfWeek).toEqual(jours);
      // Une heure mal formée est ignorée en silence par les moteurs : on la refuse ici.
      expect(creneau.opens).toMatch(/^\d{2}:\d{2}$/);
      expect(creneau.closes).toMatch(/^\d{2}:\d{2}$/);
      expect(creneau.opens < creneau.closes).toBe(true);
    }
    expect(creneaux.map((c) => [c.opens, c.closes])).toEqual([
      ['09:00', '13:00'],
      ['14:00', '19:00'],
    ]);
  });

  test('le libellé lisible dérive des mêmes données, il n’est pas recopié', () => {
    const libelle = horairesLisibles();
    for (const creneau of LEGAL.addresses.pedagogique.horaires.creneaux) {
      for (const heure of [creneau.opens, creneau.closes]) {
        expect(libelle).toContain(heure.replace(/^0/, '').replace(':00', '\u00a0h'));
      }
    }
    expect(libelle).toContain('Tous les jours');
  });

  test('la fourchette de prix est lisible, pas une devise seule', () => {
    expect(centre.priceRange).toMatch(/^\d[\d\s\u00a0]*\u2013[\d\s\u00a0]*\d\u00a0TND$/);
  });

  test('site web déclaré', () => {
    expect(graphe.find((n) => n['@type'] === 'WebSite')?.url).toBe(LEGAL.web.url);
  });
});

describe('/llms.txt et /llms-full.txt', () => {
  test('/llms.txt : identité, adresse, offres 2026-2027 et liens clés au format llms.txt', async () => {
    const reponse = await llmsTxt();
    expect(reponse.headers.get('content-type')).toMatch(/text\/plain|text\/markdown/);
    const brut = await reponse.text();
    expect(brut).toMatch(/^> /m);
    const texte = sansEspaces(brut);
    expect(texte.startsWith('# Nexus Réussite')).toBe(true);
    expect(texte).toContain(LEGAL.addresses.pedagogique.full);
    expect(texte).toContain('5 200 TND');
    expect(texte).toContain('7 600 TND');
    expect(texte).toContain('11 600 TND');
    expect(texte).toContain(`${LEGAL.web.url}/bac-candidat-libre`);
    expect(texte).toMatch(/frais de dossier et d’accompagnement Cyclades : 250 TND/i);
    expect(texte).not.toMatch(/Mutuelleville|Nexus Libre|garanti/);
  });

  test('/llms.txt : les deux dossiers d’inscription sont cités, campagne ouverte', async () => {
    const texte = sansEspaces(await (await llmsTxt()).text());
    for (const page of getPagesInscription2027()) {
      expect(texte).toContain(`${LEGAL.web.url}${page.chemin}`);
    }
    // L'adresse du portail est la seule que connaisse le site : celle des dossiers.
    expect(texte).toContain(getPagesInscription2027()[0].cyclades);
  });

  test('les horaires du centre sont lisibles par un assistant', async () => {
    const texte = sansEspaces(await (await llmsFullTxt()).text());
    expect(texte).toContain(sansEspaces(horairesLisibles()));
  });

  test('/llms-full.txt : les questions des parents des deux dossiers y figurent', async () => {
    const texte = sansEspaces(await (await llmsFullTxt()).text());
    for (const page of getPagesInscription2027()) {
      expect(page.questions.length).toBeGreaterThanOrEqual(5);
      for (const { question } of page.questions) {
        expect(texte).toContain(sansEspaces(question));
      }
    }
  });

  test('/llms-full.txt : fiche détaillée avec la FAQ candidats libres', async () => {
    const texte = sansEspaces(await (await llmsFullTxt()).text());
    expect(texte).toContain('Qu’est-ce qu’un candidat libre au bac français');
    expect(texte).toContain('Cyclades');
    expect(texte).toContain('EPS');
    expect(texte.length).toBeGreaterThan(4000);
  });
});
