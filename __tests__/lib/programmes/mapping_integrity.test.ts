/**
 * Tests for YAML mapping integrity.
 * Verifies: all skillIds are stable, no duplicates, weights valid,
 * and the registry correctly loads all 4 definitions.
 */

import * as fs from 'fs';
import * as path from 'path';
import { load as parseYaml } from 'js-yaml';

const MAPPING_DIR = path.resolve(process.cwd(), 'programmes/mapping');

const MAPPING_FILES = [
  'maths_premiere.skills.map.yml',
  'maths_terminale.skills.map.yml',
  'nsi_premiere.skills.map.yml',
  'nsi_terminale.skills.map.yml',
];

interface MappingSkill {
  skillId: string;
  label: string;
  tags?: string[];
}

interface MappingDomain {
  domainId: string;
  domainLabel: string;
  weight: number;
  skills: MappingSkill[];
}

interface MappingYaml {
  programmeKey: string;
  definitionKey: string;
  schemaVersion: string;
  label: string;
  discipline: string;
  level: string;
  domains: MappingDomain[];
}

describe('Mapping YAML Integrity', () => {
  const mappings: Record<string, MappingYaml> = {};

  beforeAll(() => {
    for (const file of MAPPING_FILES) {
      const filePath = path.join(MAPPING_DIR, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const key = file.replace('.skills.map.yml', '');
      mappings[key] = parseYaml(raw) as MappingYaml;
    }
  });

  test('all 4 mapping files exist', () => {
    for (const file of MAPPING_FILES) {
      const filePath = path.join(MAPPING_DIR, file);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  describe.each(MAPPING_FILES.map((f) => f.replace('.skills.map.yml', '')))('%s', (key) => {
    let mapping: MappingYaml;

    beforeAll(() => {
      mapping = mappings[key];
    });

    test('has required top-level fields', () => {
      expect(mapping.programmeKey).toBe(key);
      expect(mapping.definitionKey).toBeTruthy();
      expect(mapping.schemaVersion).toBeTruthy();
      expect(mapping.label).toBeTruthy();
      expect(mapping.discipline).toMatch(/^(maths|nsi)$/);
      expect(mapping.level).toMatch(/^(premiere|terminale)$/);
    });

    test('has at least 4 domains', () => {
      expect(mapping.domains.length).toBeGreaterThanOrEqual(4);
    });

    test('domain weights sum to ~1.0', () => {
      const sum = mapping.domains.reduce((acc, d) => acc + d.weight, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    });

    test('all domainIds are unique', () => {
      const ids = mapping.domains.map((d) => d.domainId);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    test('all skillIds are globally unique within the mapping', () => {
      const allIds = mapping.domains.flatMap((d) => d.skills.map((s) => s.skillId));
      const unique = new Set(allIds);
      if (unique.size !== allIds.length) {
        const duplicates = allIds.filter((id, i) => allIds.indexOf(id) !== i);
        fail(`Duplicate skillIds found: ${[...new Set(duplicates)].join(', ')}`);
      }
    });

    test('every skill has a non-empty label', () => {
      for (const domain of mapping.domains) {
        for (const skill of domain.skills) {
          expect(skill.skillId).toBeTruthy();
          expect(skill.label).toBeTruthy();
          expect(skill.label.length).toBeGreaterThan(2);
        }
      }
    });

    test('skillIds follow naming convention (UPPER_SNAKE_CASE)', () => {
      for (const domain of mapping.domains) {
        for (const skill of domain.skills) {
          expect(skill.skillId).toMatch(/^[A-Z][A-Z0-9_]+$/);
        }
      }
    });

    test('domain weights are between 0.05 and 0.50', () => {
      for (const domain of mapping.domains) {
        expect(domain.weight).toBeGreaterThanOrEqual(0.05);
        expect(domain.weight).toBeLessThanOrEqual(0.50);
      }
    });

    test('every domain has at least 2 skills', () => {
      for (const domain of mapping.domains) {
        expect(domain.skills.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  test('definitionKeys are unique across all mappings', () => {
    const keys = Object.values(mappings).map((m) => m.definitionKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('discipline/level combinations cover all 4 tracks', () => {
    const combos = Object.values(mappings).map((m) => `${m.discipline}-${m.level}`);
    expect(combos).toContain('maths-premiere');
    expect(combos).toContain('maths-terminale');
    expect(combos).toContain('nsi-premiere');
    expect(combos).toContain('nsi-terminale');
  });
});

describe('Definition Registry Integration', () => {
  test('all 4 primary definitions are loadable', () => {
    // Import the registry
    const { getDefinition } = require('@/lib/diagnostics/definitions');

    const primaryKeys = ['maths-premiere-p2', 'maths-terminale-p2', 'nsi-premiere-p2', 'nsi-terminale-p2'];
    for (const key of primaryKeys) {
      const def = getDefinition(key);
      expect(def).toBeDefined();
      expect(def.key).toBe(key);
      expect(Object.keys(def.skills).length).toBeGreaterThanOrEqual(4);
    }
  });

  test('legacy aliases resolve correctly', () => {
    const { getDefinition } = require('@/lib/diagnostics/definitions');

    expect(getDefinition('eds_maths_1ere').key).toBe('maths-premiere-p2');
    expect(getDefinition('eds_maths_tle').key).toBe('maths-terminale-p2');
    expect(getDefinition('eds_nsi_1ere').key).toBe('nsi-premiere-p2');
    expect(getDefinition('eds_nsi_tle').key).toBe('nsi-terminale-p2');
  });

  test('each definition has valid prompts for all 3 audiences', () => {
    const { getDefinition } = require('@/lib/diagnostics/definitions');

    const keys = ['maths-premiere-p2', 'maths-terminale-p2', 'nsi-premiere-p2', 'nsi-terminale-p2'];
    for (const key of keys) {
      const def = getDefinition(key);
      expect(def.prompts.eleve).toBeTruthy();
      expect(def.prompts.parents).toBeTruthy();
      expect(def.prompts.nexus).toBeTruthy();
      expect(def.prompts.eleve.length).toBeGreaterThan(100);
      expect(def.prompts.parents.length).toBeGreaterThan(100);
      expect(def.prompts.nexus.length).toBeGreaterThan(100);
    }
  });

  test('each definition has valid scoring policy', () => {
    const { getDefinition } = require('@/lib/diagnostics/definitions');

    const keys = ['maths-premiere-p2', 'maths-terminale-p2', 'nsi-premiere-p2', 'nsi-terminale-p2'];
    for (const key of keys) {
      const def = getDefinition(key);
      const weights = Object.values(def.scoringPolicy.domainWeights) as number[];
      const sum = weights.reduce((a: number, b: number) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 1);
      expect(def.scoringPolicy.thresholds.confirmed.readiness).toBeGreaterThan(0);
      expect(def.scoringPolicy.thresholds.conditional.readiness).toBeGreaterThan(0);
    }
  });

  test('NSI definitions have correct track', () => {
    const { getDefinition } = require('@/lib/diagnostics/definitions');

    expect(getDefinition('nsi-premiere-p2').track).toBe('nsi');
    expect(getDefinition('nsi-terminale-p2').track).toBe('nsi');
  });

  test('Maths definitions have correct track', () => {
    const { getDefinition } = require('@/lib/diagnostics/definitions');

    expect(getDefinition('maths-premiere-p2').track).toBe('maths');
    expect(getDefinition('maths-terminale-p2').track).toBe('maths');
  });
});
