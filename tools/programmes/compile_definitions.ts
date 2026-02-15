#!/usr/bin/env tsx
/**
 * CdC §4.3 — Compile YAML mappings into domain JSON files.
 *
 * Reads: programmes/mapping/{key}.skills.map.yml
 * Writes: lib/diagnostics/definitions/generated/{definitionKey}.domains.json
 *
 * Usage:
 *   npx tsx tools/programmes/compile_definitions.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import type { CompiledDefinitionPayload } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAPPING_DIR = path.resolve(__dirname, '../../programmes/mapping');
const OUT_DIR = path.resolve(__dirname, '../../lib/diagnostics/definitions/generated');

interface MappingYaml {
  programmeKey: string;
  definitionKey: string;
  schemaVersion: string;
  label: string;
  discipline: 'maths' | 'nsi';
  level: 'premiere' | 'terminale';
  domains: Array<{
    domainId: string;
    domainLabel: string;
    weight: number;
    skills: Array<{
      skillId: string;
      label: string;
      tags?: string[];
    }>;
  }>;
  chapters?: Array<{
    chapterId: string;
    chapterLabel: string;
    description: string;
    domainId: string;
    skills: string[];
  }>;
}

/**
 * Validate a mapping YAML structure.
 * @throws Error if validation fails
 */
function validateMapping(mapping: MappingYaml, filePath: string): void {
  const errors: string[] = [];

  if (!mapping.programmeKey) errors.push('Missing programmeKey');
  if (!mapping.definitionKey) errors.push('Missing definitionKey');
  if (!mapping.schemaVersion) errors.push('Missing schemaVersion');
  if (!mapping.label) errors.push('Missing label');
  if (!mapping.discipline) errors.push('Missing discipline');
  if (!mapping.level) errors.push('Missing level');
  if (!mapping.domains || mapping.domains.length === 0) errors.push('No domains defined');

  // Check weight sum ≈ 1.0
  const weightSum = mapping.domains.reduce((sum, d) => sum + d.weight, 0);
  if (Math.abs(weightSum - 1.0) > 0.01) {
    errors.push(`Domain weights sum to ${weightSum.toFixed(3)}, expected ~1.0`);
  }

  // Check unique IDs
  const allSkillIds = new Set<string>();
  const allDomainIds = new Set<string>();
  for (const domain of mapping.domains) {
    if (allDomainIds.has(domain.domainId)) {
      errors.push(`Duplicate domainId: ${domain.domainId}`);
    }
    allDomainIds.add(domain.domainId);

    if (!domain.skills || domain.skills.length === 0) {
      errors.push(`Domain ${domain.domainId} has no skills`);
    }

    for (const skill of domain.skills) {
      if (allSkillIds.has(skill.skillId)) {
        errors.push(`Duplicate skillId: ${skill.skillId}`);
      }
      allSkillIds.add(skill.skillId);

      if (!skill.label) {
        errors.push(`Skill ${skill.skillId} has no label`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed for ${filePath}:\n  - ${errors.join('\n  - ')}`);
  }
}

/**
 * Compile a single mapping YAML into a CompiledDefinitionPayload.
 */
function compileMapping(mapping: MappingYaml): CompiledDefinitionPayload {
  const allSkillIds = new Set<string>();
  for (const d of mapping.domains) {
    for (const s of d.skills) allSkillIds.add(s.skillId);
  }

  // Validate chapter skill references
  if (mapping.chapters) {
    for (const ch of mapping.chapters) {
      for (const sid of ch.skills) {
        if (!allSkillIds.has(sid)) {
          console.warn(`⚠️  Chapter ${ch.chapterId} references unknown skill: ${sid}`);
        }
      }
    }
  }

  return {
    id: mapping.definitionKey,
    label: mapping.label,
    discipline: mapping.discipline,
    level: mapping.level,
    track: 'eds',
    schemaVersion: mapping.schemaVersion,
    generatedAt: new Date().toISOString(),
    domains: mapping.domains.map((d) => ({
      domainId: d.domainId,
      domainLabel: d.domainLabel,
      weight: d.weight,
      skills: d.skills.map((s) => ({
        skillId: s.skillId,
        skillLabel: s.label,
        tags: s.tags,
      })),
    })),
    chapters: mapping.chapters?.map((ch) => ({
      chapterId: ch.chapterId,
      chapterLabel: ch.chapterLabel,
      description: ch.description,
      domainId: ch.domainId,
      skills: ch.skills,
    })),
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });

const mappingFiles = fs.readdirSync(MAPPING_DIR).filter((f) => f.endsWith('.skills.map.yml'));

if (mappingFiles.length === 0) {
  console.error('❌ No mapping YAML files found in', MAPPING_DIR);
  process.exit(1);
}

let totalSkills = 0;
let totalDomains = 0;

for (const file of mappingFiles) {
  const filePath = path.join(MAPPING_DIR, file);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const mapping = parseYaml(raw) as MappingYaml;

  // Validate
  validateMapping(mapping, filePath);

  // Compile
  const compiled = compileMapping(mapping);

  // Write
  const outPath = path.join(OUT_DIR, `${mapping.definitionKey}.domains.json`);
  fs.writeFileSync(outPath, JSON.stringify(compiled, null, 2), 'utf-8');

  const skillCount = compiled.domains.reduce((a, d) => a + d.skills.length, 0);
  totalSkills += skillCount;
  totalDomains += compiled.domains.length;

  console.log(`✅ Compiled: ${outPath}`);
  console.log(`   ${compiled.domains.length} domains, ${skillCount} skills, weights: ${compiled.domains.map((d) => `${d.domainId}=${d.weight}`).join(', ')}`);
}

console.log(`\n🎯 Compiled ${mappingFiles.length} definitions (${totalDomains} domains, ${totalSkills} skills total)`);
