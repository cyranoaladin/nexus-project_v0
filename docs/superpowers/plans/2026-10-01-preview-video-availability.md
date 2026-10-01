# Preview video availability for C2 qualification

## Decision and scope

The next private Preview is explicitly built in `DISABLED` mode. `JITSI` remains the existing production-capable mode; absence of the new mode retains that legacy behavior. An unknown mode fails closed. This change does not qualify a Jitsi server or authorize public go-live.

## Implementation sequence

1. Add a pure, client/Edge/server-safe video-mode contract and red tests for absent, `DISABLED`, `JITSI`, and unknown modes. Make Jitsi URL and room-secret requirements conditional, preserving all unrelated environment checks.
2. Add red tests for the session GET/POST and video page. After authentication and ownership, `DISABLED` returns an explicit unavailable response before room generation or booking updates. The page and entry points show the unavailable message, with no Jitsi loader or automatic join.
3. Add red tests for CSP and Permissions-Policy. Remove Jitsi-specific external grants in `DISABLED`, preserve independent microphone use, and retain narrowly scoped Jitsi grants in `JITSI`.
4. Make the dispatch mode explicit, reject ambiguous combinations, and propagate the built mode through the client, standalone verification, release manifest, and provenance. Keep source SHA, GitGuardian, PDF.js, archive integrity, and secret gates unchanged.
5. Run targeted tests, lint/typecheck, and available architecture checks locally. Run full production build and hermetic standalone/browser checks on CI because this machine is not an approved heavy-build target. Preserve both-mode tests and negative cases.
6. Open one focused PR, await green CI and fresh review by `@abenrhouma`, then only if applicable merge under protection and qualify post-merge. Dispatch delivery only after these gates; measure local capacity before downloading and performing isolated DB/storage rehearsals. Cut over Preview with coherent runtime config and rollback; resume only the existing synthetic C2 v5, at most one provider call, stopping at DRAFT.

## Safety invariants

- Never touch remote production or RAG, never create v6, and never activate ARIA Core v2.
- No default `meet.jit.si` in production and no fake Jitsi URL in the disabled build.
- A disabled GET/POST cannot mint a room, token, or change a booking.
- Build mode, client mode, runtime mode, and release manifest must agree before serving.
- Preserve the old release *and its prior runtime configuration* for rollback; never restore an old database over new audit or spend.
