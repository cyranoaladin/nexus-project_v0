import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  PedagogyCatalogError,
  createPublicAssessmentDefinition,
  loadPedagogyCatalog,
  type PedagogySourceReader,
} from '@/lib/pre-rentree/pedagogy';

const repoRoot = process.cwd();
const canonicalReader: PedagogySourceReader = (relativePath) => (
  readFileSync(path.resolve(repoRoot, relativePath))
);

function expectCatalogError(action: () => unknown, code: string): void {
  let error: unknown;
  try {
    action();
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(PedagogyCatalogError);
  expect(error).toMatchObject({ code });
}

describe('canonical pre-rentree pedagogy catalog', () => {
  const catalog = loadPedagogyCatalog({ readSource: canonicalReader });

  it('derives every invariant from the canonical sources', () => {
    expect(catalog.version).toMatchObject({
      campaignId: 'pre-rentree-2026',
      manifestVersion: 1,
      moduleCatalogVersion: '2026-pre-rentree-v5-planning-windows',
    });
    expect(catalog.version.manifestSha256).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(catalog.counts).toEqual({
      modules: 17,
      sessions: 85,
      cps: 17,
      nodes: 141,
      evaluatedNodes: 136,
      items: 408,
      manualResponses: 33,
      sessionUnitFiles: 340,
    });
  });

  it('exposes stable immutable module, session and assessment definitions', () => {
    const moduleDefinition = catalog.getModule('terminale-mathematiques');
    const assessment = catalog.getAssessment(
      'maths-entree-terminale',
      'INTERNAL_REVIEW',
    );

    expect(moduleDefinition.sessions.map(({ id }) => id)).toEqual([
      'terminale-mathematiques:session:1',
      'terminale-mathematiques:session:2',
      'terminale-mathematiques:session:3',
      'terminale-mathematiques:session:4',
      'terminale-mathematiques:session:5',
    ]);
    expect(assessment.ref).toEqual({
      definitionId: 'maths-entree-terminale',
      moduleId: 'terminale-mathematiques',
      version: 'pre-rentree-2026:manifest-1:edition-2026',
      sha256: 'sha256:db723beb770084dc1622f2644e0d64630d21b376c67895b54c58b8457ebde16c',
    });
    expect(Object.isFrozen(moduleDefinition)).toBe(true);
    expect(Object.isFrozen(moduleDefinition.sessions)).toBe(true);
    expect(Object.isFrozen(assessment)).toBe(true);
    expect(Object.isFrozen(assessment.nodes)).toBe(true);
  });

  it('refuses unknown definitions and never invents Physique-Chimie Seconde', () => {
    expectCatalogError(
      () => catalog.getModule('seconde-physique-chimie'),
      'UNKNOWN_DEFINITION',
    );
    expectCatalogError(
      () => catalog.getAssessment('physique-chimie-entree-seconde', 'INTERNAL_REVIEW'),
      'UNKNOWN_DEFINITION',
    );
  });

  it.each(['ASSIGNMENT', 'PUBLICATION'] as const)(
    'fails closed when HUMAN_VALIDATION_REQUIRED content is requested for %s',
    (purpose) => {
      expectCatalogError(
        () => catalog.getAssessment('maths-entree-terminale', purpose),
        purpose === 'ASSIGNMENT'
          ? 'CONTENT_NOT_ASSIGNABLE'
          : 'CONTENT_NOT_PUBLISHABLE',
      );
    },
  );

  it('rejects a persisted definition reference with a stale version or hash', () => {
    const current = catalog.getAssessment(
      'maths-entree-terminale',
      'INTERNAL_REVIEW',
    ).ref;

    expectCatalogError(
      () => catalog.assertAssessmentRef({ ...current, version: `${current.version}:stale` }),
      'DEFINITION_REF_MISMATCH',
    );
    expectCatalogError(
      () => catalog.assertAssessmentRef({
        ...current,
        sha256: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
      'DEFINITION_REF_MISMATCH',
    );
  });

  it('rejects source bytes that no longer match the manifest hash', () => {
    const readSource: PedagogySourceReader = (relativePath) => {
      const bytes = canonicalReader(relativePath);
      return relativePath.endsWith('/maths-entree-terminale.yaml')
        ? Buffer.concat([bytes, Buffer.from('\n# tampered\n')])
        : bytes;
    };

    expectCatalogError(
      () => loadPedagogyCatalog({ readSource }),
      'SOURCE_HASH_MISMATCH',
    );
  });

  it('rejects a semantic module/manifest relationship mismatch', () => {
    const readSource: PedagogySourceReader = (relativePath) => {
      const bytes = canonicalReader(relativePath);
      if (relativePath !== 'content/pre-rentree-2026/modules.json') return bytes;

      const value = JSON.parse(bytes.toString('utf8')) as {
        modules: Array<{ id: string; subjectId: string }>;
      };
      const target = value.modules.find(({ id }) => id === 'terminale-mathematiques');
      if (!target) throw new Error('test fixture is missing terminale-mathematiques');
      target.subjectId = 'NSI';
      return Buffer.from(JSON.stringify(value));
    };

    expectCatalogError(
      () => loadPedagogyCatalog({ readSource }),
      'CATALOG_RELATION_MISMATCH',
    );
  });

  it('rejects a qcm_unique definition without exactly one correct option', () => {
    const cpsPath = 'content/pre-rentree-2026/pedagogy/positioning/cps/maths-entree-terminale.yaml';
    const canonicalCps = canonicalReader(cpsPath);
    const tamperedCps = Buffer.from(
      canonicalCps.toString('utf8').replace('correcte: false', 'correcte: true'),
    );
    const canonicalCpsHash = createHash('sha256').update(canonicalCps).digest('hex');
    const tamperedCpsHash = createHash('sha256').update(tamperedCps).digest('hex');
    const readSource: PedagogySourceReader = (relativePath) => {
      if (relativePath === cpsPath) return tamperedCps;
      const bytes = canonicalReader(relativePath);
      if (relativePath !== 'content/pre-rentree-2026/pedagogy/manifest.yaml') {
        return bytes;
      }
      return Buffer.from(
        bytes.toString('utf8').replace(canonicalCpsHash, tamperedCpsHash),
      );
    };

    expectCatalogError(
      () => loadPedagogyCatalog({ readSource }),
      'INVALID_SOURCE',
    );
  });

  it('projects a public assessment without answer keys or grading metadata', () => {
    const assessment = catalog.getAssessment(
      'francais-entree-seconde',
      'INTERNAL_REVIEW',
    );
    const publicDefinition = createPublicAssessmentDefinition(assessment);
    const serialized = JSON.stringify(publicDefinition);

    expect(publicDefinition).toMatchObject({
      id: assessment.id,
      moduleId: assessment.moduleId,
      version: assessment.ref.version,
      sha256: assessment.ref.sha256,
    });
    expect(publicDefinition.items).toHaveLength(24);
    expect(publicDefinition.items.some(
      ({ responseMode }) => responseMode === 'MANUAL_SHORT_RESPONSE',
    )).toBe(true);
    for (const forbidden of [
      '"correct"',
      '"rationale"',
      '"targetedObstacle"',
      '"gradingCriteria"',
      '"admissibleAnswerExample"',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(serialized).not.toContain('Réponse ouverte');
    expect(Object.isFrozen(publicDefinition)).toBe(true);
    expect(Object.isFrozen(publicDefinition.items)).toBe(true);
  });
});
