/**
 * Fixture only — never imported by the real preview or by any production
 * code. Exists solely so a test can prove the architecture guard in
 * `aria-preview-no-runtime-imports.test.ts` resolves a RELATIVE specifier to
 * its absolute repo path before checking forbidden-ness, not just
 * `@/`-prefixed ones.
 *
 * Unlike `lib/aria/rag.ts` (itself listed in FORBIDDEN_EXACT_FILES, so the
 * walker flags it on arrival before ever resolving its own imports), this
 * stub is NOT forbidden itself — the walker must actually follow this
 * relative import and resolve it to the real file to catch it.
 */
export { getAriaRagCorpusCapability } from '../../../lib/aria/infrastructure/rag/manifest';
