# Technical Specification
# Frontend Design System Coherence & Uniformization

**Version:** 1.0  
**Date:** 2026-02-06  
**Status:** Ready for Planning

---

## 1. Executive Summary

This specification details the technical implementation approach for standardizing the Nexus Réussite frontend design system. The goal is to achieve 100% consistency across all public-facing pages by migrating to a unified dark theme, eliminating deprecated color classes, standardizing component usage, and consolidating layout systems.

**Key Objectives:**
- Migrate all pages to unified dark theme layout (`CorporateNavbar` + `CorporateFooter`)
- Replace all deprecated color classes with design tokens
- Standardize component usage (shadcn/ui pattern)
- Ensure consistent typography, spacing, and styling

---

## 2. Technical Context

### 2.1 Technology Stack

**Framework & Language:**
- Next.js 15.5.11 (App Router)
- TypeScript 5.x
- React 18.3.1

**Styling & Design:**
- Tailwind CSS v4 (`@tailwindcss/postcss`)
- Design Tokens: `lib/theme/tokens.ts` (single source of truth)
- Component Library: Radix UI primitives
- Component Pattern: shadcn/ui (CVA + forwardRef)
- Animations: GSAP 3.14.2 (landing page), Framer Motion 11.0.0 (components)

**Quality Assurance:**
- Jest (unit + integration tests)
- Playwright (E2E tests)
- ESLint (linting)
- TypeScript compiler (type checking)

**Scripts:**
```json
{
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test:unit": "jest --config jest.config.unit.js",
  "test:integration": "jest --config jest.config.integration.js",
  "test:e2e": "playwright test",
  "verify:quick": "npm run lint && npm run typecheck && npm run test:unit && npm run test:integration",
  "build": "next build && node scripts/copy-public-assets.js"
}
```

### 2.2 Design System Architecture

**Current State:**

```
Design Tokens (Source of Truth)
└── lib/theme/tokens.ts
    ├── colors (brand, semantic, neutral, surface)
    ├── typography (fonts, sizes, weights)
    ├── spacing (4px base scale)
    ├── radius (micro, card-sm, card, full)
    └── shadows (soft, medium, strong, card, glow)

Tailwind Config
└── tailwind.config.mjs
    └── Imports designTokens → Tailwind utilities

Global Styles
└── app/globals.css
    ├── CSS variables (:root)
    ├── Base styles (@layer base)
    ├── Component utilities (@layer components)
    └── Deprecated utilities (marked for migration)

Components
├── components/ui/ (shadcn/ui - 25+ components)
├── components/layout/ (CorporateNavbar, CorporateFooter, Header, Footer)
└── components/sections/ (GSAP landing sections)
```

**Design Tokens Summary:**

```typescript
// Brand Colors
brand: {
  primary: '#2563EB',      // Blue - CTAs, links
  secondary: '#EF4444',    // Red - accents
  accent: '#2EE9F6',       // Cyan - primary highlights
  'accent-dark': '#1BCED4' // Cyan hover
}

// Surface Colors (Dark Theme)
surface: {
  darker: '#050608',   // Main background
  dark: '#0B0C10',     // Secondary background
  card: '#111318',     // Card background
  elevated: '#1A1D23', // Elevated cards
  hover: '#1F2329'     // Hover states
}
```

### 2.3 Current Layout Systems

**System A: Corporate Dark Theme** ✅ (Target Standard)
- **Components:** `CorporateNavbar` + `CorporateFooter`
- **Background:** `surface-darker` (#050608)
- **Accent:** `brand-accent` (cyan #2EE9F6)
- **Style:** Modern, fullscreen menu, reduced-motion support
- **Usage:** Home (`/`), academy, studio, consulting, accompagnement-scolaire

**System B: Light Theme** ⚠️ (Needs Migration)
- **Components:** `Header` + `Footer`
- **Background:** White, light grays
- **Accent:** Mix of `blue-600`, `gold-500`
- **Style:** Traditional, dropdown menu
- **Usage:** famille, contact, stages, offres, equipe, notre-centre, plateforme, plateforme-aria, bilan-gratuit, academies-hiver (10 pages)

**System C: Tech Navbar** ❓ (Verify Purpose)
- **Component:** `TechNavbar`
- **Usage:** mentions-legales
- **Decision:** To be determined during planning

---

## 3. Implementation Approach

### 3.1 Migration Strategy

**Phased Rollout (Incremental & Testable):**

```
Phase 1: Foundation (Critical Path)
├── Audit all pages for deprecated colors
├── Create color migration mapping
├── Standardize layout system (pick one)
└── Run baseline tests (capture current state)

Phase 2: Layout Unification
├── Migrate light theme pages to CorporateNavbar/Footer
├── Update page imports and structure
├── Test navigation and mobile menu
└── Verify responsive behavior

Phase 3: Color Migration
├── Replace deprecated utilities in components
├── Update GSAP sections with CSS variables
├── Migrate inline styles to design tokens
└── Remove deprecated color definitions

Phase 4: Component Standardization
├── Replace .btn-primary → <Button>
├── Replace .card-dark → <Card>
├── Standardize Badge variants
└── Update typography classes

Phase 5: Verification & Polish
├── Manual visual review (all pages)
├── Accessibility audit (WCAG 2.1 AA)
├── Performance testing (Lighthouse)
└── Final E2E tests
```

### 3.2 Technical Patterns

#### Pattern 1: Page Layout Migration

**Before (Light Theme):**
```tsx
// app/contact/page.tsx
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="bg-white">
        {/* Content */}
      </main>
      <Footer />
    </>
  );
}
```

**After (Dark Theme):**
```tsx
// app/contact/page.tsx
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { CorporateFooter } from "@/components/layout/CorporateFooter";

export default function ContactPage() {
  return (
    <>
      <CorporateNavbar />
      <main className="bg-surface-darker">
        {/* Content migrated to dark theme */}
      </main>
      <CorporateFooter />
    </>
  );
}
```

#### Pattern 2: Color Migration

**Before (Deprecated):**
```tsx
<section className="bg-deep-midnight border-midnight-blue-800">
  <h2 className="text-nexus-cyan">Title</h2>
  <span className="text-gold-500">Premium</span>
</section>
```

**After (Design Tokens):**
```tsx
<section className="bg-surface-darker border-white/10">
  <h2 className="text-brand-accent">Title</h2>
  <span className="text-brand-accent">Premium</span>
</section>
```

#### Pattern 3: Component Standardization

**Before (Utility Classes):**
```tsx
<button className="btn-primary">
  Click Me
</button>

<div className="card-dark p-6">
  <div className="label-mono">STATUS</div>
  <h3>Card Title</h3>
</div>
```

**After (shadcn/ui Components):**
```tsx
<Button variant="default" size="default">
  Click Me
</Button>

<Card variant="default" padding="default">
  <Badge variant="outline">STATUS</Badge>
  <h3>Card Title</h3>
</Card>
```

#### Pattern 4: GSAP Color Migration

**Before (Hardcoded Colors):**
```tsx
gsap.to(element, {
  backgroundColor: '#2EE9F6',  // Hardcoded cyan
  color: '#0B0C10',             // Hardcoded dark
  borderColor: '#111318'        // Hardcoded charcoal
});
```

**After (CSS Variables):**
```tsx
gsap.to(element, {
  backgroundColor: 'var(--color-brand-accent)',
  color: 'var(--color-surface-dark)',
  borderColor: 'var(--color-surface-card)'
});
```

---

## 4. Source Code Structure Changes

### 4.1 Files to Modify

#### **Critical Path (Must Change):**

**Layout Components:**
```
✅ Keep:
- components/layout/CorporateNavbar.tsx
- components/layout/CorporateFooter.tsx

⚠️  Deprecate (after migration):
- components/layout/header.tsx
- components/layout/footer.tsx

❓ Review:
- components/layout/TechNavbar.tsx
```

**Pages (Layout Migration):**
```
High Priority (10 pages):
- app/famille/page.tsx
- app/contact/page.tsx
- app/stages/page.tsx
- app/offres/page.tsx
- app/equipe/page.tsx
- app/notre-centre/page.tsx
- app/plateforme/page.tsx
- app/plateforme-aria/page.tsx
- app/bilan-gratuit/page.tsx
- app/academies-hiver/page.tsx
```

**Color Migration (8 files):**
```
- app/contact/page.tsx (13 usages)
- app/famille/page.tsx (32 usages)
- app/academy/page.tsx (14 usages)
- app/offres/page.tsx (43 usages)
- app/equipe/page.tsx (38 usages)
- app/notre-centre/page.tsx (18 usages)
- app/studio/page.tsx (12 usages)
- app/consulting/page.tsx (17 usages)
```

**GSAP Sections (CSS Variable Migration):**
```
- components/sections/hero-section.tsx
- components/sections/trinity-services-gsap.tsx
- components/sections/korrigo-section-gsap.tsx
- components/sections/proof-section-gsap.tsx
- components/sections/offer-section-gsap.tsx
- components/sections/business-model-section.tsx
- components/sections/comparison-table-section.tsx
- components/sections/micro-engagement-section.tsx
```

**Component Utility Migration:**
```
- components/ui/aria-widget.tsx
- Any files using .btn-primary, .btn-secondary
- Any files using .card-dark, .card-micro
```

#### **Global Styles:**

```
app/globals.css:
1. Update body background: bg-deep-midnight → bg-surface-darker
2. Keep deprecated utilities temporarily (mark with TODO)
3. Add CSS variable aliases for GSAP compatibility
4. Document migration status in comments
```

```
tailwind.config.mjs:
1. Keep deprecated colors temporarily (phase out post-migration)
2. Update deprecation comments with removal timeline
3. Document migration status
```

### 4.2 Files to Add

**Migration Documentation:**
```
.zenflow/tasks/coherence-frontend-e7f6/MIGRATION_LOG.md
└── Track each page/component migration
    ├── Before/after screenshots
    ├── Issues encountered
    └── Verification checklist
```

### 4.3 Files to Eventually Remove

**Post-Migration Cleanup (Phase 6):**
```
After 100% migration verified:
- components/layout/header.tsx
- components/layout/footer.tsx

After GSAP migration verified:
- Remove deprecated colors from tailwind.config.mjs
- Remove deprecated utilities from globals.css
- Remove legacy CSS variables (:root)
```

---

## 5. Data Model / API / Interface Changes

### 5.1 Component Interfaces

**No Breaking Changes Required** ✅

All existing component APIs remain compatible. Migration uses existing interfaces:

```typescript
// Existing Button interface (no changes)
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, 
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

// Existing Card interface (no changes)
interface CardProps extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof cardVariants> {
  padding?: 'none' | 'sm' | 'default' | 'lg';
}

// Layout components (no prop changes)
export function CorporateNavbar(): JSX.Element;
export function CorporateFooter(): JSX.Element;
```

### 5.2 Design Token Exports

**Enhanced Exports (Optional Improvement):**

```typescript
// lib/theme/tokens.ts
export const designTokens = { ... }; // Existing

// Add convenience exports for runtime use
export const brandColors = designTokens.colors.brand;
export const surfaceColors = designTokens.colors.surface;
export const semanticColors = designTokens.colors.semantic;

// Type guards
export function isBrandColor(color: string): color is BrandColor;
export function isSurfaceColor(color: string): color is SurfaceColor;
```

### 5.3 CSS Variable Mappings

**Add to globals.css for GSAP compatibility:**

```css
:root {
  /* Existing variables remain */
  
  /* Add aliases for deprecated GSAP usage */
  --nexus-cyan-rgb: var(--color-brand-accent);
  --nexus-dark-rgb: var(--color-surface-dark);
  --nexus-charcoal-rgb: var(--color-surface-card);
  
  /* Migration note: Remove aliases after GSAP sections migrated */
}
```

---

## 6. Delivery Phases

### Phase 1: Foundation & Setup (Est. 0.5 days)

**Objectives:**
- Establish baseline
- Create migration inventory
- Set up verification tooling

**Tasks:**
1. Run full test suite (capture baseline)
2. Create page-by-page migration checklist
3. Document current Lighthouse scores
4. Take screenshots of all pages (visual baseline)
5. Create color migration map (deprecated → new)

**Deliverables:**
- `MIGRATION_LOG.md` with inventory
- Baseline test results
- Visual regression baseline (screenshots)

**Verification:**
- All existing tests pass
- Documentation complete

---

### Phase 2: Layout System Unification (Est. 1-1.5 days)

**Objectives:**
- Migrate all light theme pages to CorporateNavbar/Footer
- Standardize page structure

**Tasks:**
1. **Migrate 10 pages** (famille, contact, stages, offres, equipe, notre-centre, plateforme, plateforme-aria, bilan-gratuit, academies-hiver)
   - Update imports: Header/Footer → CorporateNavbar/CorporateFooter
   - Change main backgrounds: white → surface-darker
   - Test navigation on each page
   - Verify mobile menu
   
2. **Content Adaptation:**
   - Update text colors for dark theme readability
   - Adjust card backgrounds
   - Test responsive behavior

3. **TechNavbar Decision:**
   - Determine if mentions-legales needs special layout
   - Migrate or document exception

**Deliverables:**
- 10+ pages using unified layout
- All navigation links functional
- Mobile menu working consistently

**Verification:**
```bash
# Per page:
npm run lint                    # No new warnings
npm run typecheck               # Types valid
npm run test:unit               # Unit tests pass
Manual: Test navigation flow
Manual: Verify mobile menu
Manual: Check responsive breakpoints
```

---

### Phase 3: Color Token Migration (Est. 1-1.5 days)

**Objectives:**
- Replace all deprecated color classes
- Zero usages of `midnight-*`, `nexus.*`, old `gold-*`

**Tasks:**
1. **Page-by-Page Migration** (8 files):
   - Use migration map: `midnight-950` → `surface-darker`
   - Replace: `nexus-cyan` → `brand-accent`
   - Replace: `gold-*` → `brand-accent` or `warning`
   - Update borders: `border-midnight-*` → `border-white/10`
   
2. **GSAP Sections** (8 files):
   - Replace hardcoded hex colors with CSS variables
   - Test animations still work
   - Verify reduced-motion fallbacks

3. **Verification:**
   ```bash
   # Confirm zero deprecated usage
   grep -r "midnight-" app/ components/
   grep -r "nexus\." app/ components/
   grep -r "gold-[456]" app/ components/
   # Should return no results
   ```

**Deliverables:**
- Zero deprecated color classes in codebase
- GSAP animations work with CSS variables
- All pages visually consistent

**Verification:**
```bash
npm run verify:quick            # Lint + typecheck + tests
Manual: Visual review of 10+ pages
Manual: Test GSAP animations on home page
```

---

### Phase 4: Component Standardization (Est. 1 day)

**Objectives:**
- Replace utility classes with shadcn/ui components
- Consistent Button/Card/Badge usage

**Tasks:**
1. **Button Migration:**
   - Find all `.btn-primary`, `.btn-secondary`
   - Replace with `<Button variant="default|outline">`
   - Test hover states, animations
   
2. **Card Migration:**
   - Find all `.card-dark`, `.card-micro`
   - Replace with `<Card variant="default" padding="...">`
   - Preserve existing padding/spacing
   
3. **Typography Standardization:**
   - Ensure h1-h6 use `font-display`
   - Body text uses `font-sans`
   - Consistent heading sizes across pages

4. **Spacing Normalization:**
   - Section padding: `py-16 md:py-20 lg:py-24`
   - Container: `max-w-7xl mx-auto px-6`
   - Grid gaps: `gap-4`, `gap-6`, `gap-8`

**Deliverables:**
- All buttons use `<Button>` component
- All cards use `<Card>` component
- Typography consistent across pages
- Spacing follows design system scale

**Verification:**
```bash
# Confirm zero deprecated utilities
grep -r "btn-primary\|btn-secondary" app/ components/
grep -r "card-dark\|card-micro" app/ components/
# Should return no results (except docs/comments)

npm run lint
npm run typecheck
npm run test:unit
```

---

### Phase 5: Final Verification & Polish (Est. 0.5-1 day)

**Objectives:**
- Comprehensive quality assurance
- Documentation updates
- Production readiness

**Tasks:**
1. **Visual Review:**
   - Manually review all 15+ public pages
   - Compare against baseline screenshots
   - Check responsive breakpoints (mobile, tablet, desktop)
   - Verify dark theme consistency

2. **Accessibility Audit:**
   - Test keyboard navigation
   - Verify color contrast ratios (WCAG 2.1 AA)
   - Screen reader testing (VoiceOver/NVDA)
   - Reduced-motion support

3. **Performance Testing:**
   - Run Lighthouse on key pages (home, contact, famille)
   - Compare scores to baseline
   - Ensure no bundle size increase

4. **E2E Testing:**
   ```bash
   npm run test:e2e              # Full Playwright suite
   ```

5. **Production Build:**
   ```bash
   npm run build                 # Verify builds successfully
   npm run start                 # Test production mode
   ```

6. **Documentation Updates:**
   - Update `docs/DESIGN_SYSTEM.md` (mark old colors as removed)
   - Update `docs/MIGRATION_GUIDE.md` (record completion)
   - Update `globals.css` comments (remove TODOs)
   - Create `MIGRATION_COMPLETE.md` report

**Deliverables:**
- All pages visually consistent
- WCAG 2.1 AA compliance maintained
- Performance ≥ baseline
- All tests passing
- Documentation current

**Verification Checklist:**
```
Visual Consistency:
[ ] All pages use CorporateNavbar + CorporateFooter
[ ] Consistent dark theme (surface-darker background)
[ ] Brand-accent cyan used consistently
[ ] Typography hierarchy uniform
[ ] Spacing follows design system

Code Quality:
[ ] grep -r "midnight-" returns 0 results
[ ] grep -r "nexus\." returns 0 results
[ ] grep -r "gold-[456]" returns 0 results
[ ] grep -r "btn-primary" returns 0 results (except globals.css comment)
[ ] grep -r "card-dark" returns 0 results (except globals.css comment)

Testing:
[ ] npm run lint (no warnings)
[ ] npm run typecheck (no errors)
[ ] npm run test:unit (all pass)
[ ] npm run test:integration (all pass)
[ ] npm run test:e2e (all pass)
[ ] npm run build (successful)

Accessibility:
[ ] Lighthouse Accessibility ≥ 90 on all pages
[ ] Keyboard navigation works
[ ] Color contrast WCAG 2.1 AA compliant

Performance:
[ ] Lighthouse Performance ≥ baseline
[ ] No bundle size increase
[ ] GSAP animations smooth (60fps)
```

---

### Phase 6: Cleanup (Est. 0.25 day)

**Objectives:**
- Remove deprecated code
- Final documentation

**Tasks:**
1. **Remove Deprecated Files:**
   ```bash
   # After confirming zero usage:
   rm components/layout/header.tsx
   rm components/layout/footer.tsx
   ```

2. **Remove Deprecated Utilities:**
   - Remove `midnight-blue` from `tailwind.config.mjs`
   - Remove `deep-midnight` from `tailwind.config.mjs`
   - Remove `nexus` colors from `tailwind.config.mjs`
   - Remove `.btn-primary`, `.btn-secondary` from `globals.css`
   - Remove `.card-dark`, `.card-micro` from `globals.css`

3. **Final Documentation:**
   - Update `MIGRATION_LOG.md` with final status
   - Create release notes
   - Update `README.md` if needed

**Deliverables:**
- Clean codebase (no deprecated code)
- Final migration report

**Verification:**
```bash
npm run verify:quick            # Final sanity check
npm run build                   # Confirm builds
```

---

## 7. Verification Approach

### 7.1 Automated Verification

**Linting & Type Checking:**
```bash
npm run lint                    # ESLint
npm run typecheck               # TypeScript compiler
```

**Unit Tests:**
```bash
npm run test:unit               # Fast, isolated tests
npm run test:unit:watch         # Development mode
```

**Integration Tests:**
```bash
npm run test:integration        # Database + API tests
```

**E2E Tests:**
```bash
npm run test:e2e                # Playwright browser tests
npm run test:e2e:ui             # Visual test runner
npm run test:e2e:debug          # Debug mode
```

**Full Verification:**
```bash
npm run verify:quick            # Lint + typecheck + unit + integration
npm run verify                  # Full suite (includes E2E + build)
```

### 7.2 Manual Verification

**Visual Review Checklist (Per Page):**
```
Layout:
[ ] CorporateNavbar renders correctly
[ ] CorporateFooter renders correctly
[ ] Mobile menu opens and closes
[ ] Navigation links work

Colors & Theme:
[ ] Background is surface-darker (consistent dark theme)
[ ] Text is readable (white, neutral-200, neutral-300)
[ ] Brand accent (cyan) used for CTAs/highlights
[ ] No jarring color transitions

Typography:
[ ] Headings use font-display (Space Grotesk)
[ ] Body text uses font-sans (Inter)
[ ] Heading hierarchy consistent
[ ] Font sizes responsive (clamp working)

Spacing & Layout:
[ ] Section padding consistent (py-16 md:py-20 lg:py-24)
[ ] Container widths consistent (max-w-7xl)
[ ] Grid gaps follow scale (gap-4, gap-6, gap-8)
[ ] Card spacing consistent

Components:
[ ] Buttons use <Button> component
[ ] Cards use <Card> component
[ ] Badges use <Badge> component
[ ] Hover states work

Responsive:
[ ] Mobile (320px-767px): Layout works, readable text
[ ] Tablet (768px-1023px): Layout adapts smoothly
[ ] Desktop (1024px+): Full layout, optimal spacing
[ ] Large (1920px+): Content not stretched

Accessibility:
[ ] Keyboard navigation works (Tab, Enter, Esc)
[ ] Focus indicators visible
[ ] Color contrast ≥ 4.5:1 for text
[ ] Reduced motion respected
```

**Pages to Review (15+ pages):**
1. Home (`/`)
2. Famille (`/famille`)
3. Contact (`/contact`)
4. Stages (`/stages`)
5. Offres (`/offres`)
6. Équipe (`/equipe`)
7. Notre Centre (`/notre-centre`)
8. Plateforme ARIA (`/plateforme-aria`)
9. Bilan Gratuit (`/bilan-gratuit`)
10. Académies d'Hiver (`/academies-hiver`)
11. Academy (`/academy`)
12. Studio (`/studio`)
13. Consulting (`/consulting`)
14. Accompagnement Scolaire (`/accompagnement-scolaire`)
15. Mentions Légales (`/mentions-legales`)

### 7.3 Performance Verification

**Lighthouse Audit (Key Pages):**
```
Target Scores (maintain or improve):
- Performance: ≥ 85
- Accessibility: ≥ 95
- Best Practices: ≥ 90
- SEO: ≥ 90

Pages to Audit:
- Home (/)
- Contact (/contact)
- Famille (/famille)
- Bilan Gratuit (/bilan-gratuit)
```

**Bundle Size Check:**
```bash
npm run build
# Check .next/static/chunks size
# Ensure no significant increase from baseline
```

**Animation Performance:**
```
Test GSAP sections on home page:
- Hero section: smooth parallax
- Trinity services: smooth scroll-triggered animations
- Korrigo section: smooth card animations
- Target: 60fps on desktop, 30fps+ on mobile
```

### 7.4 Accessibility Verification

**WCAG 2.1 Level AA Compliance:**

**Color Contrast:**
- Use browser dev tools (Chrome: Lighthouse, Firefox: Accessibility Inspector)
- Verify all text meets minimum contrast ratios:
  - Normal text: 4.5:1
  - Large text (≥18pt or ≥14pt bold): 3:1

**Keyboard Navigation:**
- Tab through all interactive elements
- Enter/Space activate buttons/links
- Escape closes modals/menus
- Arrow keys work in custom components

**Screen Reader Testing:**
- VoiceOver (macOS/iOS)
- NVDA (Windows)
- Verify:
  - All images have alt text
  - Headings in logical order
  - Form labels associated
  - ARIA labels present on icon-only buttons

**Reduced Motion:**
- Enable "Reduce motion" in OS settings
- Verify:
  - GSAP animations simplified or disabled
  - Transition durations reduced
  - No unexpected movement

---

## 8. Risk Mitigation

### 8.1 Identified Risks

**Risk 1: GSAP Animation Breakage**
- **Probability:** Medium
- **Impact:** High (landing page is critical)
- **Mitigation:**
  - Test animations after each GSAP section change
  - Use CSS variable aliases for backward compatibility
  - Keep hardcoded color fallbacks during Phase 3
  - Extensive manual testing on home page

**Risk 2: Mobile Responsiveness Issues**
- **Probability:** Medium
- **Impact:** Medium (affects UX)
- **Mitigation:**
  - Test on real devices (iOS, Android)
  - Use browser dev tools for multiple breakpoints
  - Verify CorporateNavbar mobile menu on all pages
  - Responsive images and layout testing

**Risk 3: Performance Regression**
- **Probability:** Low
- **Impact:** Medium (affects SEO/UX)
- **Mitigation:**
  - Baseline Lighthouse scores before starting
  - Monitor bundle size during migration
  - No new heavy dependencies
  - Compare Lighthouse scores after each phase

**Risk 4: Accessibility Regressions**
- **Probability:** Low
- **Impact:** High (legal/UX)
- **Mitigation:**
  - WCAG compliance already documented
  - Use existing shadcn/ui components (accessibility built-in)
  - Test with keyboard navigation
  - Run automated accessibility audits

**Risk 5: Test Failures**
- **Probability:** Medium
- **Impact:** Low (can be fixed)
- **Mitigation:**
  - Run tests frequently (after each file change)
  - Update snapshot tests if visual changes intentional
  - Fix breaking tests immediately
  - Use `verify:quick` between phases

### 8.2 Rollback Plan

**If Critical Issues Arise:**

1. **Git Branching Strategy:**
   ```bash
   # Work in feature branch
   git checkout -b design-system-unification
   
   # Commit after each phase
   git commit -m "Phase 2: Layout unification complete"
   
   # Easy rollback if needed
   git revert <commit-hash>
   ```

2. **Incremental Deployment:**
   - Test in staging environment first
   - Deploy phase-by-phase to production
   - Monitor error logs and analytics

3. **Emergency Rollback:**
   ```bash
   # If production issues detected
   git revert HEAD~5  # Revert last 5 commits
   npm run build
   # Deploy previous version
   ```

---

## 9. Success Criteria

### 9.1 Technical Success Metrics

✅ **Code Quality:**
- Zero deprecated color classes (`midnight-*`, `nexus.*`, old `gold-*`)
- Zero deprecated utility classes (`.btn-primary`, `.card-dark`)
- All files pass linting (0 warnings)
- All files pass type checking (0 errors)
- 100% test pass rate

✅ **Consistency:**
- All public pages use CorporateNavbar + CorporateFooter
- All pages use `surface-darker` background
- All CTAs use `brand-accent` (cyan)
- All buttons use `<Button>` component
- All cards use `<Card>` component

✅ **Performance:**
- Lighthouse Performance ≥ baseline
- Bundle size increase ≤ 5%
- GSAP animations maintain 60fps
- Page load times ≤ baseline

✅ **Accessibility:**
- WCAG 2.1 Level AA compliance maintained
- Lighthouse Accessibility ≥ 95
- Keyboard navigation functional
- Screen reader compatible

### 9.2 User Experience Metrics

✅ **Visual Coherence:**
- Seamless navigation between pages (no jarring transitions)
- Consistent header/footer across all pages
- Unified color scheme (dark theme)
- Professional, premium appearance

✅ **Functionality:**
- All navigation links work
- Mobile menu works consistently
- Forms functional
- CTAs clearly visible and clickable

### 9.3 Documentation Completeness

✅ **Required Documentation:**
- [x] `MIGRATION_LOG.md` - Phase-by-phase progress
- [x] `spec.md` - This document
- [x] Updated `docs/DESIGN_SYSTEM.md` - Reflect removals
- [x] Updated `docs/MIGRATION_GUIDE.md` - Mark complete
- [x] `MIGRATION_COMPLETE.md` - Final report with screenshots

---

## 10. Dependencies & Constraints

### 10.1 Dependencies

**None - All Infrastructure Ready** ✅

All required dependencies already installed:
- Design tokens: `lib/theme/tokens.ts` ✓
- Tailwind config: `tailwind.config.mjs` ✓
- Components: `components/ui/*` ✓
- Layouts: `CorporateNavbar`, `CorporateFooter` ✓
- Documentation: `docs/DESIGN_SYSTEM.md` ✓

### 10.2 Constraints

**Hard Constraints:**
- Must maintain existing functionality (no breaking changes)
- Must preserve GSAP animation performance
- Must maintain WCAG 2.1 AA accessibility
- Cannot modify design tokens themselves (approved)
- Must pass all existing tests

**Soft Constraints:**
- Prefer incremental migration over "big bang"
- Minimize production downtime
- Maintain development velocity (other features can continue)

**Timeline Constraint:**
- Target completion: 3-5 days
- Phases can be spread across multiple days
- Testing should not be rushed

**Scope Constraints (Out of Scope):**
- Dashboard pages (`/dashboard/*`) - keep existing design
- Auth pages - minimal changes (color alignment only)
- New features - focus on standardization only
- Content/copy changes - not included
- Backend/API changes - frontend only

---

## 11. Open Questions & Decisions

### Q1: TechNavbar Usage (mentions-legales)
**Status:** To be determined in Planning phase

**Options:**
- A. Migrate to CorporateNavbar (full consistency)
- B. Keep TechNavbar (document exception)
- C. Investigate if TechNavbar serves special purpose

**Recommendation:** Option A (migrate) unless legal requirements dictate special layout.

### Q2: Gold Color Final Decision
**Status:** Per requirements, replace with `brand-accent`

**Decision:** Replace all `gold-*` with `brand-accent` (cyan) for maximum consistency.

### Q3: Dashboard Scope
**Status:** Per requirements, dashboard is OUT OF SCOPE

**Decision:** Dashboard pages (`/dashboard/*`, `/(dashboard)/*`) keep existing design. Focus on public pages only.

### Q4: GSAP Migration Timing
**Status:** Phase 3 (CSS variables with aliases for compatibility)

**Decision:** Migrate GSAP sections to CSS variables in Phase 3. Use aliases in globals.css for backward compatibility during migration.

---

## 12. Appendices

### Appendix A: Color Migration Map

```
┌────────────────────────────────────────────────────────────────┐
│ DEPRECATED → NEW DESIGN TOKEN MAPPING                         │
├────────────────────────────────────────────────────────────────┤
│ midnight-950         → surface-darker                          │
│ deep-midnight        → surface-darker                          │
│ midnight-blue-800    → neutral-800 or surface-dark             │
│ midnight-blue-700    → neutral-700                             │
│                                                                 │
│ nexus-dark           → surface-dark                            │
│ nexus-charcoal       → surface-card                            │
│ nexus-cyan           → brand-accent                            │
│ nexus-blue           → brand-primary                           │
│ nexus-red            → brand-secondary                         │
│ nexus-white          → white                                   │
│ nexus-gray           → neutral-400                             │
│                                                                 │
│ gold-400             → brand-accent (or warning if contextual) │
│ gold-500             → brand-accent (or warning if contextual) │
│ gold-600             → brand-accent-dark (or warning)          │
│                                                                 │
│ blue-600             → brand-primary                           │
│ slate-900            → surface-dark                            │
└────────────────────────────────────────────────────────────────┘
```

### Appendix B: Component Migration Reference

```
┌────────────────────────────────────────────────────────────────┐
│ UTILITY CLASS → SHADCN/UI COMPONENT MAPPING                   │
├────────────────────────────────────────────────────────────────┤
│ .btn-primary         → <Button variant="default">             │
│ .btn-secondary       → <Button variant="outline">             │
│                                                                 │
│ .card-dark           → <Card variant="default">               │
│ .card-micro          → <Card variant="default" padding="sm">  │
│                                                                 │
│ .label-mono          → <Badge variant="outline">              │
│                       + className="font-mono text-xs ..."     │
└────────────────────────────────────────────────────────────────┘
```

### Appendix C: Page Migration Priority

```
┌─────────┬──────────────────────────────┬───────────────────────┐
│ Priority│ Page                         │ Reason                │
├─────────┼──────────────────────────────┼───────────────────────┤
│ P0      │ /famille                     │ High traffic, many    │
│ P0      │ /contact                     │   deprecated colors   │
│ P0      │ /bilan-gratuit               │                       │
├─────────┼──────────────────────────────┼───────────────────────┤
│ P1      │ /stages                      │ Medium traffic        │
│ P1      │ /offres                      │                       │
│ P1      │ /equipe                      │                       │
│ P1      │ /notre-centre                │                       │
├─────────┼──────────────────────────────┼───────────────────────┤
│ P2      │ /plateforme                  │ Lower traffic         │
│ P2      │ /plateforme-aria             │                       │
│ P2      │ /academies-hiver             │                       │
│ P2      │ /mentions-legales            │                       │
└─────────┴──────────────────────────────┴───────────────────────┘
```

### Appendix D: Testing Commands Quick Reference

```bash
# Development
npm run dev                      # Start dev server

# Quality Checks
npm run lint                     # ESLint
npm run typecheck                # TypeScript
npm run verify:quick             # Lint + typecheck + unit + integration

# Testing
npm run test:unit                # Unit tests (fast)
npm run test:unit:watch          # Watch mode
npm run test:integration         # Integration tests
npm run test:e2e                 # E2E tests (slow)
npm run test:e2e:ui              # E2E with UI
npm run test:all                 # All tests

# Build
npm run build                    # Production build
npm run start                    # Run production build

# Verification Scripts
npm run verify                   # Full verification (all tests + build)

# Grep Commands (Verify Migration)
grep -r "midnight-" app/ components/
grep -r "nexus\." app/ components/
grep -r "gold-[456]" app/ components/
grep -r "btn-primary\|btn-secondary" app/ components/
grep -r "card-dark\|card-micro" app/ components/
```

---

## Revision History

| Version | Date       | Author    | Changes                          |
|---------|------------|-----------|----------------------------------|
| 1.0     | 2026-02-06 | AI Agent  | Initial technical specification  |

---

**End of Technical Specification**
