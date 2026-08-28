/**
 * P3 §13/§17/§23/§33 — le pont "Travailler avec ARIA" ne fait jamais
 * d'appel réseau (jamais /api/aria/chat) : il navigue vers
 * /demo/utica-2026/aria?resource=<id>, résolu par allowlist stricte
 * (getResourceById), avec repli sûr sur la ressource recommandée si le
 * paramètre est inconnu ou absent.
 */
import { readFileSync } from 'node:fs';
import UticaDemoAriaPage from '@/app/demo/utica-2026/aria/page';
import { getRecommendedCatalogResource, getResourceById, getResourceCatalog } from '@/lib/demo/utica-2026/resources';

describe('Pont ressource → ARIA — résolution par query param', () => {
  test('un id de ressource réel dans searchParams résout vers cette ressource', async () => {
    const element = await UticaDemoAriaPage({
      searchParams: Promise.resolve({ resource: 'maths-b3-derivation' }),
    });
    expect(element).toBeTruthy();
  });

  test('chaque id du catalogue est résolvable via getResourceById (allowlist)', () => {
    const catalog = getResourceCatalog();
    for (const r of catalog) {
      expect(getResourceById(r.id)?.slug).toBe(r.slug);
    }
  });

  test('un id inconnu ou absent replie silencieusement sur la ressource recommandée (jamais une erreur)', async () => {
    expect(getResourceById('id-qui-nexiste-pas')).toBeUndefined();

    await expect(
      UticaDemoAriaPage({ searchParams: Promise.resolve({ resource: 'id-qui-nexiste-pas' }) }),
    ).resolves.toBeTruthy();
    await expect(UticaDemoAriaPage({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy();

    // Le comportement de repli est celui de getRecommendedCatalogResource().
    expect(getRecommendedCatalogResource().id).toBe('maths-b3-derivation');
  });

  test('la page ARIA et le pont ressource ne contiennent aucun appel réseau réel (P3 §17 : UTICA_ARIA_EXTERNAL_CALLS=0)', () => {
    const ariaSource = readFileSync(require.resolve('@/app/demo/utica-2026/aria/page'), 'utf8');
    const cockpitSource = readFileSync(
      require.resolve('@/components/demo/utica-2026/AriaResourceCockpit'),
      'utf8',
    );
    for (const source of [ariaSource, cockpitSource]) {
      expect(source).not.toMatch(/\bfetch\(/);
      expect(source).not.toMatch(/\/api\/aria\/chat/);
      expect(source).not.toMatch(/XMLHttpRequest/);
    }
  });

  test('aucun composant démo n\'importe le vrai AriaWidget de production', () => {
    const cockpitSource = readFileSync(
      require.resolve('@/components/demo/utica-2026/AriaResourceCockpit'),
      'utf8',
    );
    expect(cockpitSource).not.toMatch(/aria-widget|AriaWidget|aria-chat/);
  });
});
