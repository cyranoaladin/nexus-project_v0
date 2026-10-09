# Payment write permission boundary

## Date
2026-10-04, Africa/Tunis.

## Cause and policy
Canonical `lib/rbac.ts` grants ASSISTANTE only PAYMENT READ. The validation API bypassed this with an ADMIN/ASSISTANTE role allowlist. Apply the existing restrictive policy, not a new permissive grant. ADMIN retains MANAGE; no role definitions change.

## Correction
Require canonical session ID (401 if missing), then PAYMENT UPDATE (403 if absent) before reading a payment or starting a transaction. Preserve all existing payment, ownership, catalog, idempotency and transition checks. The staff page uses the same permission to show mutation controls and guard its handler; read-only staff see a consultation label.

## Tests
Red: five authorization cases fail and 23 existing cases pass. Green: 28 API cases pass; positive financial mutation fixtures use authorized ADMIN. Two React UI cases pass: ASSISTANTE consultation without mutation buttons and ADMIN with validation/rejection controls. No timeout or assertion weakening. Typecheck and targeted production/UI lint pass.

## Limits
UI tests initially failed because the synthetic SessionRecoveryProvider mock omitted the button’s session-suspension hook; supplying the documented hook fixed the harness. No visual browser qualification, actual provider payment or production mutation was performed. Invoice mutations still need a separate corresponding permission correction. Finance audit completeness and global go-live gates remain unqualified.
