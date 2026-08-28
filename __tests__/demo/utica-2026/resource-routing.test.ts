/**
 * P3 §10/§33 — routage strict par allowlist (getResourceBySlug), jamais une
 * lecture arbitraire de fichier depuis un paramètre d'URL. Slug inconnu →
 * notFound().
 */
import { getResourceBySlug, getResourceCatalog } from '@/lib/demo/utica-2026/resources';

// notFound() lève un digest spécial NEXT_HTTP_ERROR_FALLBACK;404 côté
// Next.js — on mocke ici pour observer qu'il est bien appelé, sans dépendre
// du comportement interne de Next.
jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

import { notFound } from 'next/navigation';
import UticaResourcePage from '@/app/demo/utica-2026/ressources/[slug]/page';

describe('Routage des ressources — allowlist stricte', () => {
  test('chaque slug réel du catalogue résout vers la bonne ressource', () => {
    const catalog = getResourceCatalog();
    for (const r of catalog) {
      expect(getResourceBySlug(r.slug)?.id).toBe(r.id);
    }
  });

  test('un slug inconnu ne résout vers aucune ressource', () => {
    expect(getResourceBySlug('ce-slug-nexiste-pas')).toBeUndefined();
    expect(getResourceBySlug('../../../etc/passwd')).toBeUndefined();
    expect(getResourceBySlug('')).toBeUndefined();
  });

  test('la page appelle notFound() pour un slug inconnu, jamais une lecture de fichier', async () => {
    (notFound as unknown as jest.Mock).mockClear();
    await expect(
      UticaResourcePage({ params: Promise.resolve({ slug: 'ce-slug-nexiste-pas' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  test('la page appelle notFound() pour une tentative de traversée de chemin', async () => {
    (notFound as unknown as jest.Mock).mockClear();
    await expect(
      UticaResourcePage({ params: Promise.resolve({ slug: '../../../../etc/passwd' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  test('la page rend la ressource pour un slug réel, sans lever notFound()', async () => {
    (notFound as unknown as jest.Mock).mockClear();
    const element = await UticaResourcePage({
      params: Promise.resolve({ slug: 'complements-derivation-variations' }),
    });
    expect(element).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });

  test('le code source de la page ne contient aucun accès filesystem depuis le paramètre', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const rawSource = fs.readFileSync(
      require.resolve('@/app/demo/utica-2026/ressources/[slug]/page'),
      'utf8',
    );
    // Retire les commentaires avant de chercher un IMPORT/APPEL fs réel — le
    // fichier documente volontairement l'interdiction dans son en-tête.
    const codeOnly = rawSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/from ['"]node:fs['"]|from ['"]fs['"]|require\(['"](node:)?fs['"]\)|\bfs\.readFile\(/);
  });
});
