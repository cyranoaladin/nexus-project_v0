# Register the pinned mandatory ClamAV image

2026-10-05. Full local unit run: 1,337 passed / 2 failed suites; 14,859 passed /
4 failed tests; seven snapshots passed. Three failures were the image authority
guard: the new ClamAV service referenced a digest missing from the canonical
registry. Isolated reproduction confirmed those three failures.

The registry now includes the exact official image digest already used by CI,
observed local RepoTag 1.4.6 and linux/amd64 architecture, REQUIRED_CI purpose.
No mutable executable reference or image-authority assertion was introduced or
weakened. Native daemon tests previously passed all three synthetic scenarios.

Isolated rerun after registration: 2 suites / 27 tests passed, including the
unchanged LaTeX compilation suite. The full run's one LaTeX failure did not
reproduce in isolation. Its specific causal diagnostic was not retained by the
aggregate-only harness; it is not classified as fixed or flaky. A complete new
exact-SHA CI run and, if needed, a diagnostic repetition remain required.
No timeout increase, skip, PDF assertion removal or production operation.
