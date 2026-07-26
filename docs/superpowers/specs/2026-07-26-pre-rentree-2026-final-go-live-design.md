# Pré-rentrée 2026 Final Go-Live Design

## Date

2026-07-26, Africa/Tunis.

## Goal

Promote the Stage candidate from PR #79 to a uniquely bound, verifiable
production release after integrating PR #82, without changing the Bilan
territory and without hiding the raw supply-chain findings.

## Baseline

- Product PR: #79, head `d857160381b26b82ff52901cbdc8d8062975cbba`.
- CI evidence PR: #82, head
  `88d1c570805b8399eca32e0a811065beedea9420`.
- `origin/main`: `a0db57a7bc4db25b8d163d92c2ed3e95b65da961`.
- Campaign version: `2.1.0`.
- Owner-approved campaign manifest checksum:
  `93f29e08c6f0294f8ecee443896d12646ba3fa6d598218bebbc0cc22679fa219`.
- Raw production npm audit: zero high/critical.
- Raw complete npm audit: 36 high, zero critical, all caused by
  `GHSA-mh99-v99m-4gvg` on development tooling.

## Approaches considered

### Official dependency update

Compatible updates of the current lockfile, Jest 30, ESLint 9 with the latest
Next 15 lint configuration, and CycloneDX removal were measured independently
and in combination. No compatible combination removes the vulnerable 1.x and
2.x `brace-expansion` lines. ESLint 10 is outside the peer range supported by
Next 15 and is not accepted for this release.

This remains the preferred remediation when upstream backports become
available, but it cannot close the current release.

### Global override or forced audit fix

A global override to `brace-expansion@5` and `npm audit fix --force` would move
old consumers across incompatible majors. Lowering the audit threshold or
turning the job into a warning would hide the failure. These options are
rejected.

### Exact, time-bound development-tooling exception

The selected design keeps both raw audits and OSV output visible. A small
validator accepts only the one owner-authorized advisory when all of these are
true:

- the production audit is clean;
- the complete audit contains no other high or critical advisory;
- exact package, range and installed paths match the release evidence;
- runtime artifact and runtime SBOM do not contain the package;
- the owner decision and evidence checksums match;
- the exception is not expired;
- a remediation issue exists;
- the Stage and CI evidence SHA bindings match.

Any mismatch, new advisory, runtime reachability, changed SHA or expiration
fails the check.

## Security architecture

Private owner inputs remain outside Git with mode `0600`. Git receives only a
redacted exception record and evidence summaries that contain no signature,
secret or private topology. The record stores the SHA-256 of the private owner
decision and the public evidence files.

`Dependency Integrity` performs:

1. reproducible install and npm tree validation;
2. raw production audit;
3. raw complete audit captured as an artifact;
4. runtime SBOM generation;
5. exact exception validation if, and only if, the raw complete audit is red;
6. failure for any uncovered finding.

`Security Scan` retains Semgrep and raw OSV output, then applies the same exact
exception policy to OSV. The final aggregator still requires every job to
return `success`.

## Product qualification

The existing canonical sources remain unchanged unless a blocking test proves a
regression:

- `data/campaigns/pre-rentree-2026.json`;
- `content/pre-rentree-2026/modules.json`;
- `data/pricing.canonical.json` through `lib/pricing.ts`;
- the public DTO in `lib/campaigns/pre-rentree-2026/public-surface.ts`.

Qualification must prove 14 modules, 70 templates, 17 cohorts, 85 occurrences,
five sessions and ten hours per subject, at most four subjects, no Seconde
Physique-Chimie, no actionable conflict or long idle, seven public PDFs, and an
unchanged approved campaign checksum.

## Release sequence

1. Qualify and update PR #82 with the strict exception mechanism.
2. Obtain all #82 checks green.
3. Merge #82 into the release branch behind PR #79 without force push.
4. Re-run complete qualification on the new #79 head.
5. Establish private runbook, rollback and pre-deploy health evidence.
6. Bind campaign and security decisions to the resulting SHA.
7. Create a metadata-only `PUBLIC_READY` and GO commit.
8. Obtain all required checks green and required review state.
9. Merge #79 to `main` using the repository-supported traceable strategy.
10. Deploy the exact resulting `main` SHA and verify the served SHA.

## Failure and rollback

No merge occurs without private deployment and rollback evidence. A critical
production smoke failure restores the previously served healthy release without
rewriting `main`. The Stage release report records both the merged SHA and the
served SHA.

## Bilan boundary

All Bilan paths, Bilan clones, Prisma changes for Bilan and Bilan private inputs
remain untouched. A path guard runs before every commit and final push.
