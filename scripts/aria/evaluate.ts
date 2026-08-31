import {
  evaluateAriaConversationPolicyFixtures,
  loadAriaConversationEvaluationBundle,
} from '../../lib/aria/evaluation/contracts';

export type AriaEvaluationMode = 'check' | 'fixture' | 'provider';

export function readAriaEvaluationMode(argv: readonly string[]): AriaEvaluationMode {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (argument === '--mode') {
      const value = argv[index + 1];
      if (value !== undefined) values.push(value);
      index += 1;
    } else if (argument.startsWith('--mode=')) {
      values.push(argument.slice('--mode='.length));
    } else {
      throw new Error('ARIA_EVALUATION_MODE_REQUIRED');
    }
  }
  const explicit = values.length === 1 ? values[0] : undefined;
  if (explicit === 'check' || explicit === 'fixture' || explicit === 'provider') return explicit;
  throw new Error('ARIA_EVALUATION_MODE_REQUIRED');
}

export function runAriaEvaluation(input: Readonly<{
  argv: readonly string[];
  loadBundle?: typeof loadAriaConversationEvaluationBundle;
  evaluateFixtures?: typeof evaluateAriaConversationPolicyFixtures;
  write?: (value: string) => void;
}>): number {
  const mode = readAriaEvaluationMode(input.argv);
  const bundle = (input.loadBundle ?? loadAriaConversationEvaluationBundle)();
  const write = input.write ?? ((value: string) => process.stdout.write(value));
  if (mode === 'check') {
    write(`ARIA_EVALUATION_CASES=${bundle.cases.length}\n`);
    write(`ARIA_EVALUATION_REVIEW_STATUS=${bundle.review.reviewStatus}\n`);
    write(`ARIA_EVALUATION_SCHEMA_SHA256=${bundle.schemaSha256}\n`);
    write(`ARIA_EVALUATION_CORPUS_SHA256=${bundle.corpusSha256}\n`);
    return 0;
  }
  if (mode === 'provider') {
    if (bundle.review.reviewStatus !== 'APPROVED') {
      throw new Error('ARIA_EVALUATION_PROVIDER_BLOCKED_PENDING_HUMAN_REVIEW');
    }
    throw new Error('ARIA_EVALUATION_PROVIDER_RUNNER_NOT_CONFIGURED');
  }

  const report = (input.evaluateFixtures ?? evaluateAriaConversationPolicyFixtures)(bundle.cases);
  write(`${JSON.stringify(report, null, 2)}\n`);
  return report.failed > 0 ? 1 : 0;
}

if (require.main === module) {
  process.exitCode = runAriaEvaluation({ argv: process.argv.slice(2) });
}
