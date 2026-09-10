/**
 * ARIA Practice Activity local/staging dev fixture seeder.
 *
 *   tsx scripts/aria/seed-practice-activity-fixture.ts --course-key <key> [--skill-id <id>] --activity-type <MCQ|SHORT_ANSWER> --version-label <label> --prompt '<json>' --expected-answer-shape '<json>' --correction-rubric '<json>'
 *
 * A genuine dev tool, not a stub: writes through the REAL, validated
 * authoring path (`authorAriaActivity` — the only writer that exists, and
 * the only one that ever will, per its own module docstring). Useful today
 * for seeding real content ahead of a future admin/curated-content
 * authoring pipeline. Never exposed via HTTP — `authorAriaActivity`
 * deliberately has no route.
 */
import { authorAriaActivity } from '../../lib/aria/application/practice/author';
import type { ActivityType } from '../../lib/aria/domain/practice/activity-content';

interface Args {
  readonly courseKey: string;
  readonly skillId: string | null;
  readonly curriculumVersion: string;
  readonly activityType: ActivityType;
  readonly versionLabel: string;
  readonly prompt: unknown;
  readonly expectedAnswerShape: unknown;
  readonly correctionRubric: unknown;
}

function parseJsonFlag(name: string, raw: string | undefined): unknown {
  if (raw === undefined) {
    throw new Error(`ARIA_ACTIVITY_SEED_MISSING_ARGUMENTS:${name}`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`ARIA_ACTIVITY_SEED_INVALID_JSON:${name}`);
  }
}

export function parseArgs(argv: readonly string[]): Args {
  const flag = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const courseKey = flag('--course-key');
  const activityType = flag('--activity-type');
  const versionLabel = flag('--version-label');
  const missing = [
    !courseKey && '--course-key',
    !activityType && '--activity-type',
    !versionLabel && '--version-label',
  ].filter((value): value is string => Boolean(value));
  if (missing.length > 0) {
    throw new Error(`ARIA_ACTIVITY_SEED_MISSING_ARGUMENTS:${missing.join(',')}`);
  }
  return {
    courseKey: courseKey!,
    skillId: flag('--skill-id') ?? null,
    curriculumVersion: flag('--curriculum-version') ?? 'v1',
    activityType: activityType as ActivityType,
    versionLabel: versionLabel!,
    prompt: parseJsonFlag('--prompt', flag('--prompt')),
    expectedAnswerShape: parseJsonFlag('--expected-answer-shape', flag('--expected-answer-shape')),
    correctionRubric: parseJsonFlag('--correction-rubric', flag('--correction-rubric')),
  };
}

export async function seedPracticeActivityFixture(args: Args): Promise<void> {
  const written = await authorAriaActivity(args);
  console.log(`ARIA_ACTIVITY_SEED_WRITTEN_ID=${written.id}`);
}

if (require.main === module) {
  seedPracticeActivityFixture(parseArgs(process.argv.slice(2))).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
