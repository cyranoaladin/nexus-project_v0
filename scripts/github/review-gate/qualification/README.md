# Historical semantic-review pilot corpus

This corpus is a qualification input, **not merge authority**. Its 40 cases
reference 40 distinct historical repository commits (20 known-defect
reintroductions from reversed fixes, 20 forward corrections). The harness
reconstructs a single-file patch from each immutable commit; labels,
descriptions, commit IDs, and expected outcomes are never sent to the model.
Model inference must treat only the reconstructed patch as untrusted text.

The corpus deliberately remains `UNVETTED`. An independent reviewer must
confirm each defect/benign label, that the selected single-file patch contains
enough context, and that no forward correction carries an unrelated regression.
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
No model or inference binary is downloaded or run by this harness.
