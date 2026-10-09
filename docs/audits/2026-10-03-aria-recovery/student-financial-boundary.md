# Student dashboard financial boundary

Date: 2026-10-04. Parent financial ownership remains a separate open qualification gate.

An invoice beneficiary identifies an academic recipient, not an authorized financial reader. The student dashboard and ARIA cockpit shared builder previously queried invoices by beneficiary, projecting amounts, PDF URLs and unsupported student invoice links, including drafts.

Acceptance: no invoice query or financial projection for students, irrespective of DRAFT/SENT/PAID state; preserve educational resources and the existing Hub response shape with empty financial categories. Parent and staff invoice endpoints are unchanged.

Three regression cases failed on the actual invoice query before correction (21 existing tests passed). Removing the query and financial Hub construction yields 24/24 builder cases. Builder, dashboard payload/permissions and cockpit route suites together: 4 suites, 77 tests passed. Full typecheck, changed-file lint and diff check passed. This is not complete student dashboard, family finance, browser or production qualification.

Rollback: revert this isolated application commit through normal protected review; no schema or data changes. Reintroduction requires an explicitly authorized student financial capability, not beneficiary identity alone.
