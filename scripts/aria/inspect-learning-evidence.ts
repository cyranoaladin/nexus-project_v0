/**
 * ARIA LearningEvidence support/ops inspector.
 *
 *   tsx scripts/aria/inspect-learning-evidence.ts --student-user-id <userId> [--course-key <key>] [--skill-id <id>] [--source <SOURCE>]
 *
 * Reads through the REAL application-layer read path
 * (`listLearningEvidenceForStudent`) exactly as a student would read their
 * own data — never a privileged bypass — so it stays honest about what the
 * product itself will one day show. Intended for support/debugging a
 * specific student's reported evidence, run by a trusted operator with a
 * real `User.id` (e.g. from a support ticket), never exposed via HTTP.
 */
import { listLearningEvidenceForStudent } from '../../lib/aria/application/evidence/list';
import type { LearningEvidenceSource } from '@prisma/client';

interface Args {
  readonly studentUserId: string;
  readonly courseKey?: string;
  readonly skillId?: string;
  readonly source?: LearningEvidenceSource;
}

export function parseArgs(argv: readonly string[]): Args {
  const flag = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const studentUserId = flag('--student-user-id');
  if (!studentUserId) {
    throw new Error('ARIA_EVIDENCE_INSPECT_MISSING_ARGUMENT:--student-user-id <userId> is required');
  }
  return {
    studentUserId,
    courseKey: flag('--course-key'),
    skillId: flag('--skill-id'),
    source: flag('--source') as LearningEvidenceSource | undefined,
  };
}

export async function inspectLearningEvidence(args: Args): Promise<void> {
  const rows = await listLearningEvidenceForStudent({
    actor: { userId: args.studentUserId, role: 'ELEVE' },
    filters: {
      courseKey: args.courseKey,
      skillId: args.skillId,
      source: args.source,
    },
  });
  console.log(`ARIA_EVIDENCE_INSPECT_COUNT=${rows.length}`);
  for (const row of rows) {
    console.log(JSON.stringify({
      id: row.id,
      courseKey: row.courseKey,
      skillId: row.skillId,
      source: row.source,
      sourceRefId: row.sourceRefId,
      observedAt: row.observedAt.toISOString(),
      outcome: row.outcome,
    }));
  }
}

if (require.main === module) {
  inspectLearningEvidence(parseArgs(process.argv.slice(2))).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
