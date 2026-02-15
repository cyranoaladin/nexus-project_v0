/**
 * Shared types for the programme extraction & compilation pipeline.
 */

/** Raw text extracted from a PDF */
export interface ExtractedProgramme {
  sourcePdf: string;
  extractedAt: string;
  pages: Array<{ page: number; text: string }>;
  fullText: string;
}

/** A candidate skill identified by heuristics */
export interface SkillCandidate {
  rawLabel: string;
  normalizedLabel: string;
  confidence: number; // 0..1
  anchors: Array<{ page?: number; excerpt: string }>;
}

/** Programme key enum */
export type ProgrammeKey =
  | 'maths_premiere'
  | 'maths_terminale'
  | 'nsi_premiere'
  | 'nsi_terminale';

/** Segmented programme with candidate skills per section */
export interface ProgrammeCandidates {
  programmeKey: ProgrammeKey;
  generatedAt: string;
  schemaVersion: string;
  sections: Array<{
    rawTitle: string;
    normalizedTitle: string;
    domainId: string;
    candidates: SkillCandidate[];
  }>;
}

/** Compiled definition payload (output of compile step) */
export interface CompiledDefinitionPayload {
  id: string;
  label: string;
  discipline: 'maths' | 'nsi';
  level: 'premiere' | 'terminale';
  track: 'eds';
  schemaVersion: string;
  generatedAt: string;
  domains: Array<{
    domainId: string;
    domainLabel: string;
    weight: number;
    skills: Array<{
      skillId: string;
      skillLabel: string;
      tags?: string[];
      chapterId?: string;
      prerequisite?: boolean;
      prerequisiteLevel?: 'core' | 'recommended';
    }>;
  }>;
  chapters?: Array<{
    chapterId: string;
    chapterLabel: string;
    description: string;
    domainId: string;
    skills: string[];
    ragTopics?: string[];
  }>;
}
