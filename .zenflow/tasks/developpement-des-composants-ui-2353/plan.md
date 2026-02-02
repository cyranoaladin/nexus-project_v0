# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: 86ecf6ae-d522-4391-a249-6013f46d617c -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: 09149aaa-5e6a-4c61-af70-4cf8badfce6c -->

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
<!-- chat-id: 17b6dc2f-47e9-4660-987f-887a86178098 -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function) or too broad (entire feature).

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

---

## Implementation Steps

### [x] Step: Button Component Enhancement
<!-- chat-id: 4f0c74d4-c9b6-4e29-a037-fb7af3ed119d -->

Enhance the existing Button component with loading state and Framer Motion animations.

**Tasks:**
- [x] Add Framer Motion integration (`motion.button` wrapper)
- [x] Add `loading` prop with spinner icon (lucide-react `Loader2`)
- [x] Implement hover/tap animations with `useReducedMotion` hook
- [x] Add `aria-busy` attribute when loading
- [x] Ensure disabled state prevents interaction when loading

**Contract Reference:** `spec.md` Section 3.1, 4.1, A.1

**Files Modified:**
- `components/ui/button.tsx`

**Verification:**
```bash
npm run typecheck
npm run lint
```

### [x] Step: Button Component Tests
<!-- chat-id: be679d00-a1c1-4eb9-9926-5db3a6ef34a1 -->

Write comprehensive tests for the enhanced Button component.

**Test Coverage:**
- [x] Rendering: All variants, sizes, loading state
- [x] Accessibility: ARIA attributes (`aria-busy`), keyboard navigation, focus management
- [x] Animations: Hover/tap animations, reduced motion respect
- [x] States: disabled, loading, interaction prevention
- [x] Edge cases: Long text, with icons, async onClick

**Contract Reference:** `spec.md` Section 3.2, 6.1, A.3

**Files Created:**
- `__tests__/components/ui/button.test.tsx`

**Verification:**
```bash
npm run test:unit -- button.test.tsx
npm run test:coverage -- button.test.tsx
```
**Expected:** Coverage ≥90%, all tests pass

### [x] Step: Input Component Enhancement
<!-- chat-id: fac7da3f-bc14-48d7-b99f-02e4a15f17dd -->

Enhance the existing Input component with validation integration and animations.

**Tasks:**
- [x] Add `label`, `error`, `helperText`, `icon`, `iconPosition` props
- [x] Implement proper label/input association with `useId()`
- [x] Add error display with `role="alert"` for screen readers
- [x] Add helper text with `aria-describedby`
- [x] Add focus border transition animation
- [x] Add error shake animation (CSS keyframes)
- [x] Implement proper ARIA attributes (`aria-invalid`, `aria-required`, `aria-describedby`)

**Contract Reference:** `spec.md` Section 3.1, 4.1, A.2

**Files Modified:**
- `components/ui/input.tsx`

**Verification:**
```bash
npm run typecheck
npm run lint
```

### [ ] Step: Input Component Tests

Write comprehensive tests for the enhanced Input component including form validation integration.

**Test Coverage:**
- [ ] Rendering: Label, error, helper text, icon positions
- [ ] Accessibility: Label association, ARIA attributes, keyboard behavior
- [ ] Validation: react-hook-form + Zod integration
- [ ] Animations: Focus transition, error shake animation
- [ ] States: disabled, required, various input types
- [ ] Edge cases: Missing label, long error messages, special characters

**Contract Reference:** `spec.md` Section 3.2, 6.1

**Files Created:**
- `__tests__/components/ui/input.test.tsx`

**Verification:**
```bash
npm run test:unit -- input.test.tsx
npm run test:coverage -- input.test.tsx
```
**Expected:** Coverage ≥90%, all tests pass, validation integration works

### [ ] Step: Dialog Component Enhancement

Enhance the existing Dialog component with Framer Motion animations and size variants.

**Tasks:**
- [ ] Replace Radix data-state animations with Framer Motion
- [ ] Add `size` prop: `sm`, `md`, `lg`, `xl`, `full`
- [ ] Use `AnimatePresence` for enter/exit animations
- [ ] Implement overlay fade animation (opacity 0 → 0.8)
- [ ] Implement content animations (fade, scale, slide)
- [ ] Add size-based max-width classes
- [ ] Ensure accessibility is preserved (Radix handles ARIA)

**Contract Reference:** `spec.md` Section 3.1, 4.1

**Files Modified:**
- `components/ui/dialog.tsx`

**Verification:**
```bash
npm run typecheck
npm run lint
```

### [ ] Step: Dialog Component Tests

Write comprehensive tests for the enhanced Dialog component.

**Test Coverage:**
- [ ] Rendering: All sizes, title, description rendering
- [ ] Accessibility: Dialog role, ARIA attributes, focus trap, keyboard navigation
- [ ] Animations: Overlay fade, content animations (fade/scale/slide), reduced motion
- [ ] Interaction: Overlay click to close, escape key, close button
- [ ] Edge cases: Nested content, long content, scroll behavior

**Contract Reference:** `spec.md` Section 3.2, 6.1

**Files Created:**
- `__tests__/components/ui/dialog.test.tsx`

**Verification:**
```bash
npm run test:unit -- dialog.test.tsx
npm run test:coverage -- dialog.test.tsx
```
**Expected:** Coverage ≥90%, all tests pass, focus trap verified

### [ ] Step: Skeleton Component Enhancement

Enhance the existing Skeleton component with new patterns and improved accessibility.

**Tasks:**
- [ ] Add `SkeletonButton` component (mimics button dimensions)
- [ ] Add `SkeletonInput` component (mimics input dimensions)
- [ ] Add automatic `prefers-reduced-motion` detection (set `animation="none"`)
- [ ] Add `aria-busy="true"` by default
- [ ] Add optional `aria-label` and `aria-live="polite"` props

**Contract Reference:** `spec.md` Section 3.1, 4.1

**Files Modified:**
- `components/ui/skeleton.tsx`

**Verification:**
```bash
npm run typecheck
npm run lint
```

### [ ] Step: Skeleton Component Tests Enhancement

Enhance existing Skeleton tests to cover new patterns and accessibility improvements.

**Test Coverage:**
- [ ] New patterns: SkeletonButton, SkeletonInput rendering
- [ ] Accessibility: `aria-busy`, `aria-label`, `aria-live` attributes
- [ ] Reduced motion: Automatic animation disabling
- [ ] Edge cases: All animation variants with new patterns

**Contract Reference:** `spec.md` Section 3.2, 6.1

**Files Modified:**
- `__tests__/components/ui/skeleton.test.tsx`

**Verification:**
```bash
npm run test:unit -- skeleton.test.tsx
npm run test:coverage -- skeleton.test.tsx
```
**Expected:** Coverage ≥90%, all tests pass

### [ ] Step: Integration Testing & Final Verification

Run full test suite and verify all quality requirements are met.

**Tasks:**
- [ ] Run full test suite: `npm run test:unit`
- [ ] Verify test coverage ≥90%: `npm run test:coverage`
- [ ] Verify no lint errors: `npm run lint`
- [ ] Verify no TypeScript errors: `npm run typecheck`
- [ ] Review test output for warnings
- [ ] Document any known issues or limitations

**Contract Reference:** `spec.md` Section 6.1, 6.2, 6.3, 9.2

**Verification:**
```bash
npm run test:unit
npm run test:coverage
npm run lint
npm run typecheck
```

**Expected Results:**
- ✅ All tests pass
- ✅ Coverage ≥90% (line, branch, function, statement)
- ✅ No lint errors
- ✅ No TypeScript errors
- ✅ No console warnings

**Success Criteria Met:**
- All components enhanced with Framer Motion animations
- All components have comprehensive test coverage
- All components use Tailwind v4 CSS variables
- All components are accessible (WCAG 2.1 AA compliant)
- Input component integrates with react-hook-form + Zod
- All components respect `prefers-reduced-motion`
