import {
  evaluateAriaConversationPolicyFixtures,
  loadAriaConversationEvaluationBundle,
} from '../../lib/aria/evaluation/contracts';

function readMode(): 'check' | 'fixture' | 'provider' {
  const explicit = process.argv.find((argument) => argument.startsWith('--mode='))?.split('=')[1]
    ?? process.argv[process.argv.indexOf('--mode') + 1];
  if (explicit === 'check' || explicit === 'fixture' || explicit === 'provider') return explicit;
  throw new Error('ARIA_EVALUATION_MODE_REQUIRED');
}

function main(): void {
  const mode = readMode();
  const bundle = loadAriaConversationEvaluationBundle();
  if (mode === 'check') {
    console.log(`ARIA_EVALUATION_CASES=${bundle.cases.length}`);
    console.log(`ARIA_EVALUATION_REVIEW_STATUS=${bundle.review.reviewStatus}`);
    console.log(`ARIA_EVALUATION_SCHEMA_SHA256=${bundle.schemaSha256}`);
    console.log(`ARIA_EVALUATION_CORPUS_SHA256=${bundle.corpusSha256}`);
    return;
  }
  if (mode === 'provider') {
    if (bundle.review.reviewStatus !== 'APPROVED') {
      throw new Error('ARIA_EVALUATION_PROVIDER_BLOCKED_PENDING_HUMAN_REVIEW');
    }
    throw new Error('ARIA_EVALUATION_PROVIDER_RUNNER_NOT_CONFIGURED');
  }

  const report = evaluateAriaConversationPolicyFixtures(bundle.cases);
  console.log(JSON.stringify(report, null, 2));
  if (report.failed > 0) process.exitCode = 1;
}

main();
