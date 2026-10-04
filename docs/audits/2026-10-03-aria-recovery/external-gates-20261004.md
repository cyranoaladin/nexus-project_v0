# External gates: evidence requests ready for operators

2026-10-04. Application source under local qualification:
`326c73598`; published PR source: `81baf60b773e6d536386b4ad45c88dc5989415d8`.
Status: NOT_READY. These are requests, not approvals or completed exercises.
Technical qualification continues independently.

| Gate | Responsible role (individual to be assigned) | Required action and evidence | Deadline |
|---|---|---|---|
| Historical TLS compromise | Infrastructure/security owner | Confirm rotation date, replacement public-key fingerprint, issuer revocation status where applicable, and absence of the compromised key fingerprint from active listeners and dependent systems. Keep private-key material outside all reports. | Before any real-client pilot |
| Backup and restore | Infrastructure/data owner | Supply the official protected backup/restore mechanism; restore a recent encrypted DB/storage/configuration backup into an isolated environment, run business invariants, record observed RPO/RTO and restricted proof references. | Before pilot |
| Deployment and rollback | Release operator | Supply the current private runbook reference/fingerprint and authorized mechanism, rehearse immutable artifact switch and rollback in staging with the additive schema, record health/version evidence and cutoffs. | Before pilot |
| Retention and erasure | Legal/privacy and business owner | Approve category-specific purpose, duration, legal basis, subprocessors, backup expiry and erasure/anonymization rules; no guessed financial retention or irreversible erasure. | Before opening real-data collection |
| CodeQL #101 | Authorized security reviewer | Review the documented password-reset-to-outbox HMAC flow and narrowly scoped false-positive proposal, or require a substantive cryptographic correction. No automatic dismissal or broad exclusion. | Before review/pilot |
| Development advisory policy | Security tooling owner | Review exact braces advisory/version/path, verified production exclusion and absence of a compatible upstream fix; approve a bounded exception only if appropriate, including owner, expiry and follow-up. Existing stale digest is not approval. | Before CI qualification |
| Final SHA review | Protected-branch reviewer | Review high-risk domains and approve the exact fully green published SHA. Prior dismissed approval is invalid. | After final CI, before protected merge |

## Fresh public TLS observation

At `2026-10-04T17:41:17.785092+00:00`, standard certificate-chain and hostname
verification for `nexusreussite.academy` passed over TLS 1.3. Leaf DER SHA-256:
`c1abd210064a8612d05e808d75859c2911814f6a27f40bcc74641758511f68a9`.
Validity: 2026-09-05 17:30:59 UTC through 2026-12-04 17:30:58 UTC.
This public certificate fingerprint is not a key-rotation/revocation proof and
does not qualify any application release or private-data access.

## Deployment authority boundary

`DEPLOY_RUNBOOK.md` intentionally omits infrastructure identities and commands;
public deployment/backup scripts intentionally fail. Its historical private
runbook availability and rollback dry-run claims do not prove a current restore,
current authorization or current artifact rollback. Do not replace that mechanism
with guessed SSH commands or the historical PM2 topology. No production change
has been performed during this qualification.

## Secret handling

Operators provide configuration by variable name and protected evidence reference,
not values. Any necessary production DSN is entered locally via the authorized
masked ephemeral mechanism after non-secret gates pass; never in chat or commands.
