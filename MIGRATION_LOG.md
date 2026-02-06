# Design System Migration Log

**Date Created:** 2026-02-06  
**Task:** Cohérence Frontend - Design System Uniformization  
**Status:** 🟡 In Progress

---

## Baseline Test Results

**Date:** 2026-02-06 17:54 GMT+0100  
**Command:** `npm run verify:quick`

### Results Summary:
- ✅ **Lint:** Passed with warnings (0 errors, 59 warnings - mostly unused imports)
- ❌ **Typecheck:** Failed (126 errors, mostly in  test files)
- ⏭️ **Unit Tests:** Skipped (due to typecheck failure)
- ⏭️ **Integration Tests:** Skipped (due to typecheck failure)

### Key Findings:
- Main application code is lint-clean (errors are in  CLI tests)
- Missing dependencies: `@upstash/ratelimit`, `@upstash/redis`
- 59 warnings about unused imports in pages (cleanup opportunity)

---

## Public Pages Inventory (17 pages)

### Category A: High Priority - Light Theme Pages (10 pages)
Pages currently using `Header` + `Footer` that need migration to `CorporateNavbar` + `CorporateFooter`:

| # | Page | Path | Layout | Status | Notes |
|---|------|------|--------|--------|-------|
| 1 | Famille | `/famille` | Header + Footer | ⏳ Pending | 32 deprecated color usages |
| 2 | Contact | `/contact` | Header + Footer | ⏳ Pending | 13 deprecated color usages |
| 3 | Bilan Gratuit | `/bilan-gratuit` | Header + Footer | ⏳ Pending | Needs verification |
| 4 | Stages | `/stages` | Header + Footer | ⏳ Pending | Needs verification |
| 5 | Offres | `/offres` | Header + Footer | ⏳ Pending | 43 deprecated color usages |
| 6 | Équipe | `/equipe` | Header + Footer | ⏳ Pending | 38 deprecated color usages |
| 7 | Notre Centre | `/notre-centre` | Header + Footer | ⏳ Pending | 18 deprecated color usages |
| 8 | Plateforme | `/plateforme` | Header + Footer | ⏳ Pending | Needs verification |
| 9 | Plateforme ARIA | `/plateforme-aria` | Header + Footer | ⏳ Pending | Needs verification |
| 10 | Académies d'Hiver | `/academies-hiver` | Header + Footer | ⏳ Pending | Needs verification |

### Category B: Medium Priority - Already Using Corporate Layout (6 pages)
Pages using `CorporateNavbar` + `CorporateFooter` that may need color/style adjustments:

| # | Page | Path | Layout | Status | Notes |
|---|------|------|--------|--------|-------|
| 11 | Home | `/` | CorporateNavbar + Footer | ⏳ Pending | Verify consistency |
| 12 | Academy | `/academy` | CorporateNavbar + Footer | ⏳ Pending | 14 deprecated color usages |
| 13 | Studio | `/studio` | CorporateNavbar + Footer | ⏳ Pending | 12 deprecated color usages |
| 14 | Consulting | `/consulting` | CorporateNavbar + Footer | ⏳ Pending | 17 deprecated color usages |
| 15 | Accompagnement Scolaire | `/accompagnement-scolaire` | CorporateNavbar + Footer | ⏳ Pending | Needs verification |
| 16 | Education | `/education` | CorporateNavbar + Footer | ⏳ Pending | Needs verification |

### Category C: Special Cases (1 page)

| # | Page | Path | Layout | Status | Notes |
|---|------|------|--------|--------|-------|
| 17 | Mentions Légales | `/mentions-legales` | TechNavbar | ⏳ Pending | Review if TechNavbar is needed |

### Category D: Out of Scope - Dashboard Pages (14+ pages)
Dashboard pages - may keep existing design per PRD decision:
- `/dashboard/*` (all dashboard routes)
- `/(dashboard)/coach/page.tsx`
- `/(dashboard)/student/page.tsx`
- `/(dashboard)/parent/page.tsx`
- `/dashboard/assistante/*` (6+ pages)
- `/dashboard/eleve/*` (4+ pages)

### Category E: Auth Pages (2 pages)
Minimal changes - color alignment only:
- `/auth/signin`
- `/auth/mot-de-passe-oublie`

---

## Deprecated Color Usage Audit

### Top Files by Deprecated Color Usage:

| File | Deprecated Colors Count | Priority |
|------|------------------------|----------|
| `app/offres/page.tsx` | 43 usages | 🔴 Critical |
| `app/equipe/page.tsx` | 38 usages | 🔴 Critical |
| `app/famille/page.tsx` | 32 usages | 🔴 Critical |
| `app/notre-centre/page.tsx` | 18 usages | 🟡 High |
| `app/consulting/page.tsx` | 17 usages | 🟡 High |
| `app/academy/page.tsx` | 14 usages | 🟡 High |
| `app/contact/page.tsx` | 13 usages | 🟡 High |
| `app/studio/page.tsx` | 12 usages | 🟡 High |

### Deprecated Colors Found:
- `deep-midnight` (59 usages documented in tailwind.config.mjs)
- `midnight-blue-*` (0 usages per config)
- `nexus.*` (74 usages, mostly in GSAP sections)
- `gold-400/500/600` (multiple pages)

---

## Color Migration Reference Map

### Primary Migrations:

| Deprecated | Replacement | Usage Context |
|-----------|-------------|---------------|
| `midnight-950` | `surface-darker` | Main backgrounds (#020617 → #050608) |
| `deep-midnight` | `surface-darker` | Main backgrounds (#020617 → #050608) |
| `midnight-blue-800` | `neutral-800` | Text and borders (#3730a3 → #1F2937) |
| `midnight-blue-900` | `neutral-900` | Dark text (#1e1b4b → #111827) |
| `midnight-blue-950` | `surface-dark` | Very dark backgrounds (#0f172a → #0B0C10) |

### Brand Color Migrations:

| Deprecated | Replacement | Usage Context |
|-----------|-------------|---------------|
| `nexus.cyan` | `brand-accent` | Primary highlights (#2EE9F6) |
| `nexus.blue` | `brand-primary` | CTAs, links (#2563EB) |
| `nexus.red` | `brand-secondary` | Accents, alerts (#EF4444) |
| `nexus.dark` | `surface-dark` | Dark backgrounds (#0B0C10) |
| `nexus.charcoal` | `surface-card` | Card backgrounds (#111318) |
| `nexus.white` | `neutral-50` | Light text (#F4F6FA → #F9FAFB) |
| `nexus.gray` | `neutral-400` | Muted text (#A6A9B4 → #9CA3AF) |

### Gold Color Migrations:

| Deprecated | Replacement | Usage Context |
|-----------|-------------|---------------|
| `gold-400` | `brand-accent` | Premium highlights (#FACC15 → #2EE9F6) |
| `gold-500` | `brand-accent` | Premium CTAs (#EAB308 → #2EE9F6) |
| `gold-600` | `brand-accent` | Premium hover (#CA8A04 → #2EE9F6) |

### CSS Variables for GSAP:

Add to `app/globals.css` for GSAP compatibility:

```css
:root {
  /* GSAP Compatibility Aliases */
  --nexus-cyan-rgb: var(--color-brand-accent);
  --nexus-dark-rgb: var(--color-surface-dark);
  --nexus-charcoal-rgb: var(--color-surface-card);
}
```

---

## GSAP Sections Color Migration (8 files)

| File | Status | Notes |
|------|--------|-------|
| `components/sections/hero-section.tsx` | ⏳ Pending | Replace hardcoded hex with CSS vars |
| `components/sections/trinity-services-gsap.tsx` | ⏳ Pending | Replace hardcoded hex with CSS vars |
| `components/sections/korrigo-section-gsap.tsx` | ⏳ Pending | Replace hardcoded hex with CSS vars |
| `components/sections/proof-section-gsap.tsx` | ⏳ Pending | Replace hardcoded hex with CSS vars |
| `components/sections/offer-section-gsap.tsx` | ⏳ Pending | Replace hardcoded hex with CSS vars |
| `components/sections/business-model-section.tsx` | ⏳ Pending | Replace hardcoded hex with CSS vars |
| `components/sections/comparison-table-section.tsx` | ⏳ Pending | Replace hardcoded hex with CSS vars |
| `components/sections/micro-engagement-section.tsx` | ⏳ Pending | Replace hardcoded hex with CSS vars |

---

## Component Standardization Checklist

### Deprecated Utilities to Replace:

- [ ] `.btn-primary` → `<Button variant="default">`
- [ ] `.btn-secondary` → `<Button variant="outline">`
- [ ] `.card-dark` → `<Card variant="default">`
- [ ] `.card-micro` → `<Card variant="default" padding="sm">`
- [ ] Custom label utilities → `<Badge>` component

### Search Commands:
```bash
# Find deprecated button utilities
grep -r "btn-primary\|btn-secondary" app/ components/

# Find deprecated card utilities
grep -r "card-dark\|card-micro" app/ components/

# Find deprecated colors
grep -r "midnight-" app/ components/
grep -r "nexus\." app/ components/
grep -r "gold-[456]" app/ components/
```

---

## Design System Infrastructure Verification

### ✅ Verified Components:

- [x] **Design Tokens:** `/lib/theme/tokens.ts` exists and complete
- [x] **Tailwind Config:** `/tailwind.config.mjs` imports design tokens
- [x] **Global Styles:** `/app/globals.css` has CSS variables
- [x] **Layout Components:**
  - [x] `CorporateNavbar` exists
  - [x] `CorporateFooter` exists
  - [x] `Header` exists (to be deprecated)
  - [x] `Footer` exists (to be deprecated)
  - [x] `TechNavbar` exists (review needed)

### 📦 Component Library Status:

- [x] Radix UI primitives installed
- [x] shadcn/ui pattern components in `/components/ui/`
- [x] Button component with variants
- [x] Card component with variants
- [x] Badge component
- [x] Typography utilities

### 🎨 Animation Libraries:

- [x] GSAP installed (v3.14.2)
- [x] Framer Motion installed (v11.0.0)

---

## Migration Timeline

### Phase 1: Foundation & Setup ✅ COMPLETE
- [x] Run baseline test suite
- [x] Create MIGRATION_LOG.md
- [x] Document color migration map
- [x] Verify design system infrastructure

### Phase 2: Layout Unification - High Priority (Est. 2-3h)
- [ ] Migrate 10 light theme pages to Corporate layout

### Phase 3: Layout Unification - Medium Priority (Est. 1h)
- [ ] Review and adjust 6 corporate layout pages

### Phase 4: Color Migration - Pages (Est. 3-4h)
- [ ] Migrate 8 high-priority files (187 total usages)

### Phase 5: Color Migration - GSAP (Est. 2h)
- [ ] Add CSS variable aliases
- [ ] Update 8 GSAP sections

### Phase 6: Component Standardization (Est. 2h)
- [ ] Replace deprecated utilities across codebase

### Phase 7: Typography & Spacing (Est. 1-2h)
- [ ] Standardize typography hierarchy
- [ ] Standardize spacing patterns

### Phase 8: Final Verification & QA (Est. 2-3h)
- [ ] Visual review of all pages
- [ ] Accessibility audit
- [ ] Performance testing
- [ ] E2E tests

### Phase 9: Cleanup & Deprecation (Est. 1h)
- [ ] Remove deprecated files
- [ ] Remove deprecated utilities
- [ ] Remove deprecated colors
- [ ] Update documentation

---

## Visual Baseline Documentation

### Screenshots Needed (Manual Task):

To document the current state before migration, take screenshots of:

**Desktop (1920x1080):**
1. `/` - Home page
2. `/famille` - Famille page
3. `/contact` - Contact page
4. `/offres` - Offres page
5. `/equipe` - Équipe page
6. `/notre-centre` - Notre Centre page
7. `/academy` - Academy page
8. `/studio` - Studio page
9. `/consulting` - Consulting page
10. `/stages` - Stages page

**Mobile (375x667):**
1. `/` - Home page (mobile menu open)
2. `/famille` - Famille page
3. `/contact` - Contact page

**Storage Location:** `/tasks/coherence-frontend-e7f6/screenshots/`

---

## Known Issues & Blockers

### 🚨 Blockers:
- None identified yet

### ⚠️ Known Issues:
1. **Typecheck Errors:** 126 type errors in  test files (not blocking main app)
2. **Missing Dependencies:** `@upstash/ratelimit`, `@upstash/redis` (not critical for this task)
3. **Unused Imports:** 59 warnings (cleanup opportunity)

### 📝 Technical Debt:
- Deprecated layout components (`Header`, `Footer`) need removal after migration
- Deprecated color definitions in `tailwind.config.mjs` need removal
- Deprecated utilities in `app/globals.css` need removal

---

## Success Metrics

### Technical Completion Checklist:

- [ ] Zero `grep` results for deprecated colors:
  ```bash
  grep -r "midnight-" app/ components/  # Should return 0 results
  grep -r "nexus\." app/ components/    # Should return 0 results
  grep -r "gold-[456]" app/ components/ # Should return 0 results
  ```

- [ ] Zero `grep` results for deprecated utilities:
  ```bash
  grep -r "btn-primary" app/ components/    # Should return 0 results
  grep -r "card-dark" app/ components/      # Should return 0 results
  ```

- [ ] All public pages use unified layout:
  ```bash
  grep -r "import.*Header.*from.*layout/header" app/  # Should return 0 results
  grep -r "import.*Footer.*from.*layout/footer" app/  # Should return 0 results
  ```

- [ ] Tests pass:
  ```bash
  npm run verify:quick  # All tests pass
  npm run build         # Production build succeeds
  ```

### Quality Metrics:

- [ ] Manual visual review: 100% pass
- [ ] Accessibility: WCAG 2.1 AA maintained
- [ ] Performance: Lighthouse scores maintained
- [ ] No bundle size increase

---

## Notes & Observations

**Date: 2026-02-06**
- Foundation phase complete
- Baseline captured with test results documented
- 17 public pages identified for migration
- 187 deprecated color usages in 8 high-priority files
- Design system infrastructure verified and complete
- All necessary components and libraries in place

---

## Change Log

| Date | Phase | Changes | Author |
|------|-------|---------|--------|
| 2026-02-06 17:54 | Foundation | Initial baseline and inventory created | AI Agent |
