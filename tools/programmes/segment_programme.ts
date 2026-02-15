/**
 * segment_programme.ts — Programme segmentation (CdC V2 §4.1, COMMIT 1)
 *
 * Segments extracted programme text into domain sections and skill candidates
 * using heuristics (bullet points, short lines, section headers).
 *
 * Usage:
 *   npx tsx tools/programmes/segment_programme.ts --extracted=programmes/extracted/maths_premiere.extracted.json
 *
 * The output is a ProgrammeCandidates JSON used by generate_skills_json.ts.
 * NOTE: Extraction is NOISY — the YAML mapping is the source of truth.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { ExtractedProgramme } from './extract_programme_text';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** A skill candidate extracted from the programme text */
export interface SkillCandidate {
  rawLabel: string;
  normalizedLabel: string;
  confidence: number;
  anchors: Array<{ page?: number; excerpt: string }>;
}

/** Segmented programme with domain sections and skill candidates */
export interface ProgrammeCandidates {
  programmeKey: 'maths_premiere' | 'maths_terminale' | 'nsi_premiere' | 'nsi_terminale';
  generatedAt: string;
  sections: Array<{
    rawTitle: string;
    normalizedTitle: string;
    domainId: string;
    candidates: SkillCandidate[];
  }>;
}

/** Domain detection patterns per discipline */
const MATHS_DOMAIN_PATTERNS: Array<{ pattern: RegExp; domainId: string; label: string }> = [
  { pattern: /alg[eè]bre/i, domainId: 'algebra', label: 'Algèbre' },
  { pattern: /analyse/i, domainId: 'analysis', label: 'Analyse' },
  { pattern: /g[eé]om[eé]trie/i, domainId: 'geometry', label: 'Géométrie' },
  { pattern: /probabilit[eé]s?|statistiques?/i, domainId: 'prob_stats', label: 'Probabilités & statistiques' },
  { pattern: /algorithmique|programmation/i, domainId: 'algo_prog', label: 'Algorithmique & programmation' },
  { pattern: /logique|ensembliste/i, domainId: 'logic_sets', label: 'Logique & ensembles' },
];

const NSI_DOMAIN_PATTERNS: Array<{ pattern: RegExp; domainId: string; label: string }> = [
  { pattern: /repr[eé]sentation.*donn[eé]es|types.*base/i, domainId: 'data_representation', label: 'Représentation des données' },
  { pattern: /traitement.*donn[eé]es/i, domainId: 'data_processing', label: 'Traitement des données' },
  { pattern: /structures.*donn[eé]es|arbres|graphes|piles|files/i, domainId: 'data_structures', label: 'Structures de données' },
  { pattern: /algorithmique|algorithme|r[eé]cursivit[eé]/i, domainId: 'algorithms', label: 'Algorithmique' },
  { pattern: /python|programmation/i, domainId: 'python_programming', label: 'Programmation Python' },
  { pattern: /architecture|r[eé]seaux|syst[eè]me|OS/i, domainId: 'systems_architecture', label: 'Architecture & systèmes' },
  { pattern: /bases.*donn[eé]es|SQL|relationnel/i, domainId: 'databases', label: 'Bases de données' },
];

/** Lines to exclude (noise) */
const NOISE_PATTERNS = [
  /^objectifs?$/i,
  /^histoire\b/i,
  /^rep[eè]res?\b/i,
  /^commentaires?\b/i,
  /^introduction\b/i,
  /^pr[eé]ambule\b/i,
  /^capacit[eé]s?\s+attendues/i,
  /^\d+$/,
  /^page\s+\d+/i,
];

/**
 * Check if a line is a plausible skill candidate.
 * Heuristics: short, starts with uppercase, not a sentence, not noise.
 */
function isSkillCandidate(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 90) return false;
  if (!/^[A-ZÀ-Ü•\-–]/.test(trimmed)) return false;
  if (trimmed.endsWith('.') && trimmed.length > 60) return false;
  if (NOISE_PATTERNS.some((p) => p.test(trimmed))) return false;
  return true;
}

/**
 * Normalize a raw label: trim bullets, dashes, whitespace.
 */
function normalizeLabel(raw: string): string {
  return raw
    .replace(/^[•\-–—*]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Segment an extracted programme into domain sections and skill candidates.
 */
export function segmentProgramme(
  extracted: ExtractedProgramme,
  programmeKey: ProgrammeCandidates['programmeKey']
): ProgrammeCandidates {
  const isNSI = programmeKey.startsWith('nsi_');
  const patterns = isNSI ? NSI_DOMAIN_PATTERNS : MATHS_DOMAIN_PATTERNS;

  const sections: ProgrammeCandidates['sections'] = [];
  let currentSection: ProgrammeCandidates['sections'][0] | null = null;

  for (const page of extracted.pages) {
    const lines = page.text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check if this line is a domain header
      const matchedDomain = patterns.find((p) => p.pattern.test(trimmed));
      if (matchedDomain && trimmed.length < 80) {
        // Save previous section
        if (currentSection && currentSection.candidates.length > 0) {
          sections.push(currentSection);
        }
        currentSection = {
          rawTitle: trimmed,
          normalizedTitle: matchedDomain.label,
          domainId: matchedDomain.domainId,
          candidates: [],
        };
        continue;
      }

      // Add skill candidates to current section
      if (currentSection && isSkillCandidate(trimmed)) {
        const normalized = normalizeLabel(trimmed);
        if (normalized.length >= 3) {
          currentSection.candidates.push({
            rawLabel: trimmed,
            normalizedLabel: normalized,
            confidence: 0.7,
            anchors: [{ page: page.page, excerpt: trimmed }],
          });
        }
      }
    }
  }

  // Push last section
  if (currentSection && currentSection.candidates.length > 0) {
    sections.push(currentSection);
  }

  return {
    programmeKey,
    generatedAt: new Date().toISOString(),
    sections,
  };
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const extractedArg = args.find((a) => a.startsWith('--extracted='));
  const keyArg = args.find((a) => a.startsWith('--key='));

  if (!extractedArg || !keyArg) {
    console.error('Usage: npx tsx tools/programmes/segment_programme.ts --extracted=<path> --key=<programmeKey>');
    process.exit(1);
  }

  const extractedPath = extractedArg.split('=')[1];
  const key = keyArg.split('=')[1] as ProgrammeCandidates['programmeKey'];

  console.log(`[segment] Segmenting: ${extractedPath} (key=${key})`);
  const extracted: ExtractedProgramme = JSON.parse(fs.readFileSync(extractedPath, 'utf-8'));
  const candidates = segmentProgramme(extracted, key);

  const outDir = path.resolve(__dirname, '../../programmes/segmented');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, `${key}.candidates.json`);
  fs.writeFileSync(outPath, JSON.stringify(candidates, null, 2), 'utf-8');

  const totalCandidates = candidates.sections.reduce((s, sec) => s + sec.candidates.length, 0);
  console.log(`[segment] ✅ Written: ${outPath} (${candidates.sections.length} sections, ${totalCandidates} candidates)`);
}

main().catch((err) => {
  console.error('[segment] ❌ Error:', err.message);
  process.exit(1);
});
