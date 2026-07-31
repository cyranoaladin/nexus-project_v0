# OpenRouter authenticated preflight

## Date

30 July 2026

## Scope

This audit covers synthetic authenticated preflight only. It does not connect
OpenRouter to assessment data, Prisma, report services, routes, workers, user
interfaces, or production.

## Baseline

- PR #90 head at branch creation:
  `ae56389dcf1b92ca4bece39e71961327455e2489`
- Preflight implementation branch:
  `feat/bilan-openrouter-preflight-benchmark`
- Model policy: `bilan-model-policy` version `1.1`
- Retry policy: `bilan-retry-policy` version `1`

## Owner attestations

The following statements are recorded as owner attestations. They are not
represented as API-verified account settings:

- input/output logging is disabled;
- OpenRouter use of inputs and outputs is disabled;
- the account ZDR policy is enabled;
- a guardrail is enabled;
- the dedicated key spending limit is USD 2.

Every synthetic request independently enforces:

- `provider.require_parameters=true`;
- `provider.data_collection=deny`;
- `provider.zdr=true`.

## Secret handling

The key is read only through the repository secure reader. The reader requires
a regular file owned by the current user, mode `0600`, a parent directory mode
`0700`, one non-empty line, a bounded size, and `O_NOFOLLOW`.

The key, its complete fingerprint, request messages, completions, authorization
headers, and raw provider errors are excluded from Git, console output, and
evidence.

## Dedicated limits

- maximum model calls per run: 2;
- maximum output tokens per call: 256;
- maximum cost per model: 100,000 micro-USD;
- maximum total preflight cost: 200,000 micro-USD.

These limits do not modify the business report budgets.

## Authenticated result

At software SHA `8d0384e456c047a98492e69899d1c988fce4b436`,
the canonical command produced:

- Sonnet 5: passed through the Azure provider;
- GPT-5.6 Terra: failed with the normalized code
  `OPENROUTER_INVALID_REQUEST`;
- total charged cost: 1,108 micro-USD;
- no real student data: zero data subjects;
- private evidence directory mode: `0700`;
- private evidence file mode: `0600`.

Sonnet metrics:

- prompt tokens: 324;
- completion tokens: 46;
- reasoning tokens: 0;
- total tokens: 370;
- latency: 4,962 ms;
- cost: 1,108 micro-USD;
- finish reason: `stop`;
- strict schema and synthetic contract: valid.

Terra returned no completion, token usage, provider, or cost metadata. Raw
provider error content was intentionally discarded.

## Interpretation

The OpenRouter reasoning documentation states that GPT-5 reasoning effort uses
a minimum reasoning allocation of 1,024 tokens and that `max_tokens` must be
strictly higher than the reasoning budget. The owner-approved preflight cap is
256 tokens. The observed Terra invalid request is therefore consistent with a
model parameter incompatibility, but the raw provider message was not retained
and must not be reconstructed.

No parameter was silently removed, no model policy was changed, and no retry
was introduced.

## Benchmark gate

The local-first benchmark is not authorized because the fallback model did not
pass authenticated preflight. Consequently:

- benchmark call count: 0;
- benchmark cost: 0;
- synthetic benchmark fixtures: not created;
- model policy v1.2 proposal: not created.

## Required owner decision

Before a new authenticated attempt, approve a new preflight token policy that
is compatible with `reasoning.effort=low`, or replace the fallback model in a
new versioned model policy. The implementation must not infer this decision.

## Rollback

The branch is not connected to runtime business code. Rollback consists of
closing the stacked draft PR or reverting its commits. No database or
production rollback is required.
