# Golden invitation distinguishes queuing from delivery

2026-10-05. Remote da88a33d cross-browser artifact 11317398325 reports 78 passed
and 2 failed, both full staff golden cases on Firefox/WebKit. Sanitized reports
withhold the private failed assertion details; the exact observed failing phase
is therefore not claimed.

Source review proves a stale assertion: the UI truthfully reports an invitation
queued by the durable handoff, while the golden test expected immediate delivery.
The assertion now requires the exact queued status. The next step still waits
for the actual Mailpit activation message, then activates and exercises the
account. No SMTP receipt, activation, ownership or replay assertion was removed.
No sleep, timeout increase or browser exclusion was added. Component tests:
2 suites / 6 passed. A new exact-SHA browser campaign is required; this document
does not declare the browser failure resolved before that campaign completes.
