# ARIA browser evidence artifact isolation

2026-10-04. Published source bd198fb480232bbf3ac4d5cc424111dfa266fa6d:
52 terminal checks, 48 success / 4 failure. ARIA Requirement Evidence fails
with ARIA_VISUAL_EVIDENCE_INVALID:ARTIFACT_ROOT_MISSING after browser lanes
succeed. Same-name reports were merged into .artifacts/aria while both visual
and traceability validators require playwright/aria-<lane> roots.

The workflow now downloads each exact lane/SHA/run-attempt artifact directly
into its canonical root, without a wildcard or merge. The governance guard
requires all four unique exact downloads and rejects missing lane, stale SHA,
merge and duplicate lane. Causal RED: 1 failed / 29 passed. Final governance
suite: 34 passed. Initial unit configuration excluded governance tests; that
zero-test invocation is not a product RED. The unchanged old guard initially
refused the new layout; the guard was strengthened to the corrected contract.
Dynamic imports preserve the governance CommonJS runtime without lint bypass.
Remote artifact materialization still requires a fresh exact-head CI run.
No private trace upload or retention policy changed. NOT_READY.
