# Financial review lot, 4 October 2026

## Scope and exact counts
Source `7350f700564222c6be884f81ba4dd1246a81fb1d`: 116 total commits against verified main; 37 created after starting HEAD aad516f5c (79 prior commits, including the original ten unpublished commits now preserved and published). Two unpushed permission commits, 14 files in that unpublished lot. Remote `006cc1cf1`: REST PR count 114 commits, 389 changed files, Draft. These are distinct scopes; counts exclude this forthcoming documentation commit.

Full source path classification: [file map](pr-scope-file-map.json), 402 paths. This path classification does not mean every diff has completed hostile review. Financial high-risk paths: invoice authority/guard/download/audit, queue service/outbox, parent projections, subscription requester relation, payment validation, schema/migrations and RBAC policy. No commercial prices or role grants changed in the last lot.

## Evidence
Defect → correction → test → commit is linked in [capability matrix](capabilities.md), [request ownership](subscription-request-owner.md), [payment permission](payment-write-permission.md) and [invoice permission](invoice-write-permission.md). SQL paths/order/digests/introducing commit are listed in [migration fingerprints](pr-migration-fingerprints.json). These two permission commits introduce no migrations. Earlier owner migration is additive but its large-table lock/duration still needs staging proof.

## Unclosed gates
CodeQL #101 high is open on exact remote HEAD. The dev dependency exception no longer matches the lockfile; no policy owner approval has been fabricated. Chromium private-stream native ERR_ABORTED remains reproduced independently; no business requestfailed event is ignored without the pending bounded policy decision. Latest CI is running, not green. TLS rotation/revocation, approved retention, actual encrypted backup restore, staging rollback, required human review and production runbook access remain unproven. No deployment or Draft exit.

## Preservation and terminals
No source/index writer was found by /proc writable-FD inspection on this lot. Existing fixture worker and immutable diagnostic Next server have only recovery log writable descriptors and remain relevant to browser investigation; they serve an older diagnostic artefact and are not evidence of this source HEAD. No frozen tree or old private evidence was edited. No frozen hashes were freshly recomputed in this lot, so historical preservation hashes are not represented as new observations. Three newly owned loopback/tmpfs rehearsal instances were stopped after checks; no persistent database/volume was removed. Disk remains below the 55-GiB target; heavy campaigns use remote CI.
