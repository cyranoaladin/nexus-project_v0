# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: 473a8f2b-a29b-4c97-acd0-96363902b170 -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: 4111dca8-571d-43c3-9159-ba1369cb016a -->

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
<!-- chat-id: 19b61fa8-ec22-4c40-a82b-0d93fb50e4b5 -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function) or too broad (entire feature).

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

---

## Implementation Steps

### [x] Step: Create Navigation Configuration
<!-- chat-id: cabbb1ae-a928-45d9-9a0e-5a4010f4fb05 -->

Create the type-safe navigation configuration file with all role mappings.

**File:** `/components/navigation/navigation-config.ts`

**Tasks:**
- Define `NavigationItem` interface with label, href, icon, optional badge
- Import icons from `lucide-react`: Home, Calendar, Users, BookOpen, CreditCard, DollarSign, Clock, UserCheck, AlertCircle, BarChart, Activity, TestTube
- Create `navigationConfig: Record<UserRole, NavigationItem[]>` with all 5 roles
- Map navigation items per role as specified in requirements.md:
  - ELEVE: Dashboard, Mes Sessions, Réserver Session, Ressources
  - PARENT: Dashboard, Mes Enfants, Abonnements, Paiements
  - COACH: Dashboard, Mes Sessions, Mes Étudiants, Disponibilités
  - ASSISTANTE: Dashboard, Étudiants, Coaches, Abonnements, Demandes Crédits, Paiements
  - ADMIN: Dashboard, Utilisateurs, Analytics, Abonnements, Activités, Tests Système

**Verification:**
- TypeScript compiles with no errors
- All UserRole enum values are present in navigationConfig
- All hrefs match existing dashboard routes

---

### [x] Step: Create NavigationItem Component
<!-- chat-id: 86c733ef-9f6e-44fc-90f1-de909ee1ebe5 -->

Create the interactive navigation link component with active state detection.

**File:** `/components/navigation/NavigationItem.tsx`

**Tasks:**
- Mark as Client Component (`"use client"`)
- Define `NavigationItemProps` interface
- Use `usePathname()` from `next/navigation` for active detection
- Implement CVA variants for active/inactive states
- Render icon, label, and optional badge
- Add ARIA attributes (`aria-current="page"` for active)
- Style with Tailwind: rounded-micro, hover states, focus-visible ring

**Styling:**
- Active: `bg-brand-primary text-white shadow-sm`
- Inactive: `text-neutral-400 hover:bg-surface-hover hover:text-neutral-50`
- Focus: `focus-visible:ring-2 focus-visible:ring-brand-primary`

**Verification:**
- Component renders correctly
- Active state detection works
- Hover and focus styles apply
- TypeScript types are correct

---

### [x] Step: Create UserProfile Component
<!-- chat-id: ed4ecd91-b43e-4c50-ac5c-9bb36bf12091 -->

Create the user profile display component for the sidebar.

**File:** `/components/navigation/UserProfile.tsx`

**Tasks:**
- Mark as Client Component
- Define `UserProfileProps` with user from Session
- Use Radix UI Avatar component
- Display initials fallback from firstName/lastName
- Show user's full name and role badge
- Style as compact card design

**Verification:**
- Avatar displays correctly with initials
- User name and role render properly
- Styling matches design tokens
- TypeScript compiles

---

### [x] Step: Create LogoutButton Component
<!-- chat-id: 5378aeff-6824-4dbd-8971-b67e1ab39faa -->

Create the sign-out button component.

**File:** `/components/navigation/LogoutButton.tsx`

**Tasks:**
- Mark as Client Component
- Import `signOut` from `next-auth/react`
- Use LogOut icon from `lucide-react`
- Use Button component from `/components/ui/button.tsx`
- Set variant to "ghost"
- Call `signOut({ callbackUrl: '/' })` on click

**Verification:**
- Button renders correctly
- Click triggers sign out
- Redirects to home page after sign out
- Styling is consistent with design system

---

### [x] Step: Create Sidebar Component
<!-- chat-id: 1e3d5698-b2b3-43f2-befa-562eb52d3b1d -->

Create the main sidebar navigation server component.

**File:** `/components/navigation/Sidebar.tsx`

**Tasks:**
- Create async Server Component
- Import `getServerSession` from `next-auth` and `authOptions` from `/lib/auth`
- Fetch session and handle missing session (redirect to `/auth/signin`)
- Get user role from session
- Filter navigationConfig by role
- Render sidebar structure:
  - Logo/brand section
  - UserProfile component with session.user
  - Navigation list with NavigationItem components
  - LogoutButton at bottom
- Apply responsive classes: hidden on mobile, fixed on desktop (lg:flex lg:fixed)
- Style: 280px width, bg-surface-card, border-r border-neutral-800

**Verification:**
- Server Component fetches session correctly
- Correct nav items displayed per role
- Sidebar visible on desktop, hidden on mobile
- All child components render properly
- TypeScript compiles

---

### [x] Step: Create Navbar Component
<!-- chat-id: b65abf58-e3ff-46a6-8090-f1661a3e8680 -->

Create the top navigation bar server component.

**File:** `/components/navigation/Navbar.tsx`

**Tasks:**
- Create async Server Component
- Fetch session (same pattern as Sidebar)
- Render header structure:
  - Mobile menu toggle button (visible on mobile)
  - Logo (mobile only, hidden on desktop)
  - User dropdown placeholder (desktop)
- Apply sticky positioning: `sticky top-0 z-50`
- Add left padding on desktop for sidebar: `lg:pl-72`
- Style: bg-surface-card, border-b border-neutral-800, h-16

**Verification:**
- Navbar renders correctly
- Sticky positioning works
- Responsive classes apply correctly
- TypeScript compiles

---

### [x] Step: Create MobileMenu Component
<!-- chat-id: 87005f7e-e455-44fc-9f10-81fb53a0a726 -->

Create the mobile overlay menu with slide-in animation.

**File:** `/components/navigation/MobileMenu.tsx`

**Tasks:**
- Mark as Client Component
- Define `MobileMenuProps` with items and user
- Use `useState` for open/closed state
- Export context or hook for controlling menu state
- Implement slide-in animation with Tailwind transitions
- Add backdrop: `bg-black/50 backdrop-blur-sm`
- Add close button with X icon
- Implement click-outside to close
- Implement Escape key to close
- Render NavigationItem components for each item
- Include UserProfile and LogoutButton

**Styling:**
- Menu width: w-80 (320px)
- Slide animation: translate-x-0 vs translate-x-full
- Z-index: z-40 (below navbar)
- Hidden on desktop: lg:hidden

**Verification:**
- Menu opens and closes smoothly
- Backdrop displays correctly
- Click outside closes menu
- Escape key closes menu
- Navigation items work correctly
- Animations are smooth (60fps)

---

### [x] Step: Connect MobileMenu to Navbar
<!-- chat-id: c2bea512-23d8-4536-a121-1ca7867d5583 -->

Integrate mobile menu toggle functionality between Navbar and MobileMenu.

**Tasks:**
- Create shared state management for mobile menu (Context or URL state)
- Add MobileMenuToggle button component in Navbar
- Pass filtered navigation items to MobileMenu
- Add hamburger icon (Menu from lucide-react)
- Add ARIA attributes: `aria-label`, `aria-expanded`
- Ensure menu toggle is visible only on mobile

**Verification:**
- Clicking hamburger opens mobile menu
- Menu state syncs correctly
- ARIA attributes update correctly
- Mobile-only visibility works

---

### [x] Step: Create Role Access Tests
<!-- chat-id: b75339a4-e877-4a83-8b52-0d49272b8925 -->

Create comprehensive tests for role-based navigation access.

**File:** `/tests/navigation/role-access.test.ts`

**Tasks:**
- Import navigationConfig and UserRole
- Test 1: Admin links hidden for ELEVE role
- Test 2: Admin links visible for ADMIN role
- Test 3: Correct links for each role (PARENT, COACH, ASSISTANTE)
- Test 4: Navigation config defined for all roles
- Test 5: No duplicate hrefs in any role config
- Use describe blocks to organize by role

**Test Structure:**
```
describe('Navigation Role Access', () => {
  describe('ELEVE role', () => { ... })
  describe('ADMIN role', () => { ... })
  describe('All roles', () => { ... })
})
```

**Verification:**
- All tests pass: `npm run test:unit`
- Test coverage includes all requirements
- Assertions are clear and specific

---

### [ ] Step: Add Accessibility Features

Enhance navigation components with WCAG 2.1 AA compliance features.

**Tasks:**
- Add semantic HTML: Ensure `<nav>`, `<ul>`, `<li>`, `<a>` are used
- Add ARIA labels to all interactive elements
- Add `aria-current="page"` to active links
- Add `role="dialog"` and `aria-modal="true"` to MobileMenu
- Test keyboard navigation (Tab, Escape)
- Verify focus states are visible
- Test color contrast ratios
- Add focus trap in mobile menu

**Verification:**
- Manual keyboard navigation test passes
- Screen reader announces navigation correctly
- All interactive elements have proper labels
- Focus is trapped in mobile menu when open
- Color contrast meets WCAG AA (4.5:1)

---

### [ ] Step: Run Quality Checks

Run all verification commands to ensure code quality.

**Tasks:**
- Run TypeScript compiler: `npm run typecheck`
- Run linter: `npm run lint`
- Run unit tests: `npm run test:unit`
- Fix any errors or warnings
- Verify bundle size impact is < 20KB
- Check for console errors in browser

**Verification:**
- All commands pass with 0 errors
- No TypeScript errors
- No lint errors
- All unit tests pass
- No console errors

**Record Results:**
Document the output of each command here:
- `npm run typecheck`: 
- `npm run lint`: 
- `npm run test:unit`:
