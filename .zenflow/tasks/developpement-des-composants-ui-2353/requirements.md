# Product Requirements Document (PRD)
## Développement des composants UI accessibles et animés

**Version:** 1.0  
**Date:** 2026-02-02  
**Status:** ✅ Approved

---

## 1. Executive Summary

### Objective
Develop a comprehensive library of accessible, animated UI components using Radix UI and Framer Motion in the `/components/ui` directory. These components must integrate seamlessly with the existing Tailwind v4 design system and CSS variables.

### Priority Components
1. **Button** - Enhanced with loading states and animations
2. **Input** - Form inputs with integrated Zod validation
3. **Modal (Dialog)** - Accessible dialogs with animations
4. **Skeleton** - Loading states with animation variants

### Success Criteria
- All components pass WCAG 2.1 AA accessibility standards
- Comprehensive test coverage (>90%) with Jest
- Consistent integration with Tailwind v4 CSS variables from `lib/theme/tokens.ts`
- Smooth animations with Framer Motion respecting `prefers-reduced-motion`
- TypeScript type safety with full IntelliSense support

---

## 2. Context & Background

### Current State Analysis

**Existing Infrastructure:**
- ✅ Tailwind CSS v4 configured with custom design tokens (`tailwind.config.mjs`)
- ✅ CSS variables defined in `app/globals.css` (brand colors, surface colors, etc.)
- ✅ Design tokens centralized in `lib/theme/tokens.ts`
- ✅ Radix UI primitives installed and partially integrated
- ✅ Framer Motion v11 installed
- ✅ Jest + Testing Library configured
- ✅ Zod and react-hook-form installed for form validation
- ✅ shadcn/ui pattern established (CVA + forwardRef pattern)

**Existing Components (require enhancement):**
- `components/ui/button.tsx` - Basic button with variants
- `components/ui/input.tsx` - Simple input without validation integration
- `components/ui/dialog.tsx` - Modal component without animations
- `components/ui/skeleton.tsx` - Loading skeleton with basic animations

**Testing Patterns:**
- Existing test: `__tests__/components/ui/skeleton.test.tsx`
- Tests cover: rendering, ARIA roles, animations, ref forwarding, edge cases

### Reference: "Lot 1" Assumption
The task mentions "variables CSS de Tailwind v4 configurées au Lot 1." Based on codebase analysis:
- **Assumption:** "Lot 1" refers to the existing design system setup with Tailwind v4, CSS variables in `app/globals.css`, and design tokens in `lib/theme/tokens.ts`
- **Action:** All components will use these existing design tokens and CSS variables

---

## 3. Detailed Requirements

### 3.1 Button Component

**Functional Requirements:**
- Extend existing button component with loading states
- Support disabled state with visual feedback
- Integrate Framer Motion for hover/tap animations
- Maintain existing variants: `default`, `secondary`, `accent`, `outline`, `ghost`, `link`
- Add new `loading` prop for async operations

**Visual Requirements:**
- Use `--color-brand-primary`, `--color-brand-secondary`, `--color-brand-accent` CSS variables
- Hover animation: subtle scale (1.02) with transition
- Active/tap animation: scale down (0.98)
- Loading state: spinner icon with rotation animation
- Disabled state: 50% opacity, no pointer events

**Accessibility Requirements:**
- `aria-busy="true"` when loading
- `aria-disabled="true"` when disabled
- Keyboard navigation (Enter, Space to activate)
- Focus ring using `focus-visible:ring-2` pattern
- Screen reader announcements for state changes

**Animation Specifications:**
```typescript
// Hover animation
whileHover={{ scale: 1.02 }}
transition={{ duration: 0.2 }}

// Tap animation
whileTap={{ scale: 0.98 }}

// Loading spinner
animate={{ rotate: 360 }}
transition={{ repeat: Infinity, duration: 1, ease: "linear" }}

// Respect reduced motion
const prefersReducedMotion = useReducedMotion()
```

### 3.2 Input Component with Zod Validation

**Functional Requirements:**
- Create enhanced input component with integrated validation display
- Support all HTML input types: text, email, password, number, tel, url, date
- Integration with react-hook-form and Zod schemas
- Real-time validation feedback
- Error message display with animations
- Optional helper text

**Component Structure:**
```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  required?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}
```

**Visual Requirements:**
- Use design tokens from `lib/theme/tokens.ts`:
  - Border: `neutral.200` (default), `brand.primary` (focus), `semantic.error` (error)
  - Background: `white` (light mode), `surface.card` (dark mode)
  - Text: `neutral.900` (input), `neutral.600` (helper), `semantic.error` (error)
- Focus animation: border color transition (200ms)
- Error state animation: shake animation on validation error
- Label animation: float up on focus (if implementing floating labels)

**Accessibility Requirements:**
- `<label>` element properly associated with `htmlFor`
- `aria-invalid="true"` when error exists
- `aria-describedby` linking to helper text and error messages
- `aria-required="true"` for required fields
- Error messages in `role="alert"` for screen readers

**Validation Integration:**
```typescript
// Example usage with react-hook-form + Zod
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères')
})

const { register, formState: { errors } } = useForm({
  resolver: zodResolver(schema)
})

<Input
  {...register('email')}
  label="Email"
  error={errors.email?.message}
  required
/>
```

### 3.3 Modal (Dialog) Component

**Functional Requirements:**
- Enhance existing dialog component with Framer Motion animations
- Support multiple sizes: `sm`, `md` (default), `lg`, `xl`, `full`
- Optional close button (can be hidden)
- Overlay click to close (configurable)
- Escape key to close
- Focus trap when open
- Scroll lock on body when modal is open

**Component API:**
```typescript
interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  title: string
  description?: string
  children: React.ReactNode
  showClose?: boolean
  closeOnOverlayClick?: boolean
}
```

**Animation Specifications:**
- **Overlay:** Fade in/out (opacity 0 → 0.8)
- **Content:** Combined animations
  - Fade: opacity 0 → 1
  - Scale: 0.95 → 1
  - Slide: translateY(20px) → 0
  - Duration: 200ms
  - Easing: cubic-bezier(0.4, 0, 0.2, 1)

**Visual Requirements:**
- Overlay: `bg-black/80` (80% opacity black)
- Content background: `bg-white` with `shadow-xl`
- Border radius: `rounded-lg` (from design tokens: `radius.lg`)
- Max width by size:
  - `sm`: 400px
  - `md`: 500px
  - `lg`: 600px
  - `xl`: 800px
  - `full`: 90vw

**Accessibility Requirements:**
- `role="dialog"`
- `aria-modal="true"`
- `aria-labelledby` pointing to title
- `aria-describedby` pointing to description (if provided)
- Focus management: trap focus within modal, return focus on close
- Radix UI Dialog provides this by default, ensure it's maintained

### 3.4 Skeleton Component

**Functional Requirements:**
- Enhance existing skeleton component
- Animation variants: `pulse` (default), `wave`, `none`
- Pre-built patterns: `SkeletonText`, `SkeletonCard`, `SkeletonAvatar`, `SkeletonButton`, `SkeletonInput`
- Support dark mode (using `surface` colors)

**Component API:**
```typescript
interface SkeletonProps {
  className?: string
  animation?: 'pulse' | 'wave' | 'none'
  variant?: 'rectangular' | 'circular' | 'text'
}

// Pre-built patterns
<SkeletonText lines={3} />
<SkeletonCard />
<SkeletonAvatar size="sm" | "md" | "lg" />
<SkeletonButton />
<SkeletonInput />
```

**Animation Specifications:**
- **Pulse:** Opacity animation 100% → 50% → 100% (2s infinite)
- **Wave:** Shimmer effect using gradient animation
  ```css
  background: linear-gradient(90deg, transparent, white/60, transparent)
  animation: shimmer 2s infinite
  transform: translateX(-100%) → translateX(100%)
  ```
- **None:** Static loading state (for reduced motion preference)

**Visual Requirements:**
- Background: `neutral.200` (light mode), `surface.elevated` (dark mode)
- Border radius: `rounded-md` (default), can be overridden
- Wave shimmer: white with 60% opacity overlay

**Accessibility Requirements:**
- `aria-busy="true"` on container
- `aria-live="polite"` for dynamic content loading
- Optional `aria-label="Loading content"`
- Respect `prefers-reduced-motion` (automatically use `animation="none"`)

---

## 4. Testing Requirements

All components must include comprehensive Jest tests covering:

### 4.1 Test Categories

**1. Rendering Tests**
- Component renders without crashing
- Props are correctly applied
- Custom className is merged correctly
- Ref forwarding works
- Default props are applied

**2. Accessibility Tests**
- ARIA roles are correctly set
  - Button: `role="button"`
  - Input: proper `label` association
  - Modal: `role="dialog"`, `aria-modal="true"`
  - Skeleton: `aria-busy="true"`
- Keyboard navigation works
  - Button: Enter/Space activation
  - Modal: Escape to close, Tab for focus trap
  - Input: standard input keyboard behavior
- Screen reader compatibility
  - Semantic HTML structure
  - ARIA labels and descriptions
  - Live regions for dynamic content

**3. Animation Tests**
- Hover animations trigger correctly
- Tap/active animations work
- Loading animations render
- Respects `prefers-reduced-motion`
- Animation cleanup (no memory leaks)

**4. State Management Tests**
- Disabled state prevents interaction
- Loading state displays correctly
- Error state shows validation messages
- Focus state applies correct styles

**5. Integration Tests**
- Input + react-hook-form integration
- Input + Zod validation
- Modal open/close state management
- Form submission with validation

### 4.2 Test Coverage Requirements
- **Minimum coverage:** 90% for all components
- **Branches:** All conditional logic paths tested
- **Edge cases:** Empty values, long text, special characters, null/undefined

### 4.3 Example Test Structure
```typescript
describe('Button', () => {
  describe('Rendering', () => {
    it('renders with default variant', () => { })
    it('applies custom className', () => { })
    it('forwards ref correctly', () => { })
  })

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => { })
    it('supports keyboard navigation', () => { })
    it('has accessible name', () => { })
  })

  describe('Animations', () => {
    it('applies hover animation', () => { })
    it('applies tap animation', () => { })
    it('respects prefers-reduced-motion', () => { })
  })

  describe('States', () => {
    it('handles disabled state', () => { })
    it('handles loading state', () => { })
    it('prevents clicks when disabled', () => { })
  })
})
```

---

## 5. Design System Integration

### 5.1 CSS Variables Usage

All components MUST use CSS variables from `app/globals.css`:

**Brand Colors:**
```css
--color-brand-primary: 37 99 235;    /* #2563EB - Blue */
--color-brand-secondary: 239 68 68;  /* #EF4444 - Red */
--color-brand-accent: 46 233 246;    /* #2EE9F6 - Cyan */
```

**Surface Colors:**
```css
--color-surface-dark: 11 12 16;      /* #0B0C10 */
--color-surface-darker: 5 6 8;       /* #050608 */
--color-surface-card: 17 19 24;      /* #111318 */
--color-surface-elevated: 26 29 35;  /* #1A1D23 */
```

**Usage in Tailwind:**
```tsx
// Use Tailwind classes that reference design tokens
className="bg-brand-primary text-white"
className="border-neutral-200 focus:border-brand-primary"
className="bg-surface-card text-neutral-100"
```

### 5.2 Design Token Reference

Import and use from `lib/theme/tokens.ts`:
```typescript
import { designTokens } from '@/lib/theme/tokens'

// Access colors
designTokens.colors.brand.primary    // '#2563EB'
designTokens.colors.semantic.error   // '#EF4444'
designTokens.colors.neutral[200]     // '#E5E7EB'

// Access spacing, radius, shadows
designTokens.spacing[4]              // '1rem'
designTokens.radius.card             // '18px'
designTokens.shadows.soft            // '0 4px 30px rgba(0, 0, 0, 0.1)'
```

### 5.3 Tailwind v4 Configuration

All components leverage the existing Tailwind v4 config in `tailwind.config.mjs`:
- Extended color palette with design tokens
- Custom border radius (`card`, `card-sm`, `micro`)
- Custom shadows (`soft`, `medium`, `strong`, `cyan-glow`)
- Custom animations (`fade-in`, `slide-up`, `shimmer`)

---

## 6. Technical Constraints

### 6.1 Technology Stack
- **Framework:** Next.js 15+ with React 18
- **Styling:** Tailwind CSS v4
- **UI Primitives:** Radix UI
- **Animation:** Framer Motion v11
- **Forms:** react-hook-form + @hookform/resolvers
- **Validation:** Zod v3
- **Testing:** Jest + @testing-library/react
- **TypeScript:** Full type safety required

### 6.2 Browser Support
- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions
- Safari: Last 2 versions
- Mobile: iOS Safari 14+, Android Chrome 90+

### 6.3 Performance
- Components must be tree-shakeable
- Lazy load animations (Framer Motion code splitting)
- No layout shift during skeleton → content transition
- Animation frame rate: 60fps minimum

### 6.4 Code Quality
- ESLint: No errors, warnings acceptable with justification
- TypeScript: Strict mode enabled, no `any` types
- File size: Individual component < 10KB (minified)
- Bundle impact: Total addition < 50KB (gzipped)

---

## 7. Out of Scope

The following are explicitly **NOT** part of this task:

1. ❌ Creating new design tokens or modifying `lib/theme/tokens.ts`
2. ❌ Changing Tailwind configuration beyond minor adjustments
3. ❌ Implementing complex form components (multi-step forms, file upload)
4. ❌ Building composite components (data tables, calendars, charts)
5. ❌ Dark mode toggle implementation (use existing system)
6. ❌ Responsive design overhaul (use existing breakpoints)
7. ❌ Backend integration or API calls
8. ❌ Documentation website or Storybook setup
9. ❌ Migration of existing components in the app
10. ❌ E2E tests with Playwright (only unit tests with Jest)

---

## 8. Assumptions & Decisions

### Assumptions Made
1. **"Lot 1" Reference:** Assumed to be the existing Tailwind v4 + CSS variables setup
2. **Component Enhancement:** Enhance existing components rather than rewrite from scratch
3. **Test Framework:** Continue using Jest (already configured)
4. **Animation Preference:** Framer Motion for micro-interactions, GSAP remains for page-level animations
5. **Form Pattern:** react-hook-form + Zod is the established pattern

### Design Decisions
1. **Component Pattern:** Continue using shadcn/ui pattern (CVA + forwardRef + Radix)
2. **Animation Strategy:** All animations respect `prefers-reduced-motion`
3. **Validation Display:** Inline error messages under inputs
4. **Loading States:** Button spinner on right side, does not replace text
5. **Modal Behavior:** Close on overlay click enabled by default, can be disabled

### Questions for Clarification
If any of the following significantly impact your requirements, please clarify:

1. **Component Variants:** Should we add additional button/input variants beyond what's specified?
2. **Animation Duration:** Are the specified durations (200ms default) acceptable, or do you prefer faster/slower?
3. **Error Handling:** Should form errors auto-clear on input change, or require explicit user action?
4. **Skeleton Patterns:** Are the pre-built patterns (`SkeletonCard`, etc.) sufficient, or do you need more specific ones?

---

## 9. Success Metrics

### Definition of Done
- ✅ All 4 priority components implemented and enhanced
- ✅ Test coverage ≥ 90% for each component
- ✅ All tests pass: `npm run test:unit`
- ✅ No TypeScript errors: `npm run typecheck`
- ✅ No ESLint errors: `npm run lint`
- ✅ Accessibility verified (ARIA roles, keyboard nav, screen readers)
- ✅ Animations smooth (60fps) and respect reduced motion
- ✅ Integration with Tailwind v4 CSS variables confirmed

### Acceptance Criteria
1. **Button Component:**
   - Loading state with spinner animation
   - Disabled state prevents interaction
   - Hover/tap animations work
   - All ARIA attributes present
   - Tests cover all states and animations

2. **Input Component:**
   - Zod validation integration functional
   - Error messages display correctly
   - Helper text and labels accessible
   - Focus states animated
   - Tests include form integration

3. **Modal Component:**
   - Open/close animations smooth
   - Focus trap functional
   - Escape key closes modal
   - All ARIA dialog requirements met
   - Tests cover open/close behavior

4. **Skeleton Component:**
   - Pulse and wave animations work
   - Pre-built patterns available
   - Respects reduced motion
   - Matches loading content dimensions
   - Tests cover all animation variants

---

## 10. Timeline & Milestones

**Note:** This PRD focuses on requirements, not implementation planning. The technical specification and planning steps will break down the implementation timeline.

**Estimated Scope:**
- Component development: ~8-12 hours
- Test development: ~6-8 hours
- Documentation & refinement: ~2-4 hours
- **Total:** ~16-24 hours

---

## Appendix A: References

### Existing Codebase Files
- `tailwind.config.mjs` - Tailwind v4 configuration
- `app/globals.css` - CSS variables
- `lib/theme/tokens.ts` - Design tokens
- `components/ui/button.tsx` - Existing button component
- `components/ui/input.tsx` - Existing input component
- `components/ui/dialog.tsx` - Existing dialog component
- `components/ui/skeleton.tsx` - Existing skeleton component
- `lib/validations.ts` - Zod schemas examples
- `__tests__/components/ui/skeleton.test.tsx` - Test pattern reference

### External Documentation
- Radix UI Primitives: https://www.radix-ui.com/primitives
- Framer Motion: https://www.framer.com/motion/
- WCAG 2.1 AA: https://www.w3.org/WAI/WCAG21/quickref/
- Tailwind CSS v4: https://tailwindcss.com/docs
- Zod: https://zod.dev/
- react-hook-form: https://react-hook-form.com/

---

**Document Status:** ✅ Ready for Technical Specification
