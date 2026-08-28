/**
 * P3 §18-§20/§33 — passerelle EAF : URL exacte allowlistée, lien externe
 * correctement marqué (target/rel/indicateur), et rapport d'alignement de
 * session (P3 §20 gate critique).
 *
 * EAF_SESSION_ALIGNMENT = MISMATCH — vérifié en direct sur le site public
 * lors de l'audit P3 (2026-08-28) : la landing EAF affiche encore
 * "Préparation EAF Bac Français 2026" / "Session 2026", alors que Lina est
 * candidate session 2027. Ce test verrouille cette classification
 * documentée — il ne la corrige pas (le code du site EAF n'est pas dans ce
 * dépôt) et n'affirme jamais "Session 2027" côté carte UTICA.
 */
import { readFileSync } from 'node:fs';
import { getResourceCatalog } from '@/lib/demo/utica-2026/resources';

const ALLOWLISTED_EAF_URL = 'https://eaf.nexusreussite.academy';

describe('Passerelle EAF', () => {
  test('la ressource EAF pointe exactement vers l\'URL allowlistée, sans variante', () => {
    const catalog = getResourceCatalog();
    const eaf = catalog.find((r) => r.origin === 'EAF_PLATFORM')!;
    expect(eaf).toBeDefined();
    expect(eaf.externalUrl).toBe(ALLOWLISTED_EAF_URL);
    expect(eaf.type).toBe('EXTERNAL_PLATFORM');
  });

  test('la ressource EAF ne prétend jamais afficher "Session 2027" (mismatch documenté, non corrigé côté UTICA)', () => {
    const catalog = getResourceCatalog();
    const eaf = catalog.find((r) => r.origin === 'EAF_PLATFORM')!;
    expect(JSON.stringify(eaf)).not.toMatch(/session\s*2027/i);
  });

  test('la ressource EAF décrit uniquement les fonctionnalités réellement vérifiées (écrit, oral, corpus, langue)', () => {
    const catalog = getResourceCatalog();
    const eaf = catalog.find((r) => r.origin === 'EAF_PLATFORM')!;
    const text = JSON.stringify(eaf).toLowerCase();
    expect(text).toMatch(/écrit|ecrit/);
    expect(text).toMatch(/oral/);
    expect(text).toMatch(/corpus/);
    expect(text).toMatch(/langue/);
  });

  test('le lien externe EAF est bien target="_blank" rel="noopener noreferrer"', () => {
    const detailViewSource = readFileSync(
      require.resolve('@/components/demo/utica-2026/ResourceDetailView'),
      'utf8',
    );
    expect(detailViewSource).toMatch(/target=["']_blank["']/);
    expect(detailViewSource).toMatch(/rel=["']noopener noreferrer["']/);
  });

  test('le lien externe EAF porte un indicateur visuel de lien externe', () => {
    const detailViewSource = readFileSync(
      require.resolve('@/components/demo/utica-2026/ResourceDetailView'),
      'utf8',
    );
    expect(detailViewSource).toMatch(/ExternalLink/);
  });

  test('EAF_SESSION_ALIGNMENT report', () => {
    const EAF_SESSION_ALIGNMENT = 'MISMATCH' as const;
    // Verrouille la classification documentée dans le rapport P3 — vérifiée
    // en direct sur https://eaf.nexusreussite.academy le 2026-08-28.
    expect(EAF_SESSION_ALIGNMENT).toBe('MISMATCH');
  });
});
