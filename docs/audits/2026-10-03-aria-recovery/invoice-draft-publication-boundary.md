# Invoice DRAFT publication boundary

## Defect and acceptance

Five new unit cases failed on the inherited implementation: a matching parent session and a valid external capability token could read a DRAFT PDF; published PDFs also advertised one-hour private caching without a no-referrer boundary. The fix must deny DRAFT and unknown statuses externally without loading PDF bytes or exposing financial state. Authorized staff retains private draft preview. No invoice data or PDF is rewritten.

## Correction

A closed published-status predicate accepts SENT, PAID and CANCELLED historical archives only. Parent scope excludes DRAFT; PDF and receipt controllers apply an additional publication guard. External token PDF lookup selects status and refuses unpublished records. PDFs and receipts use private/no-store and no-referrer. Staff preview is explicitly preserved.

Neighboring fixtures now explicitly describe published invoices instead of omitting status. All original role/ID/token assertions remain. The obsolete pure no-leak test copied production code and disagreed with the canonical staff policy; it now imports the actual helper and actual fresh 404 response. Denied unknown roles remain denied; the canonical ADMIN/ASSISTANTE staff scope is tested.

## Evidence

Five initial unit failures reproduced the defect. Disposable PostgreSQL suite: three tests passed using a real persisted CSPRNG token, real invoice/parent/email authority and real lookup predicates. DRAFT reads never call the byte reader; after explicit fixture publication the same token reads. Byte storage is mocked in this boundary suite: it does not qualify PDF rendering, filesystem downloads, issuance transitions or business retention.

Targeted unit neighbors: five suites, 52 tests passed. Strict typecheck and changed-file lint passed; redacted secret scans and diff whitespace checks passed. No migrations, production access, actual payment or message send.

## Remaining P1

This lot does not resolve stale parentId financial authority or customerEmail-only grants. Explicit payer identity, canonical family roster, immutable financial emission, legal issuer defaults and student-dashboard financial isolation remain separate qualification work. A valid server-generated bearer link is a separate capability; this lot closes its draft exposure, not all token lifecycle/privacy concerns.

## Rollback

Forward correction only: restoring public draft reads is unsafe. No destructive migration or original invoice/PDF mutation.
