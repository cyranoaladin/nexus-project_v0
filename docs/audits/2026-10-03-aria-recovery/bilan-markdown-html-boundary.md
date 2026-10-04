# Untrusted HTML in pedagogical Markdown

October 4, 2026; preceding published source
`28b692f60d99fc46522e6ef04bf612217f8f05d5`.

The result page's Markdown conversion preserved source HTML before a
`dangerouslySetInnerHTML` sink. Tests reproduced script, image event handlers,
SVG, iframe and table-cell markup becoming active DOM elements: five failures.
A sixth failure reproduced entity-like input being decoded instead of displayed
literally. This demonstrates an unsafe rendering boundary, not a production
exploit or an observed client-data breach.

The existing formatter is extracted into `lib/bilan/render-markdown.ts`; source
ampersands and angle brackets are encoded before static markup is generated.
Raw HTML is not part of the supported pedagogical Markdown contract. Headings,
tables, lists and emphasis retain generated markup. The identity replacement
flagged by CodeQL #16 is removed because it substituted an empty string for an
empty match and had no rendering effect; the actual HTML boundary is corrected.

Seven DOM tests pass; targeted lint passes. No scanner alert is dismissed, and
remote CodeQL must qualify the new commit. Access authority and publication
qualification of this route remain separate review obligations. No migration,
production action or real document was used.
