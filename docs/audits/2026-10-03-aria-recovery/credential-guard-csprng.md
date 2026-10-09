# Credential guard: preserve complete CSPRNG expressions

2026-10-04. Published da88a33dbaa69778a8c18bcd189999ef9fee7898 fails the
Lint job at Reject hardcoded canonical values, before ESLint. The scanner
truncated randomBytes(32).toString('hex') at the encoding quote, then mistook
the partial expression for a literal credential. A deliberately short-key
negative fixture and two literal synthetic passwords were also flagged.

A causal test reproduces the legitimate expression refusal. The scanner now
captures the complete CSPRNG expression and rejects a quoted literal imitating
that expression. Existing placeholder/runtime policies remain; no path exclusion
or exception digest was added. Synthetic passwords and the short-key fixture
are generated at runtime. Scanner regression suite: 5 passed. Full canonical
check:no-hardcoded: zero findings. Targeted lint passed.

Combined proof 1791154649: restored synthetic V1 lane (11 tests), Core migration
23->24->25, interruption/replay/empty schema, 8 Core suites / 85 tests passed;
source identity remained stable and the owned temporary instance was stopped.
No provider or production data was used. This is not production qualification.
Remote CI must confirm the corrected source. NOT_READY.
