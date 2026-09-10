/**
 * ARIA LearningEvidence local/staging dev fixture seeder.
 *
 *   tsx scripts/aria/seed-learning-evidence-fixture.ts --student-id <studentId> --course-key <key> [--skill-id <id>] --source <SOURCE> --source-ref-id <id> --outcome '<json>'
 *
 * A genuine dev tool, not a stub: writes through the REAL, validated write
 * path (`recordLearningEvidence` — the only writer that exists, and the
 * only one that ever will, per its own module docstring). Useful today for
 * seeding realistic rows ahead of building the UI/cockpit panels that will
 * read them, and later as a local test-data tool once real producers
 * (Practice, Correction, conversation-assessment) exist. Never exposed via
 * HTTP — `recordLearningEvidence` deliberately has no route.
 */
import { recordLearningEvidence } from '../../lib/aria/application/evidence/record';
import type { LearningEvidenceSource } from '@prisma/client';

interface Args {
  readonly studentId: string;
  readonly courseKey: string;
  readonly skillId: string | null;
  readonly curriculumVersion: string;
  readonly source: LearningEvidenceSource;
  readonly sourceRefId: string;
  readonly outcome: unknown;
}

export function parseArgs(argv: readonly string[]): Args {
  const flag = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const studentId = flag('--student-id');
  const courseKey = flag('--course-key');
  const source = flag('--source');
  const sourceRefId = flag('--source-ref-id');
  const outcomeRaw = flag('--outcome');
  const missing = [
    !studentId && '--student-id',
    !courseKey && '--course-key',
    !source && '--source',
    !sourceRefId && '--source-ref-id',
    !outcomeRaw && '--outcome',
  ].filter((value): value is string => Boolean(value));
  if (missing.length > 0) {
    throw new Error(`ARIA_EVIDENCE_SEED_MISSING_ARGUMENTS:${missing.join(',')}`);
  }
  let outcome: unknown;
  try {
    outcome = JSON.parse(outcomeRaw!);
  } catch {
    throw new Error('ARIA_EVIDENCE_SEED_INVALID_OUTCOME_JSON');
  }
  return {
    studentId: studentId!,
    courseKey: courseKey!,
    skillId: flag('--skill-id') ?? null,
    curriculumVersion: flag('--curriculum-version') ?? 'v1',
    source: source as LearningEvidenceSource,
    sourceRefId: sourceRefId!,
    outcome,
  };
}

export async function seedLearningEvidenceFixture(args: Args): Promise<void> {
  const written = await recordLearningEvidence(args);
  console.log(`ARIA_EVIDENCE_SEED_WRITTEN_ID=${written.id}`);
}

if (require.main === module) {
  seedLearningEvidenceFixture(parseArgs(process.argv.slice(2))).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
