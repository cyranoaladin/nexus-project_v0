# Technical Specification: Tailwind CSS v4 Theme Foundations

**Version:** 1.0  
**Date:** 2026-02-02  
**Status:** Ready for Implementation

---

## 1. Technical Context

### 1.1 Technology Stack

- **Framework:** Next.js 15.5.11 (App Router)
- **Language:** TypeScript 5
- **CSS Framework:** Tailwind CSS v4.1.18 with @tailwindcss/postcss v4
- **Build System:** PostCSS (postcss.config.mjs)
- **Testing:** Jest 29.7.0 + @testing-library/react 14.3.1
- **Font Loading:** Next.js Font Optimization (Inter, Space Grotesk, IBM Plex Mono)

### 1.2 Current Architecture

```
┌─────────────────────────────────────────────────────────┐
│              .zenflow/settings.json (NEW)               │
│           Single source of truth for theme               │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│            lib/theme/tokens.ts (EXISTING)               │
│        TypeScript design tokens with types              │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ├──────────────────┬────────────────────┐
                  ▼                  ▼                    ▼
         ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
         │ globals.css  │   │tailwind.config│   │ Components   │
         │  @theme      │   │   .mjs       │   │  (React)     │
         │  directive   │   │              │   │              │
         └──────────────┘   └──────────────┘   └──────────────┘
```

### 1.3 Tailwind v4 Changes

**Key Differences from v3:**
- CSS-first configuration using `@theme` directive
- Native CSS custom properties support
- Simplified color format (RGB for opacity modifiers)
- Inline theme definition in CSS files
- No JavaScript config required (but still supported)

---

## 2. Implementation Approach

### 2.1 Settings File Design

**File:** `.zenflow/settings.json`

**Purpose:** Central configuration file for theme values that can be:
- Version controlled
- Validated with JSON schema
- Referenced by build scripts
- Consumed by multiple tools

**Structure:**
```json
{
  "theme": {
    "colors": { ... },
    "typography": { ... },
    "spacing": { ... },
    "radius": { ... }
  },
  "accessibility": {
    "wcag": "AA",
    "contrastRatios": { ... }
  }
}
```

**Implementation Notes:**
- Values sourced from existing `lib/theme/tokens.ts`
- JSON format for portability
- No runtime imports (settings → tokens → CSS flow)

---

### 2.2 CSS Custom Properties Strategy

**File:** `app/globals.css`

**Approach:** Use Tailwind v4's `@theme` directive with CSS variables

#### 2.2.1 Color Format Convention

**RGB Format for Opacity Modifiers:**
```css
:root {
  /* RGB format (space-separated) */
  --color-brand-primary: 37 99 235;
  --color-brand-accent: 46 233 246;
}

@theme {
  /* Tailwind utility mapping */
  --color-brand-primary: rgb(var(--color-brand-primary));
  --color-brand-accent: rgb(var(--color-brand-accent));
}
```

**Usage in Components:**
```tsx
<div className="bg-brand-primary">       {/* Solid color */}
<div className="bg-brand-primary/50">    {/* 50% opacity */}
<div className="text-brand-accent/80">   {/* 80% opacity */}
```

#### 2.2.2 Variable Naming Convention

**Pattern:** `--{category}-{subcategory}-{name}`

Examples:
- `--color-brand-primary`
- `--color-surface-dark`
- `--font-sans`
- `--spacing-4`
- `--radius-card`

**Rationale:** Clear namespace, autocomplete-friendly, collision-resistant

---

### 2.3 Typography Configuration

#### 2.3.1 Font Family Setup

**Current State (app/layout.tsx):**
```tsx
const inter = Inter({ variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space" });
const ibmPlexMono = IBM_Plex_Mono({ variable: "--font-mono" });
```

**CSS Integration:**
```css
@theme {
  --font-sans: var(--font-inter), Inter, system-ui, sans-serif;
  --font-display: var(--font-space), "Space Grotesk", sans-serif;
  --font-mono: var(--font-mono), "IBM Plex Mono", monospace;
}
```

**No Changes Required:** Font loading already optimized in layout.tsx

#### 2.3.2 Font Size Strategy

**Dual Approach:**

1. **Fixed Sizes (Application UI):**
   - `text-xs` → 0.75rem
   - `text-sm` → 0.875rem
   - `text-base` → 1rem
   - ... up to `text-6xl`

2. **Responsive Sizes (Marketing Pages):**
   - `text-hero` → clamp(2.75rem, 5vw, 4.75rem)
   - `text-h2` → clamp(2.125rem, 3.6vw, 3.5rem)
   - Already defined in tailwind.config.mjs

**Implementation:** Extend existing configuration, no breaking changes

---

### 2.4 Spacing & Radius

#### 2.4.1 Spacing Scale

**Source:** `lib/theme/tokens.ts` spacing object

**Mapping:**
- Tailwind utility: `p-4` → CSS variable: `--spacing-4` → Value: `1rem`
- Custom utilities preserved: `section-spacing`, `card-spacing`

#### 2.4.2 Border Radius

**Current Values (tailwind.config.mjs):**
- `rounded-micro` → 10px
- `rounded-card-sm` → 14px
- `rounded-card` → 18px
- `rounded-full` → 9999px

**Action:** Map to CSS variables for consistency

---

## 3. Source Code Changes

### 3.1 File: `.zenflow/settings.json` (CREATE)

**Location:** Project root `.zenflow/` directory

**Content Source:** Values from `lib/theme/tokens.ts`

**Schema:**
```typescript
interface SettingsSchema {
  theme: {
    colors: {
      brand: Record<string, string>;
      semantic: Record<string, string>;
      neutral: Record<string, string>;
      surface: Record<string, string>;
    };
    typography: {
      fontFamily: Record<string, string>;
      fontSize: Record<string, string>;
      fontWeight: Record<string, string>;
    };
    spacing: {
      base: string;
      scale: number[];
    };
    radius: Record<string, string>;
  };
  accessibility: {
    wcag: "AA" | "AAA";
    contrastRatios: {
      normalText: number;
      largeText: number;
    };
  };
}
```

**Validation:** JSON schema validation in tests

---

### 3.2 File: `app/globals.css` (UPDATE)

**Changes Required:**

1. **Expand `:root` CSS Variables**
   - Add all color tokens in RGB format
   - Add semantic colors
   - Add neutral scale (50-950)
   - Add surface colors
   - Add spacing variables
   - Add radius variables

2. **Update `@theme inline` Directive**
   - Map all CSS variables to Tailwind utilities
   - Ensure color format: `rgb(var(--color-*))`
   - Add font family mappings
   - Add spacing scale

3. **Preserve Existing**
   - Keep legacy `--nexus-*` variables for GSAP compatibility
   - Maintain shadcn UI HSL variables
   - Keep deprecated `deep-midnight` color

**Example Structure:**
```css
:root {
  /* Brand Colors (RGB format) */
  --color-brand-primary: 37 99 235;
  --color-brand-secondary: 239 68 68;
  --color-brand-accent: 46 233 246;
  --color-brand-accent-dark: 27 206 212;

  /* Semantic Colors (RGB format) */
  --color-success: 16 185 129;
  --color-warning: 245 158 11;
  --color-error: 239 68 68;
  --color-info: 59 130 246;

  /* Neutral Scale (RGB format) */
  --color-neutral-50: 249 250 251;
  --color-neutral-100: 243 244 246;
  /* ... 200-900 ... */
  --color-neutral-950: 11 12 16;

  /* Surface Colors (RGB format) */
  --color-surface-dark: 11 12 16;
  --color-surface-darker: 5 6 8;
  --color-surface-card: 17 19 24;
  --color-surface-elevated: 26 29 35;
  --color-surface-hover: 31 35 41;

  /* Spacing Scale */
  --spacing-0: 0px;
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  /* ... continue scale ... */

  /* Border Radius */
  --radius-micro: 10px;
  --radius-card-sm: 14px;
  --radius-card: 18px;
  --radius-full: 9999px;

  /* Legacy variables (preserve for backward compatibility) */
  --nexus-dark: #0B0C10;
  --nexus-charcoal: #111318;
  --nexus-cyan: #2EE9F6;
  /* ... */
}

@theme inline {
  /* Brand Colors */
  --color-brand-primary: rgb(var(--color-brand-primary));
  --color-brand-secondary: rgb(var(--color-brand-secondary));
  --color-brand-accent: rgb(var(--color-brand-accent));
  
  /* Semantic Colors */
  --color-success: rgb(var(--color-success));
  --color-warning: rgb(var(--color-warning));
  --color-error: rgb(var(--color-error));
  --color-info: rgb(var(--color-info));

  /* Neutral Scale */
  --color-neutral-50: rgb(var(--color-neutral-50));
  /* ... 100-950 ... */

  /* Surface Colors */
  --color-surface-dark: rgb(var(--color-surface-dark));
  --color-surface-darker: rgb(var(--color-surface-darker));
  --color-surface-card: rgb(var(--color-surface-card));
  --color-surface-elevated: rgb(var(--color-surface-elevated));

  /* Font Families */
  --font-sans: var(--font-inter), Inter, system-ui, sans-serif;
  --font-display: var(--font-space), "Space Grotesk", sans-serif;
  --font-mono: var(--font-mono), "IBM Plex Mono", monospace;
}
```

**Backward Compatibility:**
- Existing `@layer base` styles preserved
- Deprecated colors still available
- GSAP sections unchanged
- Shadcn UI variables maintained

---

### 3.3 File: `app/layout.tsx` (VERIFY - NO CHANGES)

**Current Implementation:**
```tsx
<body className={`${inter.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable} antialiased bg-neutral-950 text-white font-sans selection:bg-brand-primary/30 selection:text-white`}>
```

**Verification:**
- ✅ Font variables correctly applied
- ✅ `bg-neutral-950` maps to new CSS variable
- ✅ `selection:bg-brand-primary/30` uses opacity modifier
- ✅ No changes required

**Test:** Visual inspection + computed styles check

---

### 3.4 File: `tailwind.config.mjs` (NO CHANGES)

**Current State:**
- Already extends theme with colors from `lib/theme/tokens.ts`
- Has custom fontSize with clamp()
- Has borderRadius values
- Has animations and keyframes

**Decision:** Keep existing configuration
- Tailwind v4 merges `@theme` with config file
- No conflicts with CSS-first approach
- JavaScript config provides type safety for IDEs

---

### 3.5 File: `__tests__/ui/theme.test.ts` (CREATE)

**Location:** `__tests__/ui/theme.test.ts`

**Test Structure:**
```typescript
import { describe, it, expect } from '@jest/globals';
import { designTokens } from '@/lib/theme/tokens';
import fs from 'fs';
import path from 'path';

describe('Tailwind v4 Theme Configuration', () => {
  describe('Settings File', () => {
    it('should exist at .zenflow/settings.json', () => {
      // Verify file exists and is valid JSON
    });

    it('should have all required theme sections', () => {
      // Verify structure matches schema
    });

    it('should have valid color hex codes', () => {
      // Regex validation for #RRGGBB format
    });
  });

  describe('CSS Variables Injection', () => {
    beforeEach(() => {
      // Setup: Create test DOM with CSS variables
      document.documentElement.style.setProperty('--color-brand-primary', '37 99 235');
      // ... set all variables
    });

    it('should inject brand color variables in RGB format', () => {
      const primary = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-brand-primary').trim();
      expect(primary).toBe('37 99 235');
    });

    it('should inject all neutral scale variables', () => {
      // Test neutral-50 through neutral-950
    });

    it('should inject surface color variables', () => {
      // Test surface-dark, surface-card, etc.
    });

    it('should inject semantic color variables', () => {
      // Test success, warning, error, info
    });

    it('should inject spacing scale variables', () => {
      // Test spacing-1 through spacing-96
    });

    it('should inject radius variables', () => {
      // Test radius-micro, radius-card, etc.
    });

    it('should inject font family variables', () => {
      // Test --font-sans, --font-display, --font-mono
    });
  });

  describe('Tailwind Utility Classes', () => {
    it('should generate color utilities', () => {
      // Test bg-brand-primary, text-brand-accent, etc.
      // Using jsdom + Tailwind CSS engine
    });

    it('should support opacity modifiers', () => {
      // Test bg-brand-primary/50, text-brand-accent/80
    });

    it('should generate spacing utilities', () => {
      // Test p-4, m-8, gap-6
    });

    it('should generate typography utilities', () => {
      // Test text-base, font-sans, font-display
    });
  });

  describe('WCAG Accessibility Compliance', () => {
    // Helper function to calculate contrast ratio
    function getContrastRatio(color1: string, color2: string): number {
      // Implementation using relative luminance formula
    }

    it('should meet AA contrast for white text on surface-dark', () => {
      const ratio = getContrastRatio('#FFFFFF', '#0B0C10');
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('should meet AA contrast for brand-accent on surface-dark', () => {
      const ratio = getContrastRatio('#2EE9F6', '#0B0C10');
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('should meet AA contrast for neutral-200 on surface-card', () => {
      const ratio = getContrastRatio('#E5E7EB', '#111318');
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('should meet AA contrast for semantic colors on dark backgrounds', () => {
      // Test success, warning, error, info
    });

    it('should meet minimum 3:1 for large text combinations', () => {
      // Test 18px+ text on various backgrounds
    });
  });

  describe('Backward Compatibility', () => {
    it('should preserve legacy nexus CSS variables', () => {
      // Test --nexus-dark, --nexus-cyan still exist
    });

    it('should preserve shadcn UI HSL variables', () => {
      // Test --primary, --background, etc.
    });

    it('should preserve deep-midnight color', () => {
      // Verify deprecated color still available
    });
  });
});
```

**Dependencies:**
- Jest + jsdom (already installed)
- @testing-library/react (for DOM utilities)
- Custom contrast calculation utility

**Test Execution:**
```bash
npm run test:unit -- __tests__/ui/theme.test.ts
```

---

## 4. Data Model / API / Interface Changes

### 4.1 No Database Changes

This task involves only frontend theme configuration. No Prisma schema or API changes required.

### 4.2 TypeScript Type Updates

**File:** `lib/theme/tokens.ts`

**Existing Types:** Already has type exports
```typescript
export type ColorToken = keyof typeof designTokens.colors;
export type BrandColor = keyof typeof designTokens.colors.brand;
// ... etc
```

**New Types (optional):**
```typescript
// Type-safe CSS variable names
export type CSSColorVariable = 
  | `--color-brand-${BrandColor}`
  | `--color-semantic-${SemanticColor}`
  | `--color-neutral-${NeutralColor}`
  | `--color-surface-${SurfaceColor}`;

// Type-safe Tailwind class names
export type TailwindColorClass =
  | `bg-brand-${BrandColor}`
  | `text-brand-${BrandColor}`
  | `border-brand-${BrandColor}`;
```

**Decision:** Add if requested, but not required for MVP

---

## 5. Delivery Phases

### Phase 1: Foundation Setup (Priority: P0)
**Deliverables:**
1. Create `.zenflow/settings.json` with complete theme configuration
2. Update `app/globals.css` with CSS variables and `@theme` directive
3. Verify `app/layout.tsx` applies theme correctly (no changes needed)

**Verification:**
- Settings file valid JSON
- CSS variables present in `:root`
- App renders without errors
- `npm run build` succeeds

**Estimated Time:** 2-3 hours

---

### Phase 2: Test Suite Development (Priority: P0)
**Deliverables:**
1. Create `__tests__/ui/theme.test.ts`
2. Implement all test cases:
   - Settings file validation
   - CSS variables injection
   - Tailwind utility classes
   - WCAG accessibility compliance
   - Backward compatibility

**Verification:**
- All tests passing
- Coverage >90%
- `npm run test:unit` succeeds

**Estimated Time:** 3-4 hours

---

### Phase 3: WCAG Validation (Priority: P0)
**Deliverables:**
1. Calculate contrast ratios for all color combinations
2. Document approved color pairings
3. Add comments in CSS for accessibility notes
4. Implement contrast calculation utility for tests

**Verification:**
- All WCAG tests passing
- Documentation updated
- Lighthouse accessibility score 100

**Estimated Time:** 1.5-2 hours

---

### Phase 4: Final Verification (Priority: P0)
**Deliverables:**
1. Run full test suite
2. Run lint and typecheck
3. Build production bundle
4. Visual inspection of existing pages
5. Update plan.md with completion status

**Verification Commands:**
```bash
npm run lint
npm run typecheck
npm run test:unit -- __tests__/ui/theme.test.ts
npm run build
```

**Acceptance Criteria:**
- ✅ All tests passing
- ✅ No TypeScript errors
- ✅ No lint errors
- ✅ Build succeeds
- ✅ Existing pages render correctly
- ✅ CSS bundle size increase <10KB

**Estimated Time:** 1 hour

---

## 6. Verification Approach

### 6.1 Automated Testing

**Test Categories:**
1. **Unit Tests:** CSS variable presence, value correctness
2. **Integration Tests:** Tailwind utilities generation
3. **Accessibility Tests:** WCAG contrast ratio validation
4. **Schema Tests:** Settings file structure validation

**Tools:**
- Jest + jsdom
- @testing-library/react
- Custom contrast calculation
- JSON schema validator

**Coverage Target:** >90% for theme-related code

---

### 6.2 Manual Verification

**Visual Inspection Checklist:**
- [ ] Homepage renders with correct colors
- [ ] Typography displays correctly (font families, sizes)
- [ ] Spacing is consistent
- [ ] Selection highlight works (cyan accent)
- [ ] Hover states function
- [ ] GSAP sections still work

**Browser DevTools Inspection:**
- [ ] CSS variables present in `:root`
- [ ] RGB format correct (space-separated)
- [ ] Font variables loaded
- [ ] Opacity modifiers work

---

### 6.3 Build Verification

**Commands:**
```bash
# Lint check
npm run lint

# TypeScript check
npm run typecheck

# Unit tests
npm run test:unit

# Production build
npm run build
```

**Expected Results:**
- ✅ 0 lint errors
- ✅ 0 TypeScript errors
- ✅ All tests passing
- ✅ Build succeeds without warnings
- ✅ CSS bundle size delta <10KB

---

### 6.4 Accessibility Audit

**Tools:**
- Chrome Lighthouse
- axe DevTools
- Manual WCAG 2.1 AA checklist

**Checks:**
- [ ] Contrast ratios ≥4.5:1 for normal text
- [ ] Contrast ratios ≥3:1 for large text
- [ ] Focus indicators visible
- [ ] Reduced motion support active

---

## 7. Risk Mitigation

### Risk 1: Breaking Existing Components
**Probability:** Medium  
**Impact:** High

**Mitigation:**
- Preserve all deprecated colors
- Keep legacy `--nexus-*` variables
- Maintain shadcn UI HSL format
- Test all pages visually before committing

**Rollback Plan:**
- Git revert to previous commit
- Staged deployment to preview branch first

---

### Risk 2: WCAG Contrast Failures
**Probability:** Medium  
**Impact:** High

**Mitigation:**
- Calculate all combinations in advance
- Use contrast checker tool (WebAIM)
- Adjust color lightness if needed
- Document approved pairings

**Contingency:**
- If color fails contrast, create `-light` variant
- Update settings.json with adjusted values

---

### Risk 3: Performance Regression
**Probability:** Low  
**Impact:** Medium

**Mitigation:**
- Monitor CSS bundle size (target <10KB increase)
- Use CSS variables efficiently (deduplicate)
- Minify production build
- Benchmark build times before/after

**Thresholds:**
- CSS bundle: +10KB max
- Build time: +10% max
- Lighthouse performance: -5 points max

---

### Risk 4: Test Suite Flakiness
**Probability:** Low  
**Impact:** Medium

**Mitigation:**
- Use deterministic jsdom setup
- Mock all external dependencies
- Isolate tests (no shared state)
- Run multiple times in CI

**Debugging Strategy:**
- Add verbose logging
- Use `--runInBand` for serial execution
- Check for timing issues

---

## 8. Dependencies & Prerequisites

### 8.1 External Dependencies

**Required (Already Installed):**
- ✅ tailwindcss@4.1.18
- ✅ @tailwindcss/postcss@4
- ✅ jest@29.7.0
- ✅ @testing-library/react@14.3.1
- ✅ @testing-library/jest-dom@6.6.4

**Not Required (Already Available):**
- Next.js 15 (runtime)
- TypeScript 5 (types)
- PostCSS (build)

### 8.2 Internal Dependencies

**Files Required:**
- ✅ `lib/theme/tokens.ts` (existing)
- ✅ `tailwind.config.mjs` (existing)
- ✅ `app/globals.css` (existing)
- ✅ `app/layout.tsx` (existing)
- ✅ `jest.config.unit.js` (existing)

### 8.3 No Blocking Dependencies

All prerequisites met. Implementation can start immediately.

---

## 9. Non-Functional Requirements

### 9.1 Performance

**Targets:**
- CSS bundle size: <10KB increase
- Build time: <10% increase
- Runtime overhead: 0 (static CSS only)
- First contentful paint: No degradation

**Measurement:**
```bash
# Before
npm run build && du -h .next/static/css/*.css

# After
npm run build && du -h .next/static/css/*.css
```

---

### 9.2 Browser Support

**Target Browsers:**
- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Mobile Safari 14+

**Not Supported:**
- IE11 (deprecated)
- Legacy browsers without CSS custom properties

**Fallback Strategy:** None (modern browsers only)

---

### 9.3 Developer Experience

**Goals:**
- Clear IntelliSense for Tailwind utilities
- Type-safe design token access
- Easy theme customization
- Good error messages

**Implementation:**
- Keep `lib/theme/tokens.ts` for TypeScript types
- Document CSS variable naming convention
- Provide examples in comments
- Add JSDoc annotations

---

### 9.4 Maintainability

**Single Source of Truth:**
```
.zenflow/settings.json (JSON, versionable)
    ↓
lib/theme/tokens.ts (TypeScript, typed)
    ↓
app/globals.css (CSS variables)
    ↓
Tailwind utilities (auto-generated)
```

**Change Process:**
1. Update `.zenflow/settings.json`
2. Sync `lib/theme/tokens.ts` (if needed)
3. CSS variables auto-update
4. Run tests to verify

**Documentation:**
- Inline comments in CSS
- JSDoc in TypeScript
- README section for theme customization

---

## 10. Open Questions & Decisions

### Q1: Should we generate CSS from settings.json?
**Decision:** No, manual sync for now
- Phase 1: Manual copy of values
- Future: Consider build script to generate CSS from JSON

---

### Q2: Do we need TypeScript types for CSS variables?
**Decision:** Optional enhancement, not required for MVP
- Can add in future iteration
- Current type system (designTokens) sufficient

---

### Q3: Should we remove deprecated colors?
**Decision:** No, preserve for backward compatibility
- Keep `deep-midnight`, `nexus.*`, `midnight-blue`
- Document migration path
- Remove in future sprint

---

### Q4: Do we need dark mode toggle?
**Decision:** Out of scope
- Static dark theme only
- No dynamic theme switching
- No light mode variant

---

## 11. Success Metrics

### 11.1 Quantitative Metrics

- ✅ 100% of design tokens exposed as CSS variables
- ✅ >90% test coverage for theme tests
- ✅ 100% WCAG AA compliance for color combinations
- ✅ 0 TypeScript errors
- ✅ 0 lint errors
- ✅ <10KB CSS bundle increase
- ✅ Lighthouse accessibility score: 100

### 11.2 Qualitative Metrics

- ✅ Developer can use theme without consulting docs
- ✅ Designers can verify colors in DevTools
- ✅ Existing components work without changes
- ✅ Theme is easy to customize

---

## 12. References

### 12.1 Internal Documentation
- `docs/DESIGN_SYSTEM.md` - Design system guide
- `lib/theme/tokens.ts` - Design tokens source
- `.zenflow/tasks/*/requirements.md` - PRD

### 12.2 External Resources
- [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
- [Tailwind v4 @theme Directive](https://tailwindcss.com/docs/theme)
- [WCAG 2.1 Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

---

## 13. Implementation Checklist

### Pre-Implementation
- [x] Review requirements document
- [x] Understand existing codebase architecture
- [x] Identify backward compatibility needs
- [x] Define CSS variable naming convention

### Phase 1: Foundation
- [ ] Create `.zenflow/settings.json`
- [ ] Update `app/globals.css` with CSS variables
- [ ] Update `app/globals.css` with `@theme` directive
- [ ] Verify layout renders correctly
- [ ] Run `npm run build`

### Phase 2: Testing
- [ ] Create `__tests__/ui/theme.test.ts`
- [ ] Implement settings file tests
- [ ] Implement CSS variables tests
- [ ] Implement utility classes tests
- [ ] Implement WCAG tests
- [ ] Implement backward compatibility tests
- [ ] Run `npm run test:unit`

### Phase 3: Validation
- [ ] Calculate contrast ratios
- [ ] Document approved color pairings
- [ ] Add accessibility comments
- [ ] Run Lighthouse audit
- [ ] Visual inspection of all pages

### Phase 4: Finalization
- [ ] Run `npm run lint`
- [ ] Run `npm run typecheck`
- [ ] Run `npm run test:unit`
- [ ] Run `npm run build`
- [ ] Measure CSS bundle size
- [ ] Update plan.md
- [ ] Mark Technical Specification step complete

---

**Specification Status:** ✅ Ready for Planning
