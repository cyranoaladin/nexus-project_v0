# PDF apostrophe normalization

October 4, 2026. CodeQL #64 flagged an identity replacement in the quote PDF
formatter: ASCII apostrophes were being replaced by identical characters, whereas
the adjacent contract described conversion of right typographic apostrophes.

A real PDF rendering/text-extraction test reproduced the missing normalization.
The formatter now matches U+2019, preserving ordinary apostrophes. Four targeted
suites pass, 22 tests total, including PDF adapters and the independent Markdown
boundary tests. Targeted lint and typecheck pass. No prices or commercial data
were changed. No generated PDF is committed, and no real client data was used.
The first RED assertion displayed the synthetic PDF and existing public commercial
footer; the assertion now reports only a boolean result to avoid document dumps.
Remote CodeQL must confirm the current alert's resolution on the published SHA.
