# Product Requirements Document (PRD)
# Frontend Design System Coherence & Uniformization

**Version:** 1.0  
**Date:** 2026-02-06  
**Status:** Draft for Review

---

## 1. Executive Summary

### Problem Statement
The Nexus Réussite application currently suffers from design system inconsistencies across its 68 pages and 103+ components. Multiple layout components, deprecated color systems, and inconsistent styling patterns create a fragmented user experience that undermines the brand's premium positioning.

### Solution Overview
Implement a comprehensive design system audit and migration to standardize all pages, components, headers, footers, and color schemes according to the documented design system in `docs/DESIGN_SYSTEM.md`, using the centralized design tokens and established patterns.

### Success Criteria
- **100% adherence** to design tokens defined in `globals.css` and `tailwind.config.mjs`
- **Single header/footer** implementation across all public pages
- **Zero usage** of deprecated color classes (`midnight-*`, `nexus.*`, old `gold-*`)
- **Consistent spacing**, typography, and component styling across all pages
- **Visual coherence** verified through manual review of all page types

---

## 2. Current State Analysis

### 2.1 Technology Stack
- **Framework:** Next.js 15.5.11 with TypeScript
- **Styling:** Tailwind CSS v4
- **Component Library:** Radix UI with shadcn/ui pattern
- **Design System:** Documented in `docs/DESIGN_SYSTEM.md`
- **Animations:** GSAP (landing page), Framer Motion (components)

### 2.2 Identified Issues

#### **Issue #1: Multiple Layout Systems**
**Current State:**
- **Dark Theme Layouts:** `CorporateNavbar` + `CorporateFooter`
  - Used on: Home page (`app/page.tsx`)
  - Background: `surface-darker`, `surface-card`
  - Accent: `brand-accent` (cyan #2EE9F6)
  
- **Light Theme Layouts:** `Header` + `Footer`
  - Used on: famille, contact, stages, offres, etc.
  - Background: `white`, `slate-900`
  - Accent: `blue-600`, `gold-500`

**Impact:** Users experience jarring theme transitions when navigating between pages.

#### **Issue #2: Deprecated Color Usage**
**Scope (from `tailwind.config.mjs` audit):**

| Deprecated Class | Usages | Replacement |
|-----------------|--------|-------------|
| `deep-midnight` | 59 | `surface.darker` |
| `midnight-blue.*` | Unknown | `neutral.*` or `surface.*` |
| `nexus.*` | 74+ (in GSAP sections) | `brand.*` colors |
| `gold-*` (old) | Multiple pages | `brand-accent` or semantic colors |

**Found In:**
- `app/globals.css` (CSS variables)
- `app/contact/page.tsx`, `app/famille/page.tsx`, `app/academy/page.tsx`
- GSAP sections: `trinity-services-gsap.tsx`, `korrigo-section-gsap.tsx`

#### **Issue #3: Inconsistent Component Styling**
- Buttons use mix of custom classes (`btn-primary`) and `<Button>` component
- Cards use both `card-dark` utility and `<Card>` component variants
- Badge colors don't follow semantic color system
- Inconsistent border radius (mix of `rounded-xl`, `rounded-2xl`, `rounded-[18px]`)

#### **Issue #4: Typography Inconsistencies**
- Some pages use `font-serif` for headings, others use `font-display`
- Inconsistent heading hierarchy (h1 sizes vary by page)
- Mix of `text-white`, `text-slate-200`, `text-neutral-50`

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-1: Unified Layout System
**Priority:** P0 (Critical)

**Requirement:**
All public pages MUST use a single, consistent header and footer implementation.

**Acceptance Criteria:**
- [ ] Choose ONE header component for all pages (recommend: enhance `CorporateNavbar` for versatility)
- [ ] Choose ONE footer component for all pages (recommend: `CorporateFooter`)
- [ ] Remove or deprecate unused layout components
- [ ] All pages in `app/` use consistent layout pattern
- [ ] Mobile menu works consistently across all pages

**Notes:**
- Dashboard pages (`app/(dashboard)`) may use different layout (out of scope)
- Auth pages may have simplified layout but should follow color scheme

#### FR-2: Design Token Migration
**Priority:** P0 (Critical)

**Requirement:**
All components and pages MUST use design tokens from `globals.css` instead of deprecated color classes.

**Acceptance Criteria:**
- [ ] Replace all `midnight-*` with `surface.*` or `neutral.*`
- [ ] Replace all `nexus.*` with `brand.*`
- [ ] Replace old `gold-*` with `brand-accent` or approved semantic colors
- [ ] Update GSAP sections to use CSS variables instead of hardcoded colors
- [ ] Zero mentions of deprecated colors in `grep` search

**Migration Map:**
```
midnight-950 → surface-darker (#020617 → #050608)
deep-midnight → surface-darker
nexus.dark → surface-dark
nexus.charcoal → surface-card
nexus.cyan → brand-accent
nexus.blue → brand-primary
nexus.red → brand-secondary
gold-400/500/600 → brand-accent (or semantic.warning if context is warning)
```

#### FR-3: Component Standardization
**Priority:** P1 (High)

**Requirement:**
All UI elements MUST use shadcn/ui components from `components/ui/` instead of custom utility classes.

**Acceptance Criteria:**
- [ ] Replace `.btn-primary`, `.btn-secondary` with `<Button>` variants
- [ ] Replace `.card-dark`, `.card-micro` with `<Card>` variants
- [ ] Use `<Badge>` component with semantic variants
- [ ] Standardize border radius using `rounded-card`, `rounded-card-sm`, `rounded-micro`
- [ ] Document approved component patterns in migration guide

**Deprecated Utilities (marked in globals.css):**
- `.btn-primary` → `<Button variant="default">`
- `.btn-secondary` → `<Button variant="outline">`

#### FR-4: Typography Normalization
**Priority:** P1 (High)

**Requirement:**
All pages MUST follow consistent typography hierarchy and font usage.

**Acceptance Criteria:**
- [ ] Headings (h1-h6) use `font-display` (Space Grotesk)
- [ ] Body text uses `font-sans` (Inter)
- [ ] Code/labels use `font-mono` (IBM Plex Mono)
- [ ] Text colors follow accessibility guidelines from globals.css
- [ ] Consistent heading sizes using Tailwind's fluid clamp() sizes

**Typography Scale:**
```
h1: text-4xl md:text-5xl lg:text-6xl (hero contexts)
h2: text-3xl md:text-4xl
h3: text-2xl md:text-3xl
h4: text-xl md:text-2xl
body: text-base
small: text-sm
```

#### FR-5: Spacing & Layout Consistency
**Priority:** P2 (Medium)

**Requirement:**
All pages MUST use consistent spacing scale and layout patterns.

**Acceptance Criteria:**
- [ ] Section padding follows pattern: `py-16 md:py-20 lg:py-24`
- [ ] Container widths use: `max-w-7xl mx-auto px-6`
- [ ] Grid gaps use spacing scale: `gap-4`, `gap-6`, `gap-8`, `gap-12`
- [ ] Consistent card padding using `<Card padding="sm|default|lg">`

### 3.2 Non-Functional Requirements

#### NFR-1: Accessibility
- Maintain WCAG 2.1 AA compliance (documented in globals.css)
- Color contrast ratios preserved during migration
- All interactive elements keyboard accessible

#### NFR-2: Performance
- No increase in bundle size from migration
- Maintain existing GSAP animation performance
- Image optimization preserved

#### NFR-3: Browser Compatibility
- Support modern browsers (Chrome, Firefox, Safari, Edge - latest 2 versions)
- Responsive design works 320px - 2560px viewport widths

---

## 4. Design Decisions

### 4.1 Color Scheme: Dark Theme as Default

**Decision:** Adopt the dark theme (surface-darker background) as the primary design language for all public pages.

**Rationale:**
- Home page already uses dark theme successfully
- Aligns with premium, tech-forward brand positioning
- Better contrast for brand-accent cyan (#2EE9F6)
- Documented in design system with full WCAG compliance

**Impact:**
- Pages using light theme (famille, contact, stages) need background migration
- Footer colors need adjustment
- Benefits: stronger brand identity, reduced eye strain

### 4.2 Header/Footer Selection

**Decision:** Use `CorporateNavbar` and `CorporateFooter` as the standard layout components.

**Rationale:**
- More polished, modern design
- Better mobile UX (fullscreen menu)
- Accessibility features built-in (reduced-motion support)
- Matches dark theme decision

**Migration Required:**
- Pages currently using `Header`/`Footer` (11+ pages)
- Update imports in all affected `page.tsx` files

### 4.3 Brand Colors Finalized

**Decision:** Standardize on these brand colors exclusively:

```typescript
Brand Colors (use these):
- brand-primary: #2563EB (blue) - CTAs, links
- brand-secondary: #EF4444 (red) - accents, warnings
- brand-accent: #2EE9F6 (cyan) - primary CTAs, highlights
- brand-accent-dark: #1BCED4 - hover states

Semantic Colors (functional use):
- success: #10B981
- warning: #F59E0B
- error: #EF4444
- info: #3B82F6
```

**Banned Colors:**
- Do NOT use: `gold-*`, `midnight-*`, `nexus.*`, `blue-300`, `blue-600`

---

## 5. Out of Scope

The following are explicitly OUT OF SCOPE for this task:

- **Dashboard redesign** (`app/(dashboard)/*`) - internal tools may keep existing design
- **Authentication pages** redesign - minimal changes, color alignment only
- **New features** - focus is standardization, not new functionality
- **Content updates** - text/copy changes not included
- **Image asset updates** - except logo if needed for theme consistency
- **Backend/API changes** - purely frontend task
- **A/B testing** - implement single coherent design

---

## 6. Constraints & Assumptions

### 6.1 Constraints
- Must maintain existing functionality (no breaking changes)
- Cannot modify design tokens themselves (they are approved)
- Must preserve GSAP animations and performance
- Timeline: Complete within single sprint (estimate: 3-5 days)

### 6.2 Assumptions
- Design system in `docs/DESIGN_SYSTEM.md` is the source of truth
- Design tokens in `globals.css` and `tailwind.config.mjs` are final
- Radix UI components are correctly implemented
- User testing will happen post-implementation

### 6.3 Dependencies
- None (all design system infrastructure already in place)

---

## 7. User Impact

### 7.1 Affected User Journeys

#### Journey 1: Parent Exploring Services
**Before:** 
- Home page (dark theme) → Contact page (light theme) → jarring transition
- Inconsistent button styles create confusion about clickability

**After:**
- Seamless dark theme throughout
- Consistent CTA styling guides user clearly

#### Journey 2: Student Browsing Stages/Academies
**Before:**
- Stages page uses gold accents, famille page uses blue
- Footer changes between pages

**After:**
- Consistent brand-accent cyan across all pages
- Identical footer creates trust and professionalism

### 7.2 Positive Outcomes
- **Improved brand perception** - premium, cohesive experience
- **Reduced cognitive load** - familiar patterns across pages
- **Increased trust** - professional consistency
- **Better conversion** - clear, consistent CTAs

---

## 8. Clarifications Needed

### Question 1: Dashboard Scope
**Question:** Should dashboard pages (`app/(dashboard)/*`) also be migrated to dark theme?

**Options:**
- A: Yes, unify entire app (more work, full consistency)
- B: No, focus on public pages only (faster, dashboard is internal tool)

**Recommendation:** Option B - Dashboard can remain as-is for this phase. Focus on user-facing pages.

**Decision:** [Pending User Response]

---

### Question 2: Gold Color Replacement
**Question:** Pages using gold colors (famille, stages) - should gold accents become:

**Options:**
- A: `brand-accent` (cyan) - full consistency with home page
- B: `brand-primary` (blue) - softer, more traditional
- C: Keep gold as approved variant for specific use cases

**Recommendation:** Option A - Replace with `brand-accent` for maximum consistency.

**Decision:** [Pending User Response]

---

### Question 3: GSAP Sections Migration Priority
**Question:** 74+ deprecated color usages in GSAP sections - migrate now or later?

**Options:**
- A: Migrate now (comprehensive, may affect animations)
- B: Migrate later (faster rollout, some inconsistency remains)
- C: Create CSS variable aliases (quick fix, maintain compatibility)

**Recommendation:** Option C for this phase - Use CSS variable aliases, then full migration in Phase 2.

**Decision:** [Pending User Response]

---

## 9. Success Metrics

### 9.1 Technical Metrics
- **Zero deprecated color classes** in codebase (verified by grep)
- **Single layout pattern** across all public pages
- **100% component compliance** with shadcn/ui pattern
- **Pass all existing tests** (unit, integration, e2e)

### 9.2 Quality Metrics
- **Visual consistency score:** Manual review checklist 100% pass
- **Accessibility:** Maintain WCAG 2.1 AA compliance
- **Performance:** No regression in Lighthouse scores
- **Code quality:** Pass lint and typecheck without new warnings

### 9.3 Review Checklist
Before marking complete, verify:
- [ ] All pages use CorporateNavbar + CorporateFooter
- [ ] No grep results for: `midnight-`, `nexus-`, old `gold-`
- [ ] All buttons use `<Button>` component
- [ ] All cards use `<Card>` component
- [ ] Typography follows documented hierarchy
- [ ] Spacing follows design system scale
- [ ] Manual review of 10+ representative pages shows consistency
- [ ] E2E tests pass
- [ ] Production build succeeds

---

## 10. Appendices

### Appendix A: Affected Pages Inventory

**Pages Using Light Theme (need migration):**
1. `/famille` - Header + Footer
2. `/contact` - Header + Footer
3. `/stages` - Header + Footer
4. `/offres` - Header + Footer
5. `/equipe` - Header + Footer
6. `/notre-centre` - Header + Footer
7. `/academies-hiver` - Header + Footer
8. `/academy` - Header + Footer
9. `/plateforme-aria` - needs verification
10. `/accompagnement-scolaire` - needs verification
11. `/bilan-gratuit` - needs verification

**Pages Using Dark Theme (verify consistency):**
1. `/` (home) - CorporateNavbar + CorporateFooter ✓

**Dashboard Pages (out of scope):**
- `/dashboard/*`
- `/(dashboard)/*`

**Auth Pages (minimal changes):**
- `/auth/signin`
- `/auth/mot-de-passe-oublie`

### Appendix B: Component Audit

**Layout Components:**
- `components/layout/CorporateNavbar.tsx` - KEEP (primary)
- `components/layout/CorporateFooter.tsx` - KEEP (primary)
- `components/layout/header.tsx` - DEPRECATE (migrate users)
- `components/layout/footer.tsx` - DEPRECATE (migrate users)
- `components/layout/TechNavbar.tsx` - REVIEW (purpose unclear)

**UI Components (shadcn/ui):**
- `components/ui/button.tsx` ✓
- `components/ui/card.tsx` ✓
- `components/ui/badge.tsx` ✓
- All others in `components/ui/` - verified compliant

### Appendix C: Color Migration Reference

**Complete Color Mapping:**
```css
/* REMOVE these classes: */
.bg-midnight-950, .bg-midnight-blue-*, .bg-deep-midnight
.text-midnight-*, .border-midnight-*
.bg-nexus-dark, .bg-nexus-charcoal, .text-nexus-cyan
.text-gold-400, .border-gold-500, .bg-gold-500/10

/* REPLACE with: */
.bg-surface-darker, .bg-surface-dark, .bg-surface-card
.text-white, .text-neutral-200, .text-neutral-400
.border-white/5, .border-white/10
.text-brand-accent, .border-brand-accent
```

**CSS Variable Usage:**
```css
/* Prefer CSS variables in custom styles: */
background: var(--color-surface-darker);
color: var(--color-brand-accent);
border-color: rgb(var(--color-neutral-200));
```

---

## 11. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-06 | AI Agent | Initial PRD created from codebase analysis |

---

**End of Requirements Document**
