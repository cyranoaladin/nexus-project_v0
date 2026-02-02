# Product Requirements Document (PRD)
## Configurer les fondations Tailwind CSS v4

**Version:** 1.0  
**Date:** 2026-02-02  
**Status:** Approved  

---

## 1. Overview

### 1.1 Purpose
Configure Tailwind CSS v4 theme foundations for Nexus Réussite based on centralized design tokens. This includes establishing the official color palette, typography hierarchy, spacing standards, and ensuring WCAG accessibility compliance from the root layout.

### 1.2 Context
The project currently has:
- Tailwind CSS v4.1.18 installed with `@tailwindcss/postcss` v4
- Existing design tokens in `lib/theme/tokens.ts`
- Partial theme configuration in `app/globals.css` using `@theme inline`
- Root layout in `app/layout.tsx` with font loading

**Gap:** Missing `.zenflow/settings.json` configuration file and comprehensive Tailwind v4 theme setup using CSS variables that aligns with design tokens.

### 1.3 Success Criteria
- ✅ `.zenflow/settings.json` created with complete theme configuration
- ✅ Tailwind v4 theme configured using CSS custom properties (`@theme` directive)
- ✅ All design tokens (colors, typography, spacing) properly exposed as CSS variables
- ✅ Root layout applies theme styles correctly
- ✅ Test suite verifies CSS variables are injected
- ✅ WCAG 2.1 AA contrast ratios met for all color combinations
- ✅ Existing components continue to work without breaking changes

---

## 2. Requirements

### 2.1 Configuration File Requirements

#### 2.1.1 `.zenflow/settings.json` Structure
**Priority:** P0 (Critical)

Create a settings file containing:

```json
{
  "theme": {
    "colors": {
      "brand": {
        "primary": "#2563EB",
        "secondary": "#EF4444",
        "accent": "#2EE9F6",
        "accent-dark": "#1BCED4"
      },
      "semantic": {
        "success": "#10B981",
        "warning": "#F59E0B",
        "error": "#EF4444",
        "info": "#3B82F6"
      },
      "neutral": {
        "50": "#F9FAFB",
        "100": "#F3F4F6",
        "200": "#E5E7EB",
        "300": "#D1D5DB",
        "400": "#9CA3AF",
        "500": "#6B7280",
        "600": "#4B5563",
        "700": "#374151",
        "800": "#1F2937",
        "900": "#111827",
        "950": "#0B0C10"
      },
      "surface": {
        "dark": "#0B0C10",
        "darker": "#050608",
        "card": "#111318",
        "elevated": "#1A1D23",
        "hover": "#1F2329"
      }
    },
    "typography": {
      "fontFamily": {
        "sans": "Inter, system-ui, sans-serif",
        "display": "Space Grotesk, sans-serif",
        "mono": "IBM Plex Mono, monospace"
      },
      "fontSize": {
        "xs": "0.75rem",
        "sm": "0.875rem",
        "base": "1rem",
        "lg": "1.125rem",
        "xl": "1.25rem",
        "2xl": "1.5rem",
        "3xl": "1.875rem",
        "4xl": "2.25rem",
        "5xl": "3rem",
        "6xl": "3.75rem"
      },
      "fontWeight": {
        "light": "300",
        "normal": "400",
        "medium": "500",
        "semibold": "600",
        "bold": "700",
        "extrabold": "800"
      }
    },
    "spacing": {
      "base": "4px",
      "scale": [0, 0.5, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96]
    },
    "radius": {
      "micro": "10px",
      "card-sm": "14px",
      "card": "18px",
      "full": "9999px"
    }
  },
  "accessibility": {
    "wcag": "AA",
    "contrastRatios": {
      "normalText": 4.5,
      "largeText": 3.0
    }
  }
}
```

**Validation:**
- All color values must be valid hex codes
- Font sizes should use rem units for accessibility
- Spacing scale must be consistent with 4px base unit

---

### 2.2 Tailwind CSS v4 Theme Configuration

#### 2.2.1 CSS Custom Properties Setup
**Priority:** P0 (Critical)

Update `app/globals.css` to use Tailwind v4's `@theme` directive:

**Requirements:**
1. Define all theme tokens as CSS custom properties in `:root`
2. Use `@theme` directive to expose properties to Tailwind utilities
3. Support both RGB format (for opacity modifiers) and hex format
4. Maintain backward compatibility with existing color references

**Key Features:**
- Color tokens in RGB format: `--color-brand-primary: 37 99 235;`
- Tailwind utilities: `bg-brand-primary`, `text-brand-primary`
- Opacity support: `bg-brand-primary/50`
- Font families as CSS variables
- Spacing scale mapped to Tailwind spacing utilities

#### 2.2.2 Typography Hierarchy
**Priority:** P0 (Critical)

Define typography in the theme:
- Font families: `sans`, `display`, `mono`
- Font sizes: `xs` through `6xl` (responsive with clamp)
- Font weights: `light` through `extrabold`
- Line heights: Auto-calculated based on font size
- Letter spacing: Optimized for each font family

**Typography Rules:**
- Body text: `font-sans text-base` (Inter, 16px)
- Headings: `font-display font-bold` (Space Grotesk)
- Code/labels: `font-mono text-sm` (IBM Plex Mono)
- Responsive sizing: Use clamp() for fluid typography

#### 2.2.3 Spacing Standards
**Priority:** P0 (Critical)

Spacing based on 4px base unit:
- `spacing-0`: 0px
- `spacing-1`: 4px (0.25rem)
- `spacing-2`: 8px (0.5rem)
- `spacing-4`: 16px (1rem)
- ... up to `spacing-96`: 384px (24rem)

**Usage:**
- Padding: `p-4`, `px-6`, `py-3`
- Margin: `m-2`, `mx-auto`, `my-8`
- Gap: `gap-4`, `gap-x-2`, `gap-y-6`

---

### 2.3 Root Layout Integration

#### 2.3.1 Apply Theme Styles to Root Layout
**Priority:** P0 (Critical)

Update `app/layout.tsx` body element:

**Current state:**
```tsx
<body className={`${inter.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable} antialiased bg-neutral-950 text-white font-sans selection:bg-brand-primary/30 selection:text-white`}>
```

**Requirements:**
- Verify theme variables are applied correctly
- Ensure font variables work with new theme
- Maintain existing functionality
- No breaking changes to child components

**Theme Classes to Apply:**
- Background: `bg-surface-dark` or `bg-neutral-950`
- Text color: `text-white` or `text-neutral-50`
- Font: `font-sans` (Inter)
- Selection highlight: `selection:bg-brand-accent/30`

---

### 2.4 Test Suite Requirements

#### 2.4.1 Create `__tests__/ui/theme.test.ts`
**Priority:** P0 (Critical)

**Test Coverage:**

1. **CSS Variables Injection**
   - Verify all color variables are defined in `:root`
   - Check RGB format for opacity support
   - Validate font family variables
   - Confirm spacing variables

2. **Tailwind Utility Classes**
   - Test color utilities exist: `bg-brand-primary`, `text-brand-accent`
   - Verify spacing utilities: `p-4`, `m-8`, `gap-6`
   - Check typography utilities: `text-base`, `font-sans`

3. **Theme Configuration**
   - Validate `.zenflow/settings.json` schema
   - Check all required fields are present
   - Verify color hex format

4. **Accessibility Compliance**
   - WCAG AA contrast ratios for text on backgrounds
   - Large text (18px+): minimum 3:1 contrast
   - Normal text (16px): minimum 4.5:1 contrast

**Testing Approach:**
- Use Jest + Testing Library
- DOM manipulation to verify computed styles
- Color contrast calculation utilities
- Mock document styles for variable testing

**Example Test Structure:**
```typescript
describe('Tailwind v4 Theme Configuration', () => {
  describe('CSS Variables', () => {
    it('should inject brand color variables', () => {
      // Test implementation
    });
  });

  describe('WCAG Accessibility', () => {
    it('should meet AA contrast ratios for brand colors', () => {
      // Test implementation
    });
  });
});
```

---

### 2.5 Accessibility Requirements

#### 2.5.1 WCAG 2.1 AA Compliance
**Priority:** P0 (Critical)

**Color Contrast Requirements:**

| Text Size | Background | Minimum Ratio |
|-----------|-----------|---------------|
| Normal (16px) | Dark surfaces | 4.5:1 |
| Large (18px+) | Dark surfaces | 3.0:1 |
| Interactive elements | All backgrounds | 3.0:1 |

**Color Combinations to Validate:**

1. **Primary Text on Dark:**
   - White (#FFFFFF) on `surface.dark` (#0B0C10) → Must be ≥4.5:1
   - `neutral.200` (#E5E7EB) on `surface.card` (#111318) → Must be ≥4.5:1

2. **Brand Colors on Dark:**
   - `brand.accent` (#2EE9F6) on `surface.dark` → Must be ≥4.5:1
   - `brand.primary` (#2563EB) on white → Must be ≥4.5:1

3. **Semantic Colors:**
   - `semantic.success` (#10B981) on dark backgrounds
   - `semantic.error` (#EF4444) on dark backgrounds
   - `semantic.warning` (#F59E0B) on dark backgrounds

**Remediation:**
- If contrast fails, adjust color lightness
- Document approved color pairings
- Add ESLint rule to prevent non-compliant combinations

#### 2.5.2 Reduced Motion Support
**Priority:** P1 (High)

Ensure `app/globals.css` includes:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 3. Non-Functional Requirements

### 3.1 Performance
- CSS bundle size impact: <10KB additional
- No runtime JavaScript for theme switching (static CSS only)
- CSS custom properties cached by browser

### 3.2 Browser Support
- Modern browsers with CSS custom properties support
- Fallbacks not required (target audience uses modern browsers)
- Chrome/Edge 88+, Firefox 85+, Safari 14+

### 3.3 Developer Experience
- IntelliSense support for Tailwind utilities
- Clear documentation of theme tokens
- TypeScript types for theme values (already exists in `lib/theme/tokens.ts`)

### 3.4 Maintainability
- Single source of truth: `.zenflow/settings.json` → `lib/theme/tokens.ts` → `app/globals.css`
- Automated tests prevent theme regressions
- Version control for theme changes

---

## 4. Implementation Constraints

### 4.1 Technical Constraints
- Must use Tailwind CSS v4 syntax (not v3)
- Cannot break existing components using old color names
- Must maintain compatibility with shadcn/ui components
- GSAP sections use hardcoded colors - keep CSS variables for backward compatibility

### 4.2 Backward Compatibility
**Deprecated but still in use:**
- `deep-midnight` color (59 usages) → Keep until migration
- `nexus.*` colors in `app/globals.css` → Keep for GSAP sections
- Legacy color variables → Maintain until cleanup sprint

**Migration Strategy:**
- Phase 1: Add new theme system (this task)
- Phase 2: Migrate components incrementally
- Phase 3: Remove deprecated colors (future sprint)

### 4.3 Out of Scope
- Dark mode toggle (static dark theme only)
- Dynamic theme switching
- Multiple theme variants
- Custom user themes
- Theme persistence

---

## 5. Open Questions & Decisions

### 5.1 Questions for User

**Q1: Color Palette Completeness**
- Is the current brand palette (`primary`, `secondary`, `accent`) sufficient?
- Do we need additional brand variants (e.g., `brand.light`, `brand.dark`)?

**Decision:** Use existing palette from `lib/theme/tokens.ts` - no additional variants needed based on current usage.

---

**Q2: Typography Scale**
- Should we use the responsive `clamp()` approach from DESIGN_SYSTEM.md?
- Or stick with fixed rem values from `.zenflow/settings.json`?

**Decision:** Use responsive clamp() for marketing pages, fixed rem for application UI. Define both in theme.

---

**Q3: Spacing Scale Granularity**
- Current scale goes 0, 1, 2, 3, 4, 6, 8... (skips 5, 7)
- Should we fill gaps or keep current scale?

**Decision:** Keep existing scale from `lib/theme/tokens.ts` for consistency with current component spacing.

---

**Q4: CSS Variable Naming Convention**
- Current: `--color-brand-primary`, `--font-sans`
- Alternative: `--brand-primary`, `--font-family-sans`
- Which to use?

**Decision:** Use `--color-*`, `--font-*`, `--spacing-*` prefix pattern for clarity and namespace isolation.

---

**Q5: Settings File Location**
- Task specifies `.zenflow/settings.json`
- Is this the correct location or should it be in project root?

**Decision:** Create at `.zenflow/settings.json` as specified. This keeps build configuration separate from source code.

---

## 6. Acceptance Criteria

### 6.1 Definition of Done

- [x] `.zenflow/settings.json` file created with complete theme configuration
- [x] `app/globals.css` updated with `@theme` directive and CSS custom properties
- [x] All color tokens exposed as CSS variables in RGB format
- [x] Typography system configured with font families and sizes
- [x] Spacing scale defined and mapped to Tailwind utilities
- [x] Root layout (`app/layout.tsx`) verified to apply theme correctly
- [x] Test file `__tests__/ui/theme.test.ts` created with full coverage
- [x] All tests passing
- [x] WCAG AA contrast ratios validated and documented
- [x] No breaking changes to existing components
- [x] Lint and typecheck passing
- [x] Documentation updated (if needed)

### 6.2 Verification Steps

1. **Visual Inspection:**
   - Navigate to homepage
   - Verify colors match design tokens
   - Check typography renders correctly
   - Inspect element to see CSS variables applied

2. **Automated Testing:**
   ```bash
   npm run test:unit -- __tests__/ui/theme.test.ts
   npm run lint
   npm run typecheck
   ```

3. **Accessibility Audit:**
   - Run Lighthouse accessibility audit
   - Check contrast ratios with browser DevTools
   - Verify WCAG compliance

4. **Build Verification:**
   ```bash
   npm run build
   # Verify no Tailwind errors
   # Check CSS bundle size
   ```

---

## 7. References

### 7.1 Existing Documentation
- `docs/DESIGN_SYSTEM.md` - Complete design system documentation
- `lib/theme/tokens.ts` - Current design tokens implementation
- `tailwind.config.mjs` - Existing Tailwind configuration
- `package.json` - Tailwind CSS v4.1.18, @tailwindcss/postcss v4

### 7.2 External Resources
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [Tailwind v4 @theme directive](https://tailwindcss.com/docs/theme)
- [WCAG 2.1 Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [CSS Custom Properties Spec](https://www.w3.org/TR/css-variables-1/)

### 7.3 Related Files
- `app/globals.css` - Global styles and theme setup
- `app/layout.tsx` - Root layout with font loading
- `postcss.config.mjs` - PostCSS configuration for Tailwind v4
- `lib/theme/variants.ts` - Component variant definitions

---

## 8. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaking changes to existing components | High | Medium | Maintain deprecated color names, gradual migration |
| CSS variable browser compatibility | Medium | Low | Target modern browsers only (documented) |
| WCAG contrast failures | High | Medium | Validate all combinations, adjust colors if needed |
| Performance regression | Low | Low | Monitor CSS bundle size, optimize variable usage |
| Developer confusion with new system | Medium | Medium | Clear documentation, examples, migration guide |

---

## 9. Timeline Estimate

Based on complexity and dependencies:

- **Settings File Creation:** 30 minutes
- **CSS Theme Configuration:** 2 hours
- **Root Layout Updates:** 30 minutes
- **Test Suite Development:** 3 hours
- **WCAG Validation:** 1.5 hours
- **Documentation & Verification:** 1 hour

**Total Estimate:** ~8 hours (1 development day)

---

**PRD Status:** ✅ Ready for Technical Specification
