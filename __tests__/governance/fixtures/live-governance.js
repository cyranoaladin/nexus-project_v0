/**
 * A live GitHub state that conforms to `.github/governance/main-ruleset.json`'s
 * `desired` block, so a test can weaken exactly one protection and prove the
 * audit reports it. Every field here was read from the real ruleset 12801316
 * on 2026-09-17; nothing is invented.
 */

const CONTEXTS = [
  ['Lint', 15368],
  ['TypeScript Type Check', 15368],
  ['Unit Tests', 15368],
  ['Production Build', 15368],
  ['Real DB Integration', 15368],
  ['E2E Tests', 15368],
  ['Documents', 15368],
  ['Dependency Integrity', 15368],
  ['Security Scan', 15368],
  ['CI Success', 15368],
  ['GitGuardian Security Checks', 46505],
];

function conformingRuleset() {
  return {
    id: 12801316,
    name: 'main-protection',
    target: 'branch',
    enforcement: 'active',
    bypass_actors: [],
    conditions: { ref_name: { include: ['refs/heads/main'], exclude: [] } },
    rules: [
      { type: 'non_fast_forward', parameters: null },
      { type: 'deletion', parameters: null },
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 1,
          dismiss_stale_reviews_on_push: true,
          require_code_owner_review: false,
          require_last_push_approval: true,
          required_review_thread_resolution: true,
          require_extra_approval_for_unattributed_changes: true,
          required_reviewers: [],
          allowed_merge_methods: ['merge'],
        },
      },
      {
        type: 'required_status_checks',
        parameters: {
          do_not_enforce_on_create: false,
          strict_required_status_checks_policy: true,
          required_status_checks: CONTEXTS.map(([context, integration_id]) => ({ context, integration_id })),
        },
      },
    ],
  };
}

const CLASSIC_BPR_ON_MAIN = {
  id: 'BPR_kwDOPXufyc4EGsZG',
  pattern: 'main',
  matchingRefs: { totalCount: 1, nodes: [{ name: 'main', prefix: 'refs/heads/' }] },
};

/**
 * @param {object} [options]
 * @param {(ruleset: object) => void} [options.weaken] mutate the conforming ruleset in place
 * @param {boolean} [options.classicBpr] include a classic protection matching main
 * @param {Array} [options.collaborators]
 * @param {number|null} [options.writeCalls] null omits writeCallCount() entirely
 */
function makeGh({ weaken, classicBpr = false, collaborators, writeCalls = 0 } = {}) {
  const ruleset = conformingRuleset();
  if (weaken) weaken(ruleset);

  const gh = {
    apiJson: (path) => {
      if (path.includes('rulesets/')) return ruleset;
      if (path.includes('collaborators')) {
        return collaborators ?? [
          { login: 'abenrhouma', permissions: { push: true } },
          { login: 'adammeg', permissions: { push: true } },
        ];
      }
      return {};
    },
    graphql: () => ({
      data: {
        repository: {
          branchProtectionRules: { nodes: classicBpr ? [CLASSIC_BPR_ON_MAIN] : [] },
        },
      },
    }),
  };
  if (writeCalls !== null) gh.writeCallCount = () => writeCalls;
  return gh;
}

/** The parameters object of a rule type, for a test that wants to weaken it. */
function ruleParams(ruleset, type) {
  return ruleset.rules.find((rule) => rule.type === type).parameters;
}

module.exports = { conformingRuleset, makeGh, ruleParams, CONTEXTS, CLASSIC_BPR_ON_MAIN };
