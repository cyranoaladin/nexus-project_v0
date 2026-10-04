# Required real destination and antivirus infrastructure in Core CI

2026-10-05. Core Foundation previously referenced a legacy shadow database that
the job never created. Durable account handoff tests now exercise a real V1
destination, so the job creates and migrates a distinct disposable database on
the pinned pgvector service. Core migration and target-collision guards remain.
The rehearsal selector also includes the real Core-only revocation HTTP suite.

Three ClamAV tests previously skipped when infrastructure was missing. They now
require an explicit daemon and synthetic storage root and fail on missing
configuration. CI provisions the pinned ClamAV image and private runner-temporary
storage. Local native INSTREAM qualification against the existing local daemon:
3 passed / 0 skipped, harmless file, official EICAR detection, unavailable engine
refusal. No daemon configuration or real upload was modified. This is not evidence
of production deployment or image vulnerability clearance.

Governance assertions were red before the CI contract correction, then 35 passed
with the governance configuration. An attempted unit-config invocation found no
tests because governance suites are deliberately excluded there; it is not a pass.
An invocation without the canonical experimental-vm-modules setting also failed
at dynamic import initialization; the corrected command uses the setting from
npm run test:governance rather than changing the tests.
Typecheck passed. No lockfile, production database or schema change in this lot.
