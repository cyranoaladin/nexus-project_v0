/**
 * Tests for the compiled diagnostic definitions.
 * Verifies: structure, ID uniqueness, weight sums, skill counts, snapshot stability.
 */

import * as fs from 'fs';
import * as path from 'path';

const GENERATED_DIR = path.resolve(process.cwd(), 'lib/diagnostics/definitions/generated');

const DEFINITION_FILES = [
  'maths-premiere-p2.domains.json',
  'maths-terminale-p2.domains.json',
  'nsi-premiere-p2.domains.json',
  'nsi-terminale-p2.domains.json',
];

interface CompiledDomain {
  domainId: string;
  domainLabel: string;
  weight: number;
  skills: Array<{ skillId: string; skillLabel: string; tags?: string[] }>;
}

interface CompiledDefinition {
  id: string;
  label: string;
  discipline: string;
  level: string;
  track: string;
  schemaVersion: string;
  generatedAt: string;
  domains: CompiledDomain[];
}

describe('Compiled Definitions', () => {
  const definitions: Record<string, CompiledDefinition> = {};

  beforeAll(() => {
    for (const file of DEFINITION_FILES) {
      const filePath = path.join(GENERATED_DIR, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const key = file.replace('.domains.json', '');
      definitions[key] = JSON.parse(raw);
    }
  });

  test('all 4 definition files exist', () => {
    for (const file of DEFINITION_FILES) {
      const filePath = path.join(GENERATED_DIR, file);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  describe.each(DEFINITION_FILES.map((f) => f.replace('.domains.json', '')))('%s', (key) => {
    let def: CompiledDefinition;

    beforeAll(() => {
      def = definitions[key];
    });

    test('has required top-level fields', () => {
      expect(def.id).toBe(key);
      expect(def.label).toBeTruthy();
      expect(def.discipline).toMatch(/^(maths|nsi)$/);
      expect(def.level).toMatch(/^(premiere|terminale)$/);
      expect(def.track).toBe('eds');
      expect(def.schemaVersion).toBeTruthy();
      expect(def.generatedAt).toBeTruthy();
    });

    test('has at least 4 domains', () => {
      expect(def.domains.length).toBeGreaterThanOrEqual(4);
    });

    test('domain weights sum to ~1.0', () => {
      const sum = def.domains.reduce((acc, d) => acc + d.weight, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    });

    test('all domainIds are unique', () => {
      const ids = def.domains.map((d) => d.domainId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test('all skillIds are unique across all domains', () => {
      const allIds = def.domains.flatMap((d) => d.skills.map((s) => s.skillId));
      expect(new Set(allIds).size).toBe(allIds.length);
    });

    test('every domain has at least 2 skills', () => {
      for (const domain of def.domains) {
        expect(domain.skills.length).toBeGreaterThanOrEqual(2);
      }
    });

    test('every skill has a non-empty label', () => {
      for (const domain of def.domains) {
        for (const skill of domain.skills) {
          expect(skill.skillLabel).toBeTruthy();
          expect(skill.skillLabel.length).toBeGreaterThan(2);
        }
      }
    });

    test('every domain has a non-empty label', () => {
      for (const domain of def.domains) {
        expect(domain.domainLabel).toBeTruthy();
      }
    });

    test('domain weights are between 0 and 1', () => {
      for (const domain of def.domains) {
        expect(domain.weight).toBeGreaterThan(0);
        expect(domain.weight).toBeLessThanOrEqual(1);
      }
    });
  });

  test('skill count snapshot stability', () => {
    const snapshot: Record<string, number> = {
      'maths-premiere-p2': 35,
      'maths-terminale-p2': 35,
      'nsi-premiere-p2': 20,
      'nsi-terminale-p2': 23,
    };

    for (const [key, expectedCount] of Object.entries(snapshot)) {
      const def = definitions[key];
      const actualCount = def.domains.reduce((acc, d) => acc + d.skills.length, 0);
      expect(actualCount).toBe(expectedCount);
    }
  });

  test('domain count snapshot stability', () => {
    const snapshot: Record<string, number> = {
      'maths-premiere-p2': 6,
      'maths-terminale-p2': 5,
      'nsi-premiere-p2': 5,
      'nsi-terminale-p2': 6,
    };

    for (const [key, expectedCount] of Object.entries(snapshot)) {
      const def = definitions[key];
      expect(def.domains.length).toBe(expectedCount);
    }
  });
});
