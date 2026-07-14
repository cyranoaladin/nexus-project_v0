import {
  MATHS_PREMIERE_P2,
} from '@/lib/diagnostics/definitions/maths-premiere-p2';
import {
  MATHS_TERMINALE_P2,
} from '@/lib/diagnostics/definitions/maths-terminale-p2';
import {
  NSI_PREMIERE_P2,
} from '@/lib/diagnostics/definitions/nsi-premiere-p2';
import {
  NSI_TERMINALE_P2,
} from '@/lib/diagnostics/definitions/nsi-terminale-p2';
import type { DiagnosticDefinition } from '@/lib/diagnostics/types';

import type { CatalogSubject, SchoolLevel } from '../../core/types';
import type { CurriculumPack } from '../service';

const SCHOOL_YEAR = '2026-2027';

function checksum(content: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(content)).digest('hex')}`;
}

function normalizedSubject(track: DiagnosticDefinition['track']): CatalogSubject {
  return track === 'nsi' ? 'NSI' : 'MATHEMATIQUES';
}

function normalizedGrade(level: DiagnosticDefinition['level']): SchoolLevel {
  return level === 'premiere' ? 'PREMIERE' : 'TERMINALE';
}

function adaptDefinition(definition: DiagnosticDefinition): CurriculumPack {
  const competencies = Object.values(definition.skills).flat().map((skill) => ({
    id: skill.skillId,
    prerequisiteIds: skill.prerequisites,
    questionIds: [`legacy-question:${definition.key}:${skill.skillId}`],
  }));

  return {
    id: `legacy-adaptation:${definition.key}:v1`,
    status: 'REVIEW_REQUIRED',
    selection: {
      subject: normalizedSubject(definition.track),
      grade: normalizedGrade(definition.level),
      schoolYear: SCHOOL_YEAR,
    },
    versions: {
      curriculum: `legacy-${definition.version}`,
      assessment: `legacy-${definition.version}`,
      scoring: `legacy-${definition.version}`,
      report: definition.prompts.version,
      corpus: `legacy-${definition.version}`,
    },
    checksums: {
      curriculum: checksum({ chapters: definition.chapters, skills: definition.skills }),
      assessment: checksum({ key: definition.key, skills: definition.skills }),
      scoring: checksum(definition.scoringPolicy),
      report: checksum(definition.prompts),
      corpus: checksum(definition.ragPolicy),
    },
    regulatory: {},
    competencies,
    questionIds: competencies.flatMap((competency) => competency.questionIds),
    minimumCoverage: { competencies: 1, questions: 1 },
  };
}

/**
 * A normalized, deliberately unpublished adaptation of the current Maths/NSI
 * diagnostics. The legacy definitions are not re-exported by the catalogue.
 */
export const MATHS_NSI_V1_PACKS: readonly CurriculumPack[] = [
  MATHS_PREMIERE_P2,
  MATHS_TERMINALE_P2,
  NSI_PREMIERE_P2,
  NSI_TERMINALE_P2,
].map(adaptDefinition);
import { createHash } from 'node:crypto';
