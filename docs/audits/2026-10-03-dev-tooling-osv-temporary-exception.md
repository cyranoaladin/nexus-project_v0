# Temporary OSV exception for development tooling

## Date and scope

2026-10-03. This decision covers exactly two new OSV findings in the unchanged
`package-lock.json` (SHA-256
`b5aaa205c437a091b6487ca6f1f131d0697bb9c79ae988d6736e759880dea29a`):

| Advisory | Package | Version | Physical lock path | Direct parent |
| --- | --- | --- | --- | --- |
| GHSA-vfj7-8cjw-p6xm | braces | 3.0.3 | `node_modules/braces` | `node_modules/micromatch` |
| GHSA-ch52-4w7c-c8xp | http-cache-semantics | 4.2.0 | `node_modules/http-cache-semantics` | `node_modules/make-fetch-happen` |

Both locked entries and their direct parents are marked `dev: true`. The
[GitHub braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
and [GitHub http-cache-semantics advisory](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)
reported no patched version at 2026-10-03T05:32:53Z. At that time, the npm
registry reported latest versions 3.0.3 and 4.2.0 respectively. This is not a
claim that the packages are safe; it is a temporary, bounded exception pending
upstream remediation in [issue #335](https://github.com/cyranoaladin/nexus-project_v0/issues/335).

## Decision and compensating controls

The exception expires at **2026-10-10T00:00:00Z**, no more than seven days after
its start. OSV still executes normally. If OSV reports any vulnerability, the
Security Scan accepts it only when the exact advisory, package, version, HIGH
severity, locked path, parent path, and lockfile digest match the policy.
The observed CVSS v3/v4 vectors are pinned as well. If OSV exits zero, its
JSON report must be present, valid, and free of findings; this normal path
does not consume an exception or download build evidence.

The same Security Scan waits for successful Dependency Integrity and Production
Build jobs from its **own run**. It downloads their actual evidence and checks
all three independent absence claims before accepting the exception:

1. the installed npm production dependency tree contains neither package;
2. the generated runtime CycloneDX SBOM contains neither package;
3. the built standalone artifact contains neither package physically.

The production npm audit must also report zero vulnerabilities; the standalone
manifest must match the checked source SHA, lockfile digest, and BUILD_ID. A
missing job, report, artifact, or malformed input is a failure. A scanner error
is not an exception. The OSV JSON is retained as a CI artifact.
The Dependency Integrity job first validates installed-tree anomalies with
the existing exact `npm-tree-exceptions.json`; optional native packages already
covered there are not silently reclassified as vulnerabilities by this policy.

## Revocation

Revoke immediately on a new advisory, runtime presence, production dependency,
changed dependency path/version/integrity, severity escalation, failed
compensating control, or expiry. A supported upstream fix should replace this
exception as soon as it is available. No `npm audit fix --force`, scanner
suppression, broad override, or live environment change is authorized here.

## Verification and limits

The original failed Security Scan on PR #334 remains evidence of the finding.
This PR's tests inject each failure mode, including runtime presence and
expiry. The positive physical-artifact proof is supplied by the PR's own CI
run—not by a synthetic fixture or by a historical artifact. A green PR CI does
not itself change the Preview, production, or the live ruleset.
