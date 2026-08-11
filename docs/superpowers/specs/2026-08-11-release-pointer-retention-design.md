# Canonical Release Pointer and Retention Design

## Date

2026-08-11

## Context

Production has one pointer consumed by the process launcher and a second
compatibility pointer historically used by operators. Two independently
mutable pointers can diverge even when both happen to resolve to the same
release at a given instant.

The public repository must not contain concrete infrastructure paths. Exact
topology, release inventory and operational evidence therefore belong in a
private root-only runbook.

## Decision

`<CANONICAL_POINTER>` is the only mutable release pointer.
`<COMPAT_ALIAS>` remains available, but its raw symlink target is
`<CANONICAL_POINTER>` rather than a release directory. It therefore follows
every future cutover automatically and cannot independently select another
release.

The public repository provides a read-only, parameterized guard. The private
runbook supplies the concrete paths and invokes the guard before and after a
process reload.

## Guard contract

The guard fails closed unless all of the following are true:

1. the canonical pointer and compatibility alias are symlinks;
2. the alias raw target is exactly the canonical pointer;
3. both resolve to the same existing directory below `<RELEASE_ROOT>`;
4. the resolved release contains the expected standalone server entry point;
5. when an expected release is supplied, it matches the resolved directory.

It is read-only and accepts every topology value through arguments. No real
host, process name or server path is embedded in the repository.

## Deployment sequence

1. Build and validate a new immutable release directory.
2. Atomically switch `<CANONICAL_POINTER>` using a temporary symlink and
   rename.
3. Run the pointer guard. A failure stops the deployment before reload.
4. Reload the process using the private launcher.
5. Prove pointer, process metadata and `/proc` resolve to the same release.
6. Run the pointer guard again and complete the application smoke checks.

`<COMPAT_ALIAS>` is never switched during deployment because it follows the
canonical pointer by construction.

## Retention policy

- Always retain the active release.
- Retain the two most recent prior distinct release SHAs compatible with the
  supported embedded Node runtime.
- Duplicate builds of the same SHA do not consume rollback slots.
- A release containing runtime data without a verified durable copy is
  retention-blocked regardless of age or runtime compatibility.
- Removal requires a concrete candidate list, proof that no pointer or process
  references a candidate, a runtime-data scan, a database-reference check and
  explicit human approval.
- This design performs no release deletion.

## Runtime-data exception

The audited inventory contains one historical release with the only known copy
of an invoice-like PDF. The file must be copied to durable root-only storage,
checksummed and kept in the private inventory. The source remains untouched.
This protective copy never lifts a permanent release-retention block: a release
declared permanently retained remains outside every removal candidate list.

The separate mismatch between the configured document root and the directory
holding existing documents is recorded but deliberately not corrected here.

## Security and rollback

The repository documentation uses placeholders only and remains subject to the
public-infrastructure security scan. Exact evidence is stored outside Git with
mode `0600` and root ownership.

Changing the compatibility alias to point at the canonical pointer does not
change the resolved active release and requires no process reload. If the
atomic rename fails, the previous alias remains intact.
