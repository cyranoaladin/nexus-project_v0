# Planning public session bundle synchronisation

Date: 2026-10-04. Remote source SHA: `7e59831b1a47dad91a5b46cb4d87bd31809e3e13`; job 111444840175.

The canonical planning integrity gate passes, then `npm run planning:check` fails: regenerated `public/planning/assets/session-recovery.js` differs by 19 lines after the canonical controller navigation-claim change. The missing generated update is the cause; no planning validation or assertion is relaxed.

Before invoking the repository generator, its code and exact target were inspected. All 15 files in public/planning are the documented reproducible outputs; no untracked/unique file is present. A private pre-build hash manifest preserves their identities. The canonical check reproduces exit 1 and changes only the session-recovery bundle. Regeneration keeps the React and static planning controller identical; no hand-edited generated logic or alternative implementation is introduced. The generator replaces its verified output directory with those same 15 outputs; no cache, frozen worktree, evidence, upload, database, secret or other directory was removed.

Canonical planning:gate, planning:test, planning:test:unit and the static-session-recovery DOM tests pass. The generated output must be committed and planning:check repeated. Remote green remains required on the next SHA. Rollback follows a reviewed application revert with its matching regenerated bundle, never an independently stale public controller.
