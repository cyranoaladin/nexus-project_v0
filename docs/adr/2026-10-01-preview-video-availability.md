# Explicit video availability for the private C2 Preview

## Date

2026-10-01

## Decision

The Preview delivery builder requires one explicit `NEXT_PUBLIC_VIDEO_MODE` value: `DISABLED` or `JITSI`. This C2 Preview delivery is `DISABLED` because no authorized Jitsi installation or delivery URL has been established. An absent mode retains the pre-existing JITSI behavior for other deployments; an unknown or empty explicit value is refused.

`DISABLED` needs neither `NEXT_PUBLIC_JITSI_SERVER_URL` nor `JITSI_ROOM_SECRET`. A Jitsi URL supplied to the disabled builder/runtime is rejected, while an existing unused room secret need not be rotated. The client shows “Visioconférence intégrée non activée sur cette Preview.” and does not offer a join action, load `external_api.js`, create an iframe, or request camera/microphone for this component. Authenticated API requests still pass rate limiting, identity, ownership and join-window checks, then return `503` with `error=VIDEO_DISABLED`, before room generation or booking mutation. Reservations, planning and unrelated microphone recording remain available.

`JITSI` delivery requires a dedicated authorized HTTPS origin and room secret. No public fallback or example domain is accepted by the delivery builder. Existing access and time-window checks remain in force. Client/Edge-safe mode parsing is shared; the release manifest records the explicit built mode and, for `JITSI`, the public origin compiled at build. Standalone startup compares both with runtime configuration before readiness. `NEXT_PUBLIC_*` settings are compiled into the client: changing only a service environment variable cannot switch the delivered UI.

## Security headers

`DISABLED` has no Jitsi script, frame, WebSocket or delegated media origin. Same-origin microphone permission remains for the independent diagnostic recorder. Explicit `JITSI` uses its validated origin. The absent-mode legacy CSP remains unchanged for compatibility.

## Delivery and rollback

The builder attests source SHA, workflow SHA, run/attempt, build ID, archive digest, mode and client/server configuration. A disabled Preview cutover must back up the stable private runtime config and release reference together, remove only the active test Jitsi URL while setting the mode, then verify the new release. Rollback restores the old release **and** its old runtime config; it never restores an old database over audit or provider spend. No change to public production or remote Jitsi is part of this decision.

## Limits

This mode does not remove Jitsi from the product, qualify a Jitsi server, or authorize public go-live. CI fixtures are not delivery addresses. A simulated Jitsi provider test does not prove audio/video service quality.
