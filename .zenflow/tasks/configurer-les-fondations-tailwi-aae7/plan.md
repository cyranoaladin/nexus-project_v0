# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: a1cc7762-0230-4d63-9afb-7c6455ddd166 -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: 37cb00ce-128f-430c-8d92-1c67703019df -->

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
<!-- chat-id: 63842429-446f-435c-9df9-3677888aa600 -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function) or too broad (entire feature).

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

---

## Implementation Steps

### [ ] Step: Create Settings File

Create `.zenflow/settings.json` with complete theme configuration.

**Tasks:**
- [ ] Create `.zenflow/` directory if it doesn't exist
- [ ] Create `settings.json` with theme structure:
  - Brand colors (primary, secondary, accent, accent-dark)
  - Semantic colors (success, warning, error, info)
  - Neutral scale (50-950)
  - Surface colors (dark, darker, card, elevated, hover)
  - Typography (fontFamily, fontSize, fontWeight)
  - Spacing (base, scale array)
  - Radius (micro, card-sm, card, full)
- [ ] Add accessibility section (wcag: "AA", contrastRatios)
- [ ] Source values from `lib/theme/tokens.ts`

**Verification:**
- Valid JSON format (no syntax errors)
- All required sections present
- Color values in valid hex format (#RRGGBB)

**Reference:** spec.md section 3.1

---

### [ ] Step: Update globals.css with CSS Variables

Update `app/globals.css` to define all theme tokens as CSS custom properties.

**Tasks:**
- [ ] Add brand color variables in RGB format to `:root`
  - `--color-brand-primary: 37 99 235;`
  - `--color-brand-secondary: 239 68 68;`
  - `--color-brand-accent: 46 233 246;`
  - `--color-brand-accent-dark: 27 206 212;`
- [ ] Add semantic color variables (success, warning, error, info)
- [ ] Add neutral scale variables (neutral-50 through neutral-950)
- [ ] Add surface color variables (dark, darker, card, elevated, hover)
- [ ] Add spacing scale variables (spacing-0 through spacing-96)
- [ ] Add radius variables (micro, card-sm, card, full)
- [ ] Preserve legacy variables for backward compatibility:
  - `--nexus-*` variables (for GSAP sections)
  - `--deep-midnight` and other deprecated colors
  - shadcn UI HSL variables

**Verification:**
- All variables defined in `:root`
- RGB format: space-separated values (e.g., "37 99 235")
- Legacy variables preserved
- No CSS syntax errors

**Reference:** spec.md section 3.2

---

### [ ] Step: Configure Tailwind @theme Directive

Update `app/globals.css` to expose CSS variables to Tailwind utilities using `@theme inline`.

**Tasks:**
- [ ] Map brand colors to Tailwind utilities:
  - `--color-brand-primary: rgb(var(--color-brand-primary));`
  - `--color-brand-secondary: rgb(var(--color-brand-secondary));`
  - `--color-brand-accent: rgb(var(--color-brand-accent));`
  - `--color-brand-accent-dark: rgb(var(--color-brand-accent-dark));`
- [ ] Map semantic colors (success, warning, error, info)
- [ ] Map neutral scale (neutral-50 through neutral-950)
- [ ] Map surface colors (dark, darker, card, elevated, hover)
- [ ] Map font families:
  - `--font-sans: var(--font-inter), Inter, system-ui, sans-serif;`
  - `--font-display: var(--font-space), "Space Grotesk", sans-serif;`
  - `--font-mono: var(--font-mono), "IBM Plex Mono", monospace;`

**Verification:**
- `@theme inline` block properly formatted
- Colors use `rgb(var(--color-*))` format for opacity support
- Font families reference Next.js font variables
- Build succeeds: `npm run build`

**Reference:** spec.md section 3.2

---

### [ ] Step: Verify Root Layout Integration

Verify that `app/layout.tsx` correctly applies the new theme.

**Tasks:**
- [ ] Read current `app/layout.tsx` implementation
- [ ] Verify body className uses theme utilities:
  - Background color (bg-neutral-950 or bg-surface-dark)
  - Text color (text-white or text-neutral-50)
  - Font family (font-sans)
  - Selection highlight (selection:bg-brand-primary/30 or selection:bg-brand-accent/30)
- [ ] Verify font variables are applied correctly
- [ ] Test that opacity modifiers work (e.g., bg-brand-primary/30)
- [ ] Visual inspection: run dev server and check homepage

**Verification:**
- No changes needed to layout.tsx (only verification)
- Dev server runs without errors: `npm run dev`
- Homepage renders with correct theme colors
- Font families load correctly

**Reference:** spec.md section 3.3

---

### [ ] Step: Create Theme Test Suite Structure

Create `__tests__/ui/theme.test.ts` with basic test structure and settings file validation.

**Tasks:**
- [ ] Create `__tests__/ui/` directory if it doesn't exist
- [ ] Create `theme.test.ts` file
- [ ] Add imports (Jest, fs, path, designTokens from lib/theme/tokens)
- [ ] Implement "Settings File" test group:
  - Test: settings.json exists and is valid JSON
  - Test: all required theme sections present (colors, typography, spacing, radius)
  - Test: all required color subsections (brand, semantic, neutral, surface)
  - Test: color values are valid hex codes (#RRGGBB format)
  - Test: accessibility section has wcag and contrastRatios

**Verification:**
- Tests run successfully: `npm run test:unit -- __tests__/ui/theme.test.ts`
- All settings file tests pass

**Reference:** spec.md section 3.5, requirements.md section 2.4.1

---

### [ ] Step: Implement CSS Variables Injection Tests

Add tests to verify CSS variables are correctly injected in `:root`.

**Tasks:**
- [ ] Add "CSS Variables Injection" test group
- [ ] Implement test setup: mock document.documentElement with CSS variables
- [ ] Test: brand color variables in RGB format
  - Verify --color-brand-primary, --color-brand-secondary, --color-brand-accent, --color-brand-accent-dark
- [ ] Test: semantic color variables (success, warning, error, info)
- [ ] Test: all neutral scale variables (neutral-50 through neutral-950)
- [ ] Test: surface color variables (dark, darker, card, elevated, hover)
- [ ] Test: spacing scale variables (spacing-0 through spacing-96)
- [ ] Test: radius variables (micro, card-sm, card, full)
- [ ] Test: font family variables (--font-sans, --font-display, --font-mono)

**Verification:**
- All CSS variable tests pass
- Tests verify RGB format (space-separated values)
- Tests run: `npm run test:unit -- __tests__/ui/theme.test.ts`

**Reference:** spec.md section 3.5

---

### [ ] Step: Implement WCAG Accessibility Tests

Add tests to verify WCAG 2.1 AA contrast ratio compliance.

**Tasks:**
- [ ] Implement contrast ratio calculation utility:
  - Convert hex to RGB
  - Calculate relative luminance
  - Calculate contrast ratio formula
- [ ] Add "WCAG Accessibility Compliance" test group
- [ ] Test: white text on surface-dark (≥4.5:1)
- [ ] Test: neutral-200 on surface-card (≥4.5:1)
- [ ] Test: brand-accent on surface-dark (≥4.5:1)
- [ ] Test: brand-primary on white background (≥4.5:1)
- [ ] Test: semantic colors on dark backgrounds:
  - success (#10B981) on surface-dark
  - warning (#F59E0B) on surface-dark
  - error (#EF4444) on surface-dark
  - info (#3B82F6) on surface-dark
- [ ] Test: large text combinations (≥3:1)

**Verification:**
- All WCAG tests pass
- Contrast ratios meet AA standards
- Tests run: `npm run test:unit -- __tests__/ui/theme.test.ts`

**Reference:** spec.md section 3.5, requirements.md section 2.5.1

---

### [ ] Step: Implement Backward Compatibility Tests

Add tests to ensure deprecated variables are preserved.

**Tasks:**
- [ ] Add "Backward Compatibility" test group
- [ ] Test: legacy nexus CSS variables exist
  - --nexus-dark, --nexus-charcoal, --nexus-cyan, etc.
- [ ] Test: shadcn UI HSL variables preserved
  - --primary, --background, --foreground, etc.
- [ ] Test: deep-midnight color available
- [ ] Verify GSAP sections still have required variables

**Verification:**
- All backward compatibility tests pass
- Legacy variables accessible
- Tests run: `npm run test:unit -- __tests__/ui/theme.test.ts`

**Reference:** spec.md section 3.5

---

### [ ] Step: Document WCAG Color Pairings

Calculate and document approved color combinations with contrast ratios.

**Tasks:**
- [ ] Calculate contrast ratios for all primary text/background combinations
- [ ] Create documentation comment block in `app/globals.css`:
  - List approved color pairings
  - Show contrast ratios
  - Mark combinations that meet AA/AAA standards
- [ ] Add inline comments for accessibility notes
- [ ] If any combination fails, adjust color lightness
- [ ] Update settings.json if colors are adjusted

**Verification:**
- All documented combinations meet WCAG AA (≥4.5:1 normal text, ≥3:1 large text)
- Documentation clear and accurate
- No contrast failures in tests

**Reference:** spec.md Phase 3, requirements.md section 2.5.1

---

### [ ] Step: Run Full Test Suite

Execute all tests to ensure theme implementation is complete.

**Tasks:**
- [ ] Run unit tests: `npm run test:unit`
- [ ] Verify all theme tests pass
- [ ] Check test coverage >90% for theme files
- [ ] Review any failing tests and fix issues

**Verification:**
- ✅ All tests passing
- ✅ Coverage ≥90%
- ✅ No test failures or warnings

**Reference:** spec.md section 6.1

---

### [ ] Step: Run Lint and TypeCheck

Verify code quality and type safety.

**Tasks:**
- [ ] Run linter: `npm run lint`
- [ ] Fix any lint errors
- [ ] Run TypeScript check: `npm run typecheck`
- [ ] Fix any type errors

**Verification:**
- ✅ 0 lint errors
- ✅ 0 TypeScript errors
- ✅ No warnings

**Reference:** spec.md section 6.3

---

### [ ] Step: Build and Verify Bundle Size

Build production bundle and verify CSS size impact.

**Tasks:**
- [ ] Measure current CSS bundle size: `npm run build && du -h .next/static/css/*.css`
- [ ] Run production build: `npm run build`
- [ ] Measure new CSS bundle size
- [ ] Calculate delta (should be <10KB)
- [ ] Verify build succeeds without warnings

**Verification:**
- ✅ Build succeeds
- ✅ CSS bundle size increase <10KB
- ✅ No build warnings or errors

**Reference:** spec.md section 6.3, section 9.1

---

### [ ] Step: Visual Inspection and Final Verification

Perform manual visual inspection and final checks.

**Tasks:**
- [ ] Start dev server: `npm run dev`
- [ ] Inspect homepage:
  - Colors render correctly
  - Typography displays properly (font families, sizes)
  - Spacing is consistent
  - Selection highlight works
  - Hover states function
- [ ] Check browser DevTools:
  - CSS variables present in `:root`
  - RGB format correct (space-separated)
  - Font variables loaded
  - Opacity modifiers work (test bg-brand-primary/50)
- [ ] Test GSAP sections (if any) still work
- [ ] Run Lighthouse accessibility audit (target: 100)
- [ ] Check reduced motion support in globals.css

**Verification:**
- ✅ All pages render correctly
- ✅ No visual regressions
- ✅ DevTools show correct CSS variables
- ✅ Lighthouse accessibility: 100
- ✅ Existing functionality preserved

**Reference:** spec.md section 6.2, 6.4

---

### [ ] Step: Update Plan and Mark Complete

Update plan.md with completion status and results.

**Tasks:**
- [ ] Mark all implementation steps as completed [x]
- [ ] Add verification results summary
- [ ] Document any issues encountered and resolutions
- [ ] Note CSS bundle size delta
- [ ] Record test coverage percentage
- [ ] Add any recommendations for future improvements

**Verification:**
- ✅ Plan.md updated
- ✅ All checkboxes marked
- ✅ Results documented

**Reference:** spec.md section 5, Phase 4
