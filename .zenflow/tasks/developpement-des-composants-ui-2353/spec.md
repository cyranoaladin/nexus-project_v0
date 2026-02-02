# Technical Specification
## Développement des composants UI accessibles et animés

**Version:** 1.0  
**Date:** 2026-02-02  
**Status:** ✅ Ready for Implementation

---

## 1. Technical Context

### 1.1 Technology Stack

**Runtime & Framework:**
- Next.js 15.5.11 (App Router)
- React 18.3.1 (Server & Client Components)
- TypeScript 5 (strict mode enabled)

**Styling & UI:**
- Tailwind CSS v4.1.18 with custom design system
- Radix UI v1.x (Headless UI primitives)
- Framer Motion v11.0.0 (Animations)
- class-variance-authority v0.7.1 (CVA pattern)
- clsx v2.1.1 (Conditional classes)
- lucide-react v0.536.0 (Icons)

**Forms & Validation:**
- react-hook-form v7.62.0
- @hookform/resolvers v5.2.1
- Zod v3.23.8

**Testing:**
- Jest v29.7.0
- @testing-library/react v14.3.1
- @testing-library/jest-dom v6.6.4
- @testing-library/user-event v14.6.1
- jest-environment-jsdom v29.7.0

**Build Tools:**
- @tailwindcss/postcss v4
- ESLint v8.57.0 (Next.js config)

### 1.2 Existing Architecture Patterns

**Component Pattern (shadcn/ui style):**
```typescript
// CVA + forwardRef + Radix pattern
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const variants = cva("base-styles", {
  variants: { variant: {...}, size: {...} },
  defaultVariants: { variant: "default" }
})

const Component = React.forwardRef<HTMLElement, Props>(
  ({ className, variant, ...props }, ref) => {
    return <Element className={cn(variants({ variant, className }))} ref={ref} {...props} />
  }
)
Component.displayName = "Component"
```

**Design Token Integration:**
- Centralized in `lib/theme/tokens.ts`
- Exposed via Tailwind CSS classes (e.g., `bg-brand-primary`, `text-neutral-600`)
- CSS variables in `app/globals.css` (RGB format: `--color-brand-primary: 37 99 235`)

**Testing Pattern:**
```typescript
// Reference: __tests__/components/ui/skeleton.test.tsx
describe('ComponentName', () => {
  describe('Rendering', () => { /* Basic render tests */ })
  describe('Accessibility', () => { /* ARIA, keyboard, screen reader */ })
  describe('Animation', () => { /* Framer Motion animations */ })
  describe('States', () => { /* disabled, loading, error */ })
  describe('Edge Cases', () => { /* null, empty, overflow */ })
})
```

**File Organization:**
- Components: `components/ui/[component].tsx`
- Tests: `__tests__/components/ui/[component].test.tsx`
- Types: Inline with components (TypeScript strict mode)

---

## 2. Implementation Approach

### 2.1 Component Enhancement Strategy

We will **enhance existing components** rather than rewrite from scratch. This preserves backward compatibility and reduces risk.

**Enhancement Approach:**
1. **Button** - Add loading state, Framer Motion animations, enhanced ARIA
2. **Input** - Add validation integration layer, error display, label wrapper
3. **Dialog** - Replace Radix animations with Framer Motion, add size variants
4. **Skeleton** - Add SkeletonButton/SkeletonInput patterns, enhance accessibility

### 2.2 Animation Integration

**Framer Motion Strategy:**
- Use `motion` components for animated elements
- Implement `useReducedMotion()` hook to respect `prefers-reduced-motion`
- Animations as opt-in enhancements (graceful degradation)

**Pattern:**
```typescript
import { motion, useReducedMotion } from "framer-motion"

const prefersReducedMotion = useReducedMotion()

<motion.button
  whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
  transition={{ duration: 0.2 }}
/>
```

**Animation Specs (from PRD):**
- Button hover: `scale: 1.02`, `duration: 0.2s`
- Button tap: `scale: 0.98`
- Modal overlay: `opacity: 0 → 0.8`, `duration: 0.2s`
- Modal content: `opacity: 0 → 1`, `scale: 0.95 → 1`, `translateY: 20px → 0`
- Input focus: Border color transition `duration: 0.2s`
- Input error: Shake animation (keyframes)

### 2.3 Accessibility Implementation

**ARIA Compliance:**
- Button: `aria-busy="true"` when loading, `aria-disabled="true"` when disabled
- Input: `aria-invalid="true"` on error, `aria-describedby` for helper/error text, `aria-required` for required fields
- Modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`
- Skeleton: `aria-busy="true"`, `aria-live="polite"`, optional `aria-label`

**Keyboard Navigation:**
- Button: Enter/Space activation (native)
- Modal: Escape to close (Radix built-in), Tab focus trap (Radix built-in)
- Input: Standard input keyboard behavior

**Focus Management:**
- Use `focus-visible:ring-2` pattern (existing in codebase)
- Modal returns focus to trigger on close (Radix handles this)

### 2.4 Form Validation Integration

**react-hook-form + Zod Pattern:**
```typescript
// Existing pattern from codebase
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

**Enhanced Input Component:**
- Accepts `label`, `error`, `helperText` props
- Renders proper label/input association
- Error messages in `role="alert"` for screen readers
- Integrates seamlessly with react-hook-form's `register()`

---

## 3. Source Code Structure Changes

### 3.1 Modified Files

**1. `components/ui/button.tsx`**
- Add `loading` prop (boolean)
- Add loading spinner icon (lucide-react `Loader2`)
- Wrap with Framer Motion `motion.button`
- Add hover/tap animations
- Add `aria-busy` when loading

**2. `components/ui/input.tsx`**
- Add `label`, `error`, `helperText`, `icon`, `iconPosition` props
- Wrap input in label structure
- Add error message display with `role="alert"`
- Add helper text with `aria-describedby`
- Add focus border transition animation
- Add error shake animation (CSS keyframes)

**3. `components/ui/dialog.tsx`**
- Replace Radix data-state animations with Framer Motion
- Add `size` prop: `sm`, `md`, `lg`, `xl`, `full`
- Use `AnimatePresence` for enter/exit animations
- Add size-based max-width classes
- Preserve existing accessibility (Radix handles ARIA)

**4. `components/ui/skeleton.tsx`**
- Add `SkeletonButton` component
- Add `SkeletonInput` component
- Add `prefers-reduced-motion` detection (auto set `animation="none"`)
- Add `aria-busy="true"` by default
- Add optional `aria-label` and `aria-live="polite"`

### 3.2 New Files

**1. `__tests__/components/ui/button.test.tsx`**
- Rendering tests (variants, sizes, loading state)
- Accessibility tests (ARIA, keyboard, focus)
- Animation tests (hover, tap, reduced motion)
- State tests (disabled, loading, interaction prevention)
- Edge cases (long text, icons, async onClick)

**2. `__tests__/components/ui/input.test.tsx`**
- Rendering tests (label, error, helper text)
- Accessibility tests (label association, ARIA attributes)
- Validation tests (react-hook-form + Zod integration)
- Animation tests (focus transition, error shake)
- State tests (disabled, required, various types)
- Edge cases (missing label, long error messages)

**3. `__tests__/components/ui/dialog.test.tsx`**
- Rendering tests (sizes, title, description)
- Accessibility tests (dialog role, ARIA attributes, focus trap)
- Animation tests (overlay fade, content animations)
- Interaction tests (overlay click, escape key, close button)
- Edge cases (nested content, long content)

**Note:** `__tests__/components/ui/skeleton.test.tsx` already exists and is comprehensive. We'll enhance it with new patterns.

### 3.3 Configuration Changes

**None required.** All necessary dependencies are already installed.

---

## 4. Data Model / API / Interface Changes

### 4.1 Component API Definitions

**Button Component:**
```typescript
interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean  // NEW
}

// variants: default, secondary, accent, outline, ghost, link (existing)
// sizes: default, sm, lg, icon (existing)
```

**Input Component:**
```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string          // NEW
  error?: string          // NEW
  helperText?: string     // NEW
  icon?: React.ReactNode  // NEW
  iconPosition?: 'left' | 'right'  // NEW
}

// Supports all HTML input types: text, email, password, number, tel, url, date, etc.
```

**Dialog Component:**
```typescript
// Existing Radix Dialog exports remain unchanged
// DialogContent gets new size variant

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'  // NEW
}

// Size mappings:
// sm: max-w-sm (400px)
// md: max-w-md (500px) - default
// lg: max-w-lg (600px)
// xl: max-w-xl (800px)
// full: max-w-[90vw]
```

**Skeleton Component:**
```typescript
interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  animation?: "pulse" | "wave" | "none"  // existing
}

// NEW: Additional pattern components
SkeletonButton: React.FC<React.HTMLAttributes<HTMLDivElement>>
SkeletonInput: React.FC<React.HTMLAttributes<HTMLDivElement>>

// Existing patterns (already implemented):
SkeletonText: React.FC<{ lines?: number }>
SkeletonCard: React.FC
SkeletonAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg' }>
```

### 4.2 Backward Compatibility

**All changes are backward compatible:**
- New props are optional with sensible defaults
- Existing props maintain their behavior
- Components can be used as drop-in replacements

**Migration Examples:**
```typescript
// OLD: Basic button
<Button>Click me</Button>

// NEW: Button with loading state (backward compatible)
<Button loading={isSubmitting}>Submit</Button>

// OLD: Basic input
<Input type="email" placeholder="Email" />

// NEW: Input with validation (backward compatible)
<Input type="email" placeholder="Email" label="Email Address" error={errors.email?.message} />
```

---

## 5. Delivery Phases

### Phase 1: Button Component Enhancement
**Scope:**
- Add loading state with spinner
- Integrate Framer Motion animations
- Add `aria-busy` attribute
- Write comprehensive tests

**Deliverable:**
- ✅ `components/ui/button.tsx` (enhanced)
- ✅ `__tests__/components/ui/button.test.tsx` (new)
- ✅ Tests pass: `npm run test:unit`
- ✅ No TypeScript errors: `npm run typecheck`

**Verification:**
```bash
npm run test:unit -- button.test.tsx
npm run typecheck
npm run lint
```

### Phase 2: Input Component Enhancement
**Scope:**
- Add label, error, helper text support
- Integrate validation display
- Add focus/error animations
- Write comprehensive tests

**Deliverable:**
- ✅ `components/ui/input.tsx` (enhanced)
- ✅ `__tests__/components/ui/input.test.tsx` (new)
- ✅ Tests include react-hook-form integration
- ✅ Zod validation integration verified

**Verification:**
```bash
npm run test:unit -- input.test.tsx
npm run typecheck
npm run lint
```

### Phase 3: Dialog Component Enhancement
**Scope:**
- Add Framer Motion animations
- Add size variants
- Enhance accessibility
- Write comprehensive tests

**Deliverable:**
- ✅ `components/ui/dialog.tsx` (enhanced)
- ✅ `__tests__/components/ui/dialog.test.tsx` (new)
- ✅ Focus trap verified
- ✅ Animation smoothness verified

**Verification:**
```bash
npm run test:unit -- dialog.test.tsx
npm run typecheck
npm run lint
```

### Phase 4: Skeleton Component Enhancement
**Scope:**
- Add SkeletonButton and SkeletonInput patterns
- Add `prefers-reduced-motion` support
- Enhance accessibility attributes
- Enhance existing tests

**Deliverable:**
- ✅ `components/ui/skeleton.tsx` (enhanced)
- ✅ `__tests__/components/ui/skeleton.test.tsx` (enhanced)
- ✅ New patterns tested
- ✅ Accessibility verified

**Verification:**
```bash
npm run test:unit -- skeleton.test.tsx
npm run typecheck
npm run lint
```

### Phase 5: Integration Testing & Documentation
**Scope:**
- Run full test suite
- Verify test coverage ≥90%
- Verify lint/typecheck passes
- Integration smoke tests (manual)

**Deliverable:**
- ✅ All tests pass: `npm run test:unit`
- ✅ Coverage ≥90%: `npm run test:coverage`
- ✅ No lint errors: `npm run lint`
- ✅ No type errors: `npm run typecheck`

**Verification:**
```bash
npm run test:unit
npm run test:coverage
npm run lint
npm run typecheck
```

---

## 6. Verification Approach

### 6.1 Unit Testing (Jest + Testing Library)

**Test Coverage Requirements:**
- Line coverage: ≥90%
- Branch coverage: ≥90%
- Function coverage: ≥90%
- Statement coverage: ≥90%

**Test Commands:**
```bash
# Run all unit tests
npm run test:unit

# Run specific component tests
npm run test:unit -- button.test.tsx
npm run test:unit -- input.test.tsx
npm run test:unit -- dialog.test.tsx
npm run test:unit -- skeleton.test.tsx

# Run with coverage
npm run test:coverage

# Watch mode (during development)
npm run test:unit:watch
```

**Test Categories (from PRD):**
1. **Rendering:** Component renders, props apply, className merges, ref forwards
2. **Accessibility:** ARIA roles, keyboard nav, screen reader support
3. **Animations:** Hover/tap animations, reduced motion respect
4. **States:** disabled, loading, error states
5. **Integration:** react-hook-form + Zod (Input component)

### 6.2 Type Safety (TypeScript)

**TypeScript Requirements:**
- Strict mode enabled (`tsconfig.json`)
- No `any` types (use `unknown` if necessary)
- Full IntelliSense support for component props
- Generic types for polymorphic components

**Verification Command:**
```bash
npm run typecheck
```

**Expected Output:** `Found 0 errors`

### 6.3 Code Quality (ESLint)

**ESLint Requirements:**
- No errors
- Warnings acceptable with justification (document in code comments)

**Verification Command:**
```bash
npm run lint
```

**Expected Output:** `✓ No ESLint warnings or errors`

### 6.4 Manual Verification Checklist

**Accessibility:**
- [ ] Screen reader announces states correctly (NVDA/JAWS/VoiceOver)
- [ ] Keyboard navigation works (Tab, Enter, Space, Escape)
- [ ] Focus indicators visible on all interactive elements
- [ ] Color contrast meets WCAG AA (4.5:1 for text)

**Animations:**
- [ ] Animations smooth at 60fps (Chrome DevTools Performance)
- [ ] `prefers-reduced-motion` disables animations
- [ ] No layout shift during skeleton → content transition
- [ ] Loading spinners rotate smoothly

**Integration:**
- [ ] Components work with existing Tailwind classes
- [ ] Design tokens applied correctly (inspect CSS variables)
- [ ] Dark mode support (if applicable)
- [ ] Responsive behavior at all breakpoints

**Form Validation:**
- [ ] react-hook-form integration works
- [ ] Zod validation errors display
- [ ] Error messages clear on input change
- [ ] Helper text displays correctly

### 6.5 Performance Benchmarks

**Metrics:**
- Component render time: <50ms
- Animation frame rate: 60fps minimum
- Bundle size impact: <50KB gzipped total
- Individual component: <10KB minified

**Measurement:**
```typescript
// Example: React DevTools Profiler
import { Profiler } from 'react'

<Profiler id="Button" onRender={logRenderTime}>
  <Button loading>Submit</Button>
</Profiler>
```

---

## 7. Dependencies & Constraints

### 7.1 External Dependencies

**All dependencies already installed:**
- ✅ Framer Motion v11.0.0
- ✅ Radix UI (Dialog, Slot, etc.)
- ✅ react-hook-form v7.62.0
- ✅ Zod v3.23.8
- ✅ lucide-react v0.536.0 (for icons)
- ✅ class-variance-authority v0.7.1
- ✅ clsx v2.1.1

**No new dependencies required.**

### 7.2 Browser Support

**Target Browsers:**
- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions
- Safari: Last 2 versions
- Mobile: iOS Safari 14+, Android Chrome 90+

**Polyfills:**
- None required (Next.js handles modern JS features)
- CSS features used are widely supported (CSS Grid, Flexbox, CSS Variables)

### 7.3 Performance Constraints

**Bundle Size:**
- Framer Motion supports tree-shaking
- Import only used components: `import { motion } from "framer-motion"`
- Lazy load animations if needed (Phase 5 optimization)

**Animation Performance:**
- Use GPU-accelerated properties: `transform`, `opacity`
- Avoid animating `width`, `height`, `top`, `left` (causes reflow)
- Use `will-change` sparingly (only during animation)

### 7.4 Accessibility Constraints

**WCAG 2.1 AA Compliance:**
- Color contrast: 4.5:1 for normal text, 3:1 for large text
- Focus indicators: visible and high contrast
- Keyboard navigation: all interactive elements accessible
- Screen reader: semantic HTML and ARIA where needed

**Tools:**
- axe DevTools (browser extension)
- Lighthouse accessibility audit
- NVDA/JAWS/VoiceOver (manual testing)

---

## 8. Risk Assessment & Mitigation

### 8.1 Potential Risks

**Risk 1: Framer Motion Bundle Size**
- **Impact:** Medium - Could increase bundle size significantly
- **Probability:** Low - Framer Motion is tree-shakeable
- **Mitigation:** Import only used components, measure bundle size after each phase

**Risk 2: Animation Performance on Low-End Devices**
- **Impact:** Medium - Janky animations degrade UX
- **Probability:** Medium - Mobile devices may struggle
- **Mitigation:** Use GPU-accelerated properties, respect `prefers-reduced-motion`, test on low-end devices

**Risk 3: Breaking Changes to Existing Components**
- **Impact:** High - Could break existing pages
- **Probability:** Low - All changes are backward compatible
- **Mitigation:** Thorough testing, gradual rollout, component version tagging

**Risk 4: Test Coverage Goals Not Met**
- **Impact:** Medium - Incomplete validation
- **Probability:** Low - Clear testing patterns established
- **Mitigation:** Incremental testing during each phase, automated coverage reports

**Risk 5: Accessibility Regressions**
- **Impact:** High - Breaks usability for assistive tech users
- **Probability:** Low - Radix UI provides accessible primitives
- **Mitigation:** Automated accessibility tests, manual screen reader testing

### 8.2 Rollback Plan

**If critical issues arise:**
1. Revert component file to previous version (`git checkout HEAD~1 components/ui/[component].tsx`)
2. Remove new test files
3. Run verification suite to ensure stability
4. Document issue for future resolution

**Git Strategy:**
- Commit after each phase completion
- Tag releases: `v1.0-phase1`, `v1.0-phase2`, etc.
- Keep main branch stable (merge only after full phase verification)

---

## 9. Success Criteria

### 9.1 Functional Requirements

- ✅ Button component has loading state with spinner
- ✅ Button animations work (hover, tap)
- ✅ Input component displays validation errors
- ✅ Input component integrates with react-hook-form + Zod
- ✅ Dialog component has size variants
- ✅ Dialog animations smooth and configurable
- ✅ Skeleton component has Button/Input patterns
- ✅ All components respect `prefers-reduced-motion`

### 9.2 Quality Requirements

- ✅ Test coverage ≥90% (all components)
- ✅ `npm run test:unit` passes all tests
- ✅ `npm run typecheck` returns 0 errors
- ✅ `npm run lint` returns 0 errors
- ✅ No console warnings during development

### 9.3 Accessibility Requirements

- ✅ All ARIA roles correct (verified in tests)
- ✅ Keyboard navigation functional (verified in tests)
- ✅ Screen reader announcements correct (manual verification)
- ✅ Focus indicators visible (visual verification)
- ✅ Color contrast WCAG AA compliant (Lighthouse audit)

### 9.4 Performance Requirements

- ✅ Animations run at 60fps (Chrome DevTools)
- ✅ Bundle size increase <50KB gzipped (webpack-bundle-analyzer)
- ✅ Component render time <50ms (React Profiler)
- ✅ No layout shift during skeleton transitions (Lighthouse CLS)

### 9.5 Integration Requirements

- ✅ Components use Tailwind v4 CSS variables
- ✅ Components integrate with existing design tokens
- ✅ Components work with existing pages (smoke test)
- ✅ react-hook-form + Zod integration functional

---

## 10. References

### 10.1 Internal References

**Codebase Files:**
- `lib/theme/tokens.ts` - Design token definitions
- `tailwind.config.mjs` - Tailwind configuration
- `app/globals.css` - CSS variables
- `components/ui/button.tsx` - Existing button component
- `components/ui/input.tsx` - Existing input component
- `components/ui/dialog.tsx` - Existing dialog component
- `components/ui/skeleton.tsx` - Existing skeleton component
- `__tests__/components/ui/skeleton.test.tsx` - Test pattern reference

**Documentation:**
- `docs/DESIGN_SYSTEM.md` - Design system guidelines
- `docs/TEST_STRATEGY.md` - Testing approach
- `README_TESTS.md` - Test commands reference

### 10.2 External References

**Library Documentation:**
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
- [Framer Motion Documentation](https://www.framer.com/motion/)
- [Framer Motion useReducedMotion](https://www.framer.com/motion/use-reduced-motion/)
- [react-hook-form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

**Accessibility Guidelines:**
- [WCAG 2.1 AA Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [MDN: ARIA Roles](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)

**Design Patterns:**
- [shadcn/ui](https://ui.shadcn.com/) - Component pattern inspiration

---

## 11. Appendix: Code Snippets

### A.1 Framer Motion Integration Example

```typescript
import { motion, useReducedMotion } from "framer-motion"

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, loading, children, ...props }, ref) => {
    const prefersReducedMotion = useReducedMotion()
    
    const MotionButton = motion.button
    
    return (
      <MotionButton
        ref={ref}
        className={cn(buttonVariants({ className }))}
        whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.2 }}
        aria-busy={loading}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </MotionButton>
    )
  }
)
```

### A.2 Input with Validation Example

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, ...props }, ref) => {
    const inputId = React.useId()
    const helperId = React.useId()
    const errorId = React.useId()
    
    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium">
            {label}
            {props.required && <span className="text-error ml-1">*</span>}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-lg border transition-colors",
            error ? "border-error" : "border-neutral-200 focus:border-brand-primary",
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          aria-required={props.required}
          {...props}
        />
        {helperText && !error && (
          <p id={helperId} className="text-sm text-neutral-600">
            {helperText}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
      </div>
    )
  }
)
```

### A.3 Test Pattern Example

```typescript
describe('Button', () => {
  describe('Loading State', () => {
    it('displays loading spinner when loading prop is true', () => {
      render(<Button loading>Submit</Button>)
      
      const spinner = screen.getByRole('button').querySelector('svg')
      expect(spinner).toBeInTheDocument()
      expect(spinner).toHaveClass('animate-spin')
    })
    
    it('sets aria-busy="true" when loading', () => {
      render(<Button loading>Submit</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-busy', 'true')
    })
    
    it('disables button when loading', () => {
      render(<Button loading>Submit</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })
  })
})
```

---

**Document Status:** ✅ Ready for Planning Phase

**Next Steps:** Create detailed implementation plan in `plan.md`
