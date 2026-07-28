/** Client-safe navigation contract for the public Pré-rentrée campaign. */
export const PRE_RENTREE_2026_NAVIGATION = {
  campaignId: 'pre-rentree-2026',
  path: '/stages/pre-rentree-2026',
  label: 'Pré-rentrée 2026',
} as const;

/**
 * Whether the campaign gets its own entry in the permanent site navigation
 * (CorporateNavbar "Programmes" menu), as opposed to being reachable only via
 * its dedicated page and the homepage spotlight banner.
 *
 * Currently `false` by deliberate, tested decision: d67b3de37 "fix(release):
 * close campaign leaks before owner go" (2026-07-23) removed an earlier navbar
 * entry and added __tests__/components/corporate-navbar.test.tsx's
 * "does not expose the gated Pré-rentrée campaign from permanent navigation"
 * to lock that in. The 2026-07-26 owner release scope
 * (content/pre-rentree-2026/publication-decisions.owner.json) does not
 * mention restoring it — this flag has not been revisited since. Flipping it
 * to `true` is the entire diff needed to re-enable the navbar entry; it does
 * not require re-reading this file's history again.
 */
export const SHOW_PRE_RENTREE_IN_PERMANENT_NAV = false;
