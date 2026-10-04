# Test tooling without shell interpolation

October 4, 2026. CodeQL #70 and #50 reported working-directory input reaching
shell commands in two tests. These commands do not run in the product, but the
environment still should not be interpreted as shell syntax.

The Unicode guard now uses native directory enumeration for its documented
`directory/*.tsx` pattern. A RED test demonstrated that the old `find` invocation
contributed no stage components at all. The stronger assertion remains and the
full guard passes, without dropping its Unicode payload checks. Missing listed
historical paths retain their previous compatibility behavior; other I/O errors
are thrown instead of swallowed.

The bilan compilation test invokes Node and the local locked TypeScript executable
with an argument array, without npx or a shell. Compilation failures are no longer
accepted when generated Prisma imports are missing. Its legacy CommonJS imports
were replaced by a static filesystem import; no lint rule is disabled.

Two suites and 18 tests pass. Targeted lint and typecheck pass. Full `npm run lint`
passes with existing warnings; no warning budget is raised. Remote CodeQL still
must confirm closure on the subsequently published SHA; no alert is dismissed.
