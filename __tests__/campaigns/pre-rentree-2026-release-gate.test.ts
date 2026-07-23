import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PRE_RENTREE_REQUIRED_GATE_IDS,
  filterPreRentreeFromPublicStages,
  getPreRentreeReleaseGate,
  isPreRentreeProtectedPublicPath,
} from '@/lib/campaigns/pre-rentree-2026/release-gate';
import {
  compilePreRentreeReviewSurfaceDTO,
  getPreRentreePublicSurfaceDTO,
} from '@/lib/campaigns/pre-rentree-2026/public-surface';
import { getPublicPreRentreeDocuments } from '@/lib/campaigns/pre-rentree-2026/documents';

describe('Pré-rentrée 2026 single public release gate', () => {
  it('fails closed until the owner sets PUBLIC_READY explicitly', () => {
    const gate = getPreRentreeReleaseGate();
    expect(gate.releaseStatus).toBe('READY_FOR_REVIEW');
    expect(gate.requiredPublicStatus).toBe('PUBLIC_READY');
    expect(gate.isPublicReady).toBe(false);
    expect(gate.gates.map(({ id }) => id)).toEqual(PRE_RENTREE_REQUIRED_GATE_IDS);
    expect(gate.unmetGateIds).toContain('publication_authorization');
    expect(getPreRentreePublicSurfaceDTO()).toBeNull();
    expect(getPublicPreRentreeDocuments()).toEqual([]);
    expect(compilePreRentreeReviewSurfaceDTO().offers.length).toBeGreaterThan(0);
  });

  it('requires dated evidence for every satisfied release gate', () => {
    const gate = getPreRentreeReleaseGate();
    for (const item of gate.gates) {
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.owner.length).toBeGreaterThan(0);
      if (item.value) {
        expect(item.validatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      } else {
        expect(item.validatedAt).toBeNull();
      }
    }
  });

  it.each([
    '/pre-rentree',
    '/stages/pre-rentree-2026',
    '/stages/pre-rentree-2026/inscription',
    '/api/stages/pre-rentree-2026',
    '/api/stages/pre-rentree-2026/inscrire',
    '/documents/pre-rentree-2026/programme.pdf',
  ])('protects %s behind the same server gate', (pathname) => {
    expect(isPreRentreeProtectedPublicPath(pathname)).toBe(true);
  });

  it('does not block unrelated public routes', () => {
    expect(isPreRentreeProtectedPublicPath('/stages')).toBe(false);
    expect(isPreRentreeProtectedPublicPath('/offres')).toBe(false);
    expect(isPreRentreeProtectedPublicPath('/api/stages')).toBe(false);
  });

  it('filters the campaign from public stage-list API results while closed', () => {
    const stages = [
      { slug: 'pre-rentree-2026', title: 'Pré-rentrée' },
      { slug: 'toussaint-2026', title: 'Toussaint' },
    ];
    expect(filterPreRentreeFromPublicStages(stages)).toEqual([
      { slug: 'toussaint-2026', title: 'Toussaint' },
    ]);
  });

  it('wires middleware, metadata, SEO and public APIs to the gate', () => {
    const files = [
      'middleware.ts',
      'app/stages/pre-rentree-2026/page.tsx',
      'app/sitemap.ts',
      'app/api/stages/route.ts',
      'app/api/stages/[stageSlug]/route.ts',
      'app/api/stages/[stageSlug]/inscrire/route.ts',
    ];
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).toMatch(/PreRentreeReleaseGate|PreRentreeProtectedPublicPath|PreRentreeFromPublicStages/);
    }
  });
});
