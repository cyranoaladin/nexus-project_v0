# C2 AI pilot — real-call evidence log

Durable, committed record of every REAL (paid) OpenRouter call the C2 AI
pilot has ever made — kept OUTSIDE the disposable dev/test Postgres
instance, whose tables (including `diagnostic_ai_budget_ledger`) are
truncated by every test run. This is the authoritative source for the
pilot's cumulative real spend until a durable production/preview ledger
exists (see mission "FINALISATION CIBLÉE DE #316", 2026-09-22, §5/§9).

All content here is synthetic (the DEMO_FIXTURE instrument and its
entirely fabricated candidate answer) — never a real candidate's data.

## 2026-09-22-real-ai-pilot-call-01.json

- Provider request id: `gen-1790059726-Gm7NpA1UNZu5pbBS4q61`
- Model: `anthropic/claude-sonnet-4.5`, served via Amazon Bedrock
- Prompt tokens: 1163 — completion tokens: 465
- Reserved (worst-case): $0.036195 — **actual, reported cost: $0.010464**
- Ledger entry: `cmucbccsz000pqskuctyfboyh` (status COMMITTED)
- Independently confirmed against OpenRouter's own `/api/v1/generation?id=...`
  lookup: `provider_name: "Amazon Bedrock"`, `total_cost: 0.010464`.
- Cumulative pilot spend at the time of this call: $0.010464 of the $2.00 cap.

**Note (mission §4, found by inspecting this exact real response):** the
model's `preuve` field for both items was written as *"Phrase complète
présente dans la copie : '<quote>'"* rather than the bare literal quote —
under `bilan-evidence.ts`'s substring check this whole string would NOT
match the source (the wrapper text isn't in the copy), which is exactly
the "a citation must be a citation, not a paraphrase" failure mode §4
describes. The system prompt was tightened afterward (see
`bilan-ai-schema.ts`) to instruct the model to return the bare quote only.
This real response predates that fix and is kept as-is for the record.
