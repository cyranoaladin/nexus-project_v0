# ROUTE_DIFF

## Added V2 Security/Form coverage

### New E2E specs
- `e2e/forms-validation.contract.spec.ts`
  - `/bilan-gratuit` validation + submit behavior
  - `/contact` validation + success/error handling
  - `/auth/signin` password visibility toggle
- `e2e/security.advanced.spec.ts`
  - `/api/documents/:id` unauthenticated and ownership checks
  - `/api/sessions/cancel` cross-student cancellation protection
  - `/api/invoices/:id/pdf` no-leak 404 behavior
  - Path traversal guard check on `/api/documents/:id`
  - Security header check on document download response
  - Robots noindex check on `/dashboard/admin`

### New unit spec
- `__tests__/security/jwt-escalation.test.ts`
  - Tampered JWT payload (role escalation) is rejected by signature verification.

### Security middleware hardening
- `middleware.ts`
  - Apply global security headers from `lib/security-headers`
  - Add `X-Robots-Tag: noindex, nofollow, noarchive` on `/dashboard*`

### Test instrumentation additions
- `e2e/selectors.ts`: expanded selector inventory for V2 scenarios.
- Added `data-testid` attributes to:
  - `app/bilan-gratuit/page.tsx`
  - `app/auth/signin/page.tsx`
  - `components/sections/contact-section.tsx`
