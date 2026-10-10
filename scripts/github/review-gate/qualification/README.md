# Historical semantic-review pilot corpus

This corpus is a qualification input, **not merge authority**. Its 40 cases
reference 40 distinct historical repository commits (20 known-defect
reintroductions from reversed fixes, 20 forward corrections). The harness
reconstructs one three-line-context file hunk from each immutable commit,
matching the patch shape exposed by GitHub's PR-files API. A reversed fix is
an intentionally synthetic regression; its identifier is the patch digest,
not the historical fixing commit. Labels,
descriptions, commit IDs, and expected outcomes are never sent to the model.
Model inference must treat only the reconstructed patch as untrusted text.

The corpus deliberately remains `UNVETTED`. An independent reviewer must
confirm each defect/benign label, that the selected single-file patch contains
enough context, and that no forward correction carries an unrelated regression.
Several cases were replaced after initial vetting found ambiguous labels or
patches whose relevant context did not fit the proposed model window; this
revision does not turn the corpus into an independent held-out evaluation.
Historical incidents used to design a prompt or model choice must be excluded
from a later held-out authority evaluation. Reverse-fix cases alone cannot
establish performance on naturally occurring new defects. Until that work and
actual hosted-runner measurements are complete, `scoreQualification` can
report thresholds but cannot return `qualified: true` for this corpus.

`thresholds.json` was frozen before any model run: at least 20 cases per
class; recall at least 90%; security/governance recall exactly 100%; false
positives at most 5%; malformed outputs and timeouts at most 1% each; three-
pass p95 runtime at most eight minutes; per-case diff at most 64 KiB. These
limits are intentionally strict for a no-click path. A result that misses a
case, omits size/timing evidence, times out, cannot parse, or exceeds the
supported diff size is fail-closed.

Materialization needs the repository's full commit history (`fetch-depth: 0`
on a disposable qualification runner). It never executes historical source.
The required governance unit lane uses a small disposable Git history to test
the materializer because its CI checkout is shallow. The advisory benchmark
runner exercises all 40 historical refs with full history and fails if any is
unavailable; neither lane silently skips a missing ref. No model or inference
binary is downloaded or run by the unit harness.

Hosted comparisons on PR heads `61ddbefc1b4c47091e85dc234f2b84b714e7340c`
(run `37072902396`) and `640989ff4c3ec49b6837c60ccfd5a8f72352e3d8`
(run `37073620315`), both attempt 1, qualified neither candidate. In the
second run Qwen 7B had 40/40 `MODEL_PROCESS_FAILED`; Granite 3B had 34 of
those plus six `DIFF_UNSUPPORTED`. Both recalls were zero. A local reproduction
with the exact pinned llama.cpp binary and synthetic input showed that its
`-f /dev/stdin` argument fails with `failed to open file '/dev/stdin'` under
the Node subprocess transport. The corrected invocation keeps the prompt on
stdin without that argument, and a negative local probe now reaches the
expected model-load stage. A fresh hosted measurement is still required.
These failures are not semantic-review evidence. The corpus also still
requires independent vetting and held-out evaluation regardless of transport.
