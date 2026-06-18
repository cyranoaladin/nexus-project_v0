# Public Front Go-Live Audit

## Date

2026-06-18

## Context

Audit and correction of the public front for Nexus Reussite, with focus on:

- `/`
- `/offres`
- `/recommandation`
- `/bilan-gratuit`
- `/stages`
- `/plateforme-aria`
- `/accompagnement-scolaire`
- `/contact`

The work was performed in read-only production audit mode first, then corrected locally in the repository.

## Initial Audit Findings

- Production responded `200` on all target public pages at audit time, but the content still reflected older campaigns and messaging.
- `/_production_` and local code were not perfectly aligned on content and commercial framing.
- The public front still contained legacy claims and terminology that needed to be softened or removed.
- Pricing had to be normalized through a single source of truth.
- `/recommandation` needed a robust recommendation engine and canonical level normalization.
- `/bilan-gratuit` was too friction-heavy for a public conversion tunnel.
- `/stages` still needed to be aligned with the 2026/2027 commercial calendar.
- `/contact` needed strict separation between the administrative headquarters and the pedagogical center.

## Decisions Taken

- Use `data/pricing.canonical.json` exclusively through `lib/pricing.ts`.
- Normalize recommendation levels centrally with canonical tokens.
- Reframe the public conversion funnel around a strategic free assessment rather than account creation.
- Remove or soften legally risky marketing claims.
- Make Mutuelleville the public pedagogical center reference and Centre Urbain Nord the administrative headquarters reference.
- Keep the visual language premium, sober, and consistent.

## Files Modified

- Recommendation flow:
  - `lib/pricing.ts`
  - `components/premium/recommendation-engine.ts`
  - `components/premium/RecommendationWizard.tsx`
  - `components/premium/ExamCard.tsx`
  - `app/recommandation/page.tsx`
  - `app/recommandation/RecommandationClient.tsx`
- Free assessment funnel:
  - `lib/validations.ts`
  - `app/api/bilan-gratuit/route.ts`
  - `app/bilan-gratuit/page.tsx`
  - `app/bilan-gratuit/BilanStrategiqueClient.tsx`
  - `app/bilan-gratuit/confirmation/page.tsx`
- Stages:
  - `app/stages/page.tsx`
  - `app/stages/Stages2026Page.tsx`
  - `app/stages/layout.tsx`
- Offers:
  - `app/offres/page.tsx`
  - `app/offres/layout.tsx`
  - `components/premium/PassCard.tsx`
  - `components/premium/CarteNexusCard.tsx`
- Contact and local pages:
  - `app/contact/page.tsx`
  - `app/contact/layout.tsx`
  - `app/notre-centre/page.tsx`
  - `app/notre-centre/layout.tsx`
  - `components/layout/CorporateNavbar.tsx`
  - `components/layout/CorporateFooter.tsx`
- Public copy and global metadata:
  - `app/page.tsx`
  - `app/HomePageClient.tsx`
  - `app/accompagnement-scolaire/page.tsx`
  - `app/accompagnement-scolaire/layout.tsx`
  - `app/plateforme-aria/page.tsx`
  - `app/plateforme-aria/layout.tsx`
  - `app/layout.tsx`
- Tests:
  - `__tests__/components/recommendation-engine.test.ts`
  - `__tests__/api/bilan-gratuit.test.ts`
  - `__tests__/lib/validations.test.ts`
  - `__tests__/lib/bilan-gratuit-form.test.tsx`

## Tests Executed

- `npm run lint`
- `npm run typecheck`
- `npm run test -- --runInBand`
- `npm run build`

Additional verification:

- Production `curl -I` checks on the eight public pages.
- Production Playwright smoke checks with desktop and mobile captures.

## Results

- `npm run lint` passed.
- `npm run test -- --runInBand` passed for the targeted updated tests.
- `npm run build` passed.
- `npm run typecheck` failed, but the remaining errors were pre-existing and unrelated to the public-front changes:
  - `__tests__/api/parent.children.idor.route.test.ts`
  - `__tests__/api/payments.validate.entitlement.route.test.ts`
  - `__tests__/stage-eam-stmg/use-stage-progress.test.ts`
- Production audit artifacts were saved in:
  - `audit-public-front-20260618-1155/`

## Remaining Risks

- Typecheck still has unrelated repository-level failures outside the scope of this front-go-live pass.
- Legacy pages and archives still exist in the repository and should be kept clearly non-promoted.
- Production deployment was not performed in this session.

## Rollback

Rollback is straightforward because the work was limited to source files and does not remove data:

1. Revert the modified files in git.
2. Re-run `npm run build`.
3. Re-deploy only after validation.

The audit artifacts in `audit-public-front-20260618-1155/` can be kept for comparison during rollback or follow-up review.
