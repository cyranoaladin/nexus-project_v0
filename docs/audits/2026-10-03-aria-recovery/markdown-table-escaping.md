# Markdown table delimiter integrity

Date: 2026-10-04. CodeQL alerts #65 and #66 identify unescaped input backslashes before escaped table pipes. The two documentation generators share a single-pass literal encoder: each original backslash and pipe gets one prefix; generated escapes are not processed again. Newline handling in the site inventory is preserved. No source schema, migration or public page is modified.

Regression: six exact-output cases cover bare pipes, one/two/three preceding backslashes, Unicode and plain text. Four failed with the former encoder and all six pass with the corrected encoder. The schema generator executes successfully into a private reproducible smoke artifact. Typecheck and targeted ESLint pass. Site inventory retains three pre-existing unused-variable warnings; no suppression was added. Secret scan and diff-check pass. Remote CodeQL must still verify these alert instances on the next published SHA.
