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
import { LEGAL } from '@/lib/legal';

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
    expect(texte).not.toMatch(/Mutuelleville|Nexus Libre|garanti/);
  });

  test('/llms-full.txt : fiche détaillée avec la FAQ candidats libres', async () => {
    const texte = sansEspaces(await (await llmsFullTxt()).text());
    expect(texte).toContain('Qu’est-ce qu’un candidat libre au bac français');
    expect(texte).toContain('Cyclades');
    expect(texte).toContain('EPS');
    expect(texte.length).toBeGreaterThan(4000);
  });
});
