# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: 21d55213-3f25-4c13-9577-32ef9d283588 -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: 2e7c5ebf-e763-46c0-abfe-cd90b8cfb502 -->

Create a technical specification based on the PRD in `{@artifacts_path}/requirements.md`.

1. Review existing codebase architecture and identify reusable components
2. Define the implementation approach

Save to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach referencing existing code patterns
- Source code structure changes
- Data model / API / interface changes
- Delivery phases (incremental, testable milestones)
- Verification approach using project lint/test commands

### [x] Step: Planning
<!-- chat-id: a3c01de9-5a2a-4924-8af5-ac1db39b3ab9 -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function) or too broad (entire feature).

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

### [x] Step: Foundation & Setup
<!-- chat-id: f00cc682-bb7c-4d47-9a1e-e653ab9d2570 -->

Establish baseline and create migration inventory.

**Tasks:**
- [x] Run full test suite to capture baseline state
- [x] Create MIGRATION_LOG.md with page-by-page checklist
- [x] Document current state: take screenshots of all 15+ public pages
- [x] Create color migration reference map (deprecated → new tokens)
- [x] Verify all design system infrastructure is in place

**Deliverables:**
- MIGRATION_LOG.md with inventory of all pages
- Baseline test results documented
- Visual baseline screenshots stored

**Verification:**
```bash
npm run verify:quick  # All tests pass
# Verify MIGRATION_LOG.md exists with complete page inventory
```

---

### [x] Step: Layout Unification - High Priority Pages
<!-- chat-id: 3e074507-d2fe-4d6b-9485-25e5a5a8b1d0 -->

Migrate high-priority pages (famille, contact, bilan-gratuit) to CorporateNavbar/CorporateFooter.

**Pages to migrate:**
- app/famille/page.tsx
- app/contact/page.tsx  
- app/bilan-gratuit/page.tsx

**For each page:**
- [ ] Update imports: Header/Footer → CorporateNavbar/CorporateFooter
- [ ] Change main background: white → surface-darker
- [ ] Update text colors for dark theme readability
- [ ] Test navigation and mobile menu
- [ ] Verify responsive behavior (mobile, tablet, desktop)

**Verification per page:**
```bash
npm run lint
npm run typecheck
# Manual: Test navigation flow
# Manual: Verify mobile menu opens/closes
# Manual: Check responsive breakpoints
```

---

### [x] Step: Layout Unification - Medium Priority Pages
<!-- chat-id: 5bca9092-4054-4fb8-bcf1-e684619464f9 -->

Migrate medium-priority pages (stages, offres, equipe, notre-centre) to unified layout.

**Pages to migrate:**
- app/stages/page.tsx
- app/offres/page.tsx
- app/equipe/page.tsx
- app/notre-centre/page.tsx

**For each page:**
- [ ] Update imports: Header/Footer → CorporateNavbar/CorporateFooter
- [ ] Change main background to surface-darker
- [ ] Adjust card and section backgrounds for dark theme
- [ ] Update text colors for contrast
- [ ] Test all page functionality

**Verification:**
```bash
npm run verify:quick
# Manual: Visual review of all 4 pages
# Manual: Test navigation consistency
```

---

### [x] Step: Layout Unification - Remaining Pages
<!-- chat-id: f788c3e1-1df8-4373-87fb-496f9e47acb7 -->

Complete layout migration for remaining public pages.

**Pages to migrate:**
- app/plateforme/page.tsx
- app/plateforme-aria/page.tsx
- app/academies-hiver/page.tsx
- app/mentions-legales/page.tsx (review TechNavbar usage)

**For each page:**
- [ ] Migrate to CorporateNavbar/CorporateFooter (or document exception for mentions-legales)
- [ ] Update theme to dark
- [ ] Test functionality
- [ ] Verify mobile responsiveness

**Verification:**
```bash
npm run lint
npm run typecheck
# Confirm all public pages use unified layout
```

---

### [ ] Step: Color Migration - Page Components
<!-- chat-id: a8f14f5a-633c-4a16-a77c-d58ddfc469f5 -->

Replace deprecated color classes in all page files.

**Files to migrate (8 priority files):**
- app/contact/page.tsx (13 usages)
- app/famille/page.tsx (32 usages)
- app/academy/page.tsx (14 usages)
- app/offres/page.tsx (43 usages)
- app/equipe/page.tsx (38 usages)
- app/notre-centre/page.tsx (18 usages)
- app/studio/page.tsx (12 usages)
- app/consulting/page.tsx (17 usages)

**Migration map:**
- `midnight-950`, `deep-midnight` → `surface-darker`
- `midnight-blue-*` → `neutral-*` or `surface-*`
- `nexus-cyan` → `brand-accent`
- `nexus-dark` → `surface-dark`
- `nexus-charcoal` → `surface-card`
- `gold-400/500/600` → `brand-accent`

**Verification:**
```bash
# Confirm zero deprecated color usage in pages
grep -r "midnight-" app/
grep -r "nexus\." app/
grep -r "gold-[456]" app/
# Should return no results

npm run verify:quick
```

---

### [ ] Step: Color Migration - GSAP Sections
<!-- chat-id: a90ba6ed-c744-496b-8b0e-20f19205e666 -->

Update GSAP sections to use CSS variables instead of hardcoded colors.

**Files to migrate (8 GSAP sections):**
- components/sections/hero-section.tsx
- components/sections/trinity-services-gsap.tsx
- components/sections/korrigo-section-gsap.tsx
- components/sections/proof-section-gsap.tsx
- components/sections/offer-section-gsap.tsx
- components/sections/business-model-section.tsx
- components/sections/comparison-table-section.tsx
- components/sections/micro-engagement-section.tsx

**Pattern:**
- Replace hardcoded hex colors with `var(--color-brand-accent)`, etc.
- Test animations still work smoothly
- Verify reduced-motion fallbacks

**Add CSS variable aliases to globals.css:**
```css
--nexus-cyan-rgb: var(--color-brand-accent);
--nexus-dark-rgb: var(--color-surface-dark);
```

**Verification:**
```bash
npm run verify:quick
# Manual: Test all GSAP animations on home page
# Manual: Verify 60fps performance
# Manual: Test reduced-motion mode
```

---

### [ ] Step: Component Standardization - Buttons & Cards
<!-- chat-id: ad5ba326-8994-4cfa-9303-c55c353ebd09 -->

Replace utility classes with shadcn/ui components.

**Tasks:**
- [ ] Find and replace all `.btn-primary` with `<Button variant="default">`
- [ ] Find and replace all `.btn-secondary` with `<Button variant="outline">`
- [ ] Find and replace all `.card-dark` with `<Card variant="default">`
- [ ] Find and replace all `.card-micro` with `<Card variant="default" padding="sm">`
- [ ] Update any custom label utilities to use `<Badge>` component

**Verification:**
```bash
# Confirm zero deprecated utilities
grep -r "btn-primary\|btn-secondary" app/ components/
grep -r "card-dark\|card-micro" app/ components/
# Should return no results (except globals.css comments)

npm run lint
npm run typecheck
npm run test:unit
```

---

### [ ] Step: Typography & Spacing Standardization
<!-- chat-id: 7a438104-272d-46a9-8152-03228eb17504 -->

Ensure consistent typography and spacing across all pages.

**Typography tasks:**
- [ ] Verify all headings (h1-h6) use `font-display` (Space Grotesk)
- [ ] Verify body text uses `font-sans` (Inter)
- [ ] Verify code/labels use `font-mono` (IBM Plex Mono)
- [ ] Standardize heading sizes using responsive scale
- [ ] Ensure text colors follow accessibility guidelines

**Spacing tasks:**
- [ ] Standardize section padding: `py-16 md:py-20 lg:py-24`
- [ ] Standardize container widths: `max-w-7xl mx-auto px-6`
- [ ] Standardize grid gaps: `gap-4`, `gap-6`, `gap-8`, `gap-12`
- [ ] Ensure consistent card padding

**Verification:**
```bash
npm run verify:quick
# Manual: Visual review of typography hierarchy on 5+ pages
# Manual: Check spacing consistency across pages
```

---

### [ ] Step: Final Verification & Quality Assurance

Comprehensive testing and quality assurance.

**Visual review:**
- [ ] Manually review all 15+ public pages
- [ ] Compare against baseline screenshots
- [ ] Check responsive breakpoints (320px, 768px, 1024px, 1920px)
- [ ] Verify dark theme consistency across all pages

**Accessibility audit:**
- [ ] Test keyboard navigation (Tab, Enter, Esc)
- [ ] Verify color contrast ratios (WCAG 2.1 AA)
- [ ] Test screen reader compatibility
- [ ] Test reduced-motion support

**Performance testing:**
- [ ] Run Lighthouse on key pages (/, /contact, /famille)
- [ ] Compare scores to baseline (Performance ≥85, Accessibility ≥95)
- [ ] Verify no bundle size increase
- [ ] Test GSAP animation performance (60fps)

**E2E testing:**
```bash
npm run test:e2e  # Full Playwright suite
```

**Production build:**
```bash
npm run build
npm run start  # Test production mode locally
```

**Final checklist verification:**
- [ ] All pages use CorporateNavbar + CorporateFooter
- [ ] Zero deprecated colors: `grep -r "midnight-" app/ components/` returns nothing
- [ ] Zero deprecated utilities: `grep -r "btn-primary" app/ components/` returns nothing
- [ ] All tests pass: `npm run verify:quick`
- [ ] Lighthouse scores meet targets

**Documentation:**
- [ ] Update MIGRATION_LOG.md with final status
- [ ] Create MIGRATION_COMPLETE.md report
- [ ] Update docs/DESIGN_SYSTEM.md (mark deprecated colors as removed)

---

### [ ] Step: Cleanup & Deprecation

Remove deprecated code and finalize documentation.

**Remove deprecated files:**
```bash
# After confirming zero usage:
rm components/layout/header.tsx
rm components/layout/footer.tsx
```

**Remove deprecated utilities from globals.css:**
- [ ] Remove `.btn-primary`, `.btn-secondary` utilities
- [ ] Remove `.card-dark`, `.card-micro` utilities
- [ ] Remove CSS variable aliases for GSAP (if no longer needed)
- [ ] Clean up TODOs and migration comments

**Remove deprecated colors from tailwind.config.mjs:**
- [ ] Remove `midnight-blue` colors
- [ ] Remove `deep-midnight`
- [ ] Remove `nexus` colors (if deprecated)
- [ ] Update comments to reflect migration complete

**Final documentation:**
- [ ] Update MIGRATION_LOG.md with completion timestamp
- [ ] Create release notes summarizing changes
- [ ] Update README.md if needed
- [ ] Archive migration artifacts

**Final verification:**
```bash
npm run verify:quick  # Final sanity check
npm run build         # Confirm production build succeeds
```

**Deliverables:**
- Clean codebase with no deprecated code
- Complete migration documentation
- Production-ready build
