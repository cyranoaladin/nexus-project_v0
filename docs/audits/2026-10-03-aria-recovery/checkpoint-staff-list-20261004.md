# Private staff-list checkpoint

Source `1e0d18ef62aceeda275f2b85faacb6da8cdf0220`: 164 total PR commits / 554 changed files from main; 85 commits after the accepted initial `aad516f5c87b2eff84479af406a6fcb938f79051` checkpoint. Remote head is `6083b3fa0e32643b46d4f1b5a4a652828adbc665` with one unpublished source commit before this documentation commit. The subsequent documentation commit is additional to these counts.

Four suites / 46 targeted tests, two PostgreSQL suites / seven tests, targeted lint, final typecheck, diff-check and staged secret scan passed. The PostgreSQL run restored only an encrypted synthetic old-schema fixture; it does not close the production backup gate. New unit cases first failed 15/15 against the old GET behavior. The complete permission/pagination contract and read-only reviewer observations are recorded in staff-reservation-list.md.

Current published CodeQL has only HIGH #114 open; four MEDIUM alerts are absent after causal source fixes, without dismissal. CI on the published head is still nonterminal and Dependency Integrity remains red. No production operation, provider delivery, payment or deployment occurred. Original frozen roots and private forensic evidence were not edited by this lot. Status NOT_READY; Draft retained.
