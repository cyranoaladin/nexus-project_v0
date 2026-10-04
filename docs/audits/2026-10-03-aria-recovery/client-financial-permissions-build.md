# Client financial permission import boundary

## Date and causal failure
2026-10-04, Africa/Tunis. CI at 39e92fe786087d1730e4041f275d58aadb8fc86f fails both production builds. Import trace: financial client page → lib/rbac.ts → dynamic guards import → auth → Redis/logger/Node crypto and async_hooks. Introducing the client import caused this regression; unit/typecheck success did not detect it. Browser jobs cannot be treated as independent business regressions without their causal logs.

## Correction
Extract the fine-grained matrix, can and getPermissions into pure lib/rbac/permissions.ts. UserRole is imported as a type only, and existing enum-valued keys become equivalent literal property keys. Server lib/rbac.ts reexports the existing API and retains its route/ownership guards. Both financial client pages import the pure module. Invoice transition permission helper uses that same pure matrix. No role grant, exclusion or Webpack Node fallback is added. No duplicate authority.

## Verification
Architecture RED: three tests fail before correction. GREEN: 32 targeted suites, 509 tests pass, including existing complete RBAC suites, financial direct API denials and UI controls. Typecheck and targeted lint pass. Exact extracted matrix/function source equals the preceding section after enum-key normalization and trailing whitespace removal; canonical permissions are unchanged. Static AST guard rejects runtime/dynamic/require dependencies in the permission matrix and the server RBAC module in both financial client dependency closures.

## Gate
Production build and all browser campaigns must run on the new published SHA. The prior red CI is preserved and no build result is claimed locally. Remote CI is used to avoid a heavy build below the disk target. This regression blocks release until the new builds are green.
