# Account email handoff envelope contract

October 4, 2026. New pure utility, not yet connected to account issuance.
The durable Core handoff P1 remains open until transaction/worker integration.

`account-email-handoff/v1` seals the bounded recipient/display/proof/purpose
content with AES-256-GCM, a fresh 12-byte CSPRNG nonce and 16-byte authentication
tag. A purpose-separated HMAC derives the encryption key from the server mail
secret; it is not a password verifier. Authenticated metadata binds schema,
key version and durable issuance ID, preventing envelope substitution between
jobs. The proof and recipient never appear in clear envelope metadata. Malformed
content, unknown format/key, tampering and wrong issuance produce constant errors.

Without an explicit keyring, the existing EMAIL_OUTBOX_ENCRYPTION_KEY is used
under key version v1. Optional ACCOUNT_EMAIL_HANDOFF_ENCRYPTION_CURRENT_KEY_ID
and ACCOUNT_EMAIL_HANDOFF_ENCRYPTION_KEYS must be configured together; partial
configuration fails closed. Rotation adds a fresh active key and retains old
version mappings while their envelopes need to be read. No implicit fallback
occurs after explicit keyring configuration. Actual production randomness,
custody, masked configuration and rotation exercises remain operator gates; a
minimum length check does not prove entropy. No production value is created,
printed or copied by this implementation.

The new module initially failed its test import because it did not exist; this
is not counted as a causal reproduction of the account-loss defect. The separate
four PostgreSQL RED tests reproduce that defect. After implementation, six pure
tests passed, covering secrecy, nonce uniqueness, authenticated binding,
tampering/unsupported format, retained-key rotation and fail-closed configuration.
Targeted lint and typecheck passed. Assertions emit booleans/key IDs, never a
proof, recipient or key. No provider/DB operation is performed by this utility.

This is a contract slice, not full notification qualification or CodeQL closure.
Use only server-side runtime; no client import, plaintext persistence or logging
is permitted. Status NOT_READY, PR Draft.
