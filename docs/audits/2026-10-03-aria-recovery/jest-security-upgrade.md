# Targeted Jest and HTTP cache tooling security update

## Why an update is necessary

Dependency Integrity on df266cc1fe1a0d86f1ab6a285a0019c2fb65c44f failed
AUDIT_IMPACT_SET_CHANGED: the exact human-approved temporary policy expected
39 impacted packages, while the current npm advisory graph reported 34.
Security Scan then lacked qualified upstream evidence. No policy, scanner,
coverage threshold or exception expiry was relaxed.

Jest 29's matcher chain pulled vulnerable braces through micromatch. The
maintainer's current Jest 30 removes that chain. This commit pins Jest and its
JSDOM environment to 30.5.2 and Jest types to 30.0.0; http-cache-semantics is
updated within its existing range from 4.2.0 to 4.3.0. The lockfile records only
the necessary runner/environment graph and this cache fix, rather than a Next,
React, Prisma or general framework upgrade. Install/update used --ignore-scripts.

## Compatibility work and preserved assertions

Jest 30 renamed testPathPattern to testPathPatterns: four package scripts and
three real-database CI selectors are ported without changing their selections.
JSDOM 26 owns a non-configurable Location; the old global replacement is removed.
The campaign fixture changes pathname through history.replaceState. Three
full-document navigation consumers delegate their existing href assignment or
reload to a two-function native boundary. Their destination/reload assertions
remain, and two independent node-environment tests verify the actual native
writes and reload call. The typed motion fixture also removes its pre-existing
require/display-name lint errors and any annotations.

Jest normalizes fs/promises and node:fs/promises to one module: the recursive
alias mock is removed. The encrypted-storage suite now uses actual filesystem
writes in its own mkdtemp root, reads the actual bytes, retains encryption and
plaintext-absence assertions, and cleans only its own root. It no longer relies
on a mock accidentally not intercepting source imports or a shared temp path.

The only three snapshot changes are their generated documentation header URL.
Rendered snapshot bodies were inspected and remain identical; no update command
or blind snapshot acceptance was used.

## Evidence and scope

Initial full run: 1281 passing and 6 failing suites, 14388 passing and 5 failing
tests; the resource mock recursion prevented one suite from collecting its tests.
After compatibility fixes: 7 targeted suites / 53 tests passed; full unit run
1288 suites / 14406 tests / 7 snapshots passed. Core v2 against the disposable
Postgres database: 75 suites / 749 tests passed. Typecheck and focused ESLint
passed. Read-only review found no new P0/P1 in this tooling lot.
The separate SSE drainage fix was developed while the long unit run was active;
that run is tooling compatibility evidence, not final exact-SHA qualification of
all subsequent changes. All final lanes must be renewed on the committed HEAD.

## Remaining security gate

A fresh full npm audit reports five HIGH impacted packages, all from the same
remaining ESLint chain: eslint-config-next → @next/eslint-plugin-next → fast-glob
→ micromatch → braces3.0.3 (GHSA-vfj7-8cjw-p6xm). A production-only audit reports
zero vulnerabilities. This is not proof that the standalone release excludes
the packages; official build/runtime evidence must establish that separately.
The registry/advisory currently provides no officially patched braces version.
The Next plugin's latest release still uses the vulnerable chain. No dishonest
override, disabling of lint, fake replacement or unilateral new exception was
introduced. The active exact policy remains unchanged and fails closed when its
graph changes. A narrower one-advisory/five-impact proposal remains unapproved;
human security authorization is required before activating it. Its expiry must
not exceed 2026-10-10T00:00:00Z.

## Rollback

Use a normal revert of this commit, with the old dependency findings restored and
security gates still mandatory. No schema or production migration changes.
