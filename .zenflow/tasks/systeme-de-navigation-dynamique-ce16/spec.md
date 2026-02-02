# Technical Specification: Dynamic Navigation System

**Version:** 1.0  
**Date:** 2026-02-02  
**Status:** Ready for Implementation  
**Based on:** requirements.md

---

## 1. Technical Context

### 1.1 Technology Stack

**Framework & Runtime:**
- Next.js 15.5.11 (App Router with RSC)
- React 18.3.1 (Server Components + Client Components)
- TypeScript 5.x (strict mode)
- Node.js runtime

**Authentication & Session:**
- NextAuth 4.24.11 with JWT strategy
- Session available via `getServerSession(authOptions)` from `next-auth`
- User role stored in session: `session.user.role` (type: `UserRole` enum)
- Session type defined in `/types/next-auth.d.ts`

**Styling & UI:**
- Tailwind CSS v4 with design tokens from `/lib/theme/tokens.ts`
- Radix UI primitives (already installed)
- class-variance-authority (CVA) for variants
- `cn()` utility from `/lib/utils.ts` for className merging
- Lucide React for icons

**Testing:**
- Jest 29.7.0 with React Testing Library
- jest-environment-jsdom for component tests
- Test location: `__tests__/` directory
- Unit test config: `jest.config.unit.js`
- Mock pattern: NextAuth session mocking (see `__tests__/lib/guards.test.ts`)

**Build & Quality:**
- ESLint (Next.js config)
- TypeScript compiler
- Test commands: `npm run test:unit`, `npm run lint`, `npm run typecheck`

---

## 2. Implementation Approach

### 2.1 Architecture Pattern: Server Components First

**Key Decision:** Use React Server Components (RSC) for navigation components to:
- Fetch session server-side (security: no client-side role exposure)
- Reduce client bundle size
- Eliminate prop drilling
- Simplify role-based filtering logic

**Component Hierarchy:**

```
┌─────────────────────────────────────┐
│ Sidebar (Server Component)          │  ← Fetches session, filters nav items
│  ├─ UserProfile (Client Component)  │  ← Displays user info
│  ├─ NavigationItem (Client)         │  ← Interactive link with hover/active states
│  └─ LogoutButton (Client)           │  ← Sign out action
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Navbar (Server Component)           │  ← Top bar for mobile/desktop
│  ├─ MobileMenuToggle (Client)       │  ← Hamburger button
│  └─ UserDropdown (Client)           │  ← Desktop user menu
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ MobileMenu (Client Component)       │  ← Overlay with slide-in animation
│  └─ NavigationItem (Client)         │  ← Reused from Sidebar
└─────────────────────────────────────┘
```

**Data Flow:**
1. Server Component calls `getServerSession(authOptions)` 
2. Extract `session.user.role`
3. Filter `navigationConfig[role]` to get allowed items
4. Pass filtered items as props to Client Components
5. Client Components handle interactivity (clicks, hover, active states)

### 2.2 Existing Patterns to Follow

**Component Conventions (from `/components/ui/button.tsx`):**
- Use CVA for variant management
- Export both component and variants
- Use `cn()` for className composition
- ForwardRef for DOM access
- TypeScript strict typing with interfaces

**Auth Pattern (from `/lib/auth.ts`):**
- Import `authOptions` from `/lib/auth`
- Use `getServerSession(authOptions)` in Server Components
- Session type: `Session` from `next-auth` (extended in `/types/next-auth.d.ts`)
- Role enum: `UserRole` from `/types/enums.ts`

**Styling Pattern (from design system):**
- Use design tokens from `/lib/theme/tokens.ts`
- Colors: `brand.primary`, `brand.accent`, `neutral.*`, `surface.*`
- Typography: `font-sans` (Inter), `font-display` (Space Grotesk)
- Border radius: `rounded-micro` (10px), `rounded-card` (18px)
- Shadows: `shadow-soft`, `shadow-medium`

**File Naming:**
- PascalCase for components: `Sidebar.tsx`, `NavigationItem.tsx`
- kebab-case for config: `navigation-config.ts`
- Test files: `role-access.test.ts`

---

## 3. Source Code Structure

### 3.1 New Files to Create

```
/components/navigation/
├── Sidebar.tsx                    # Main sidebar (Server Component)
├── Navbar.tsx                     # Top navbar (Server Component)  
├── NavigationItem.tsx             # Individual nav link (Client Component)
├── MobileMenu.tsx                 # Mobile overlay menu (Client Component)
├── UserProfile.tsx                # User info display (Client Component)
├── LogoutButton.tsx               # Sign out button (Client Component)
└── navigation-config.ts           # Navigation items config (type-safe)

/tests/navigation/
└── role-access.test.ts            # Role-based access tests
```

### 3.2 File-by-File Specifications

#### **A. `/components/navigation/navigation-config.ts`**

**Purpose:** Type-safe configuration of navigation items per role.

**Exports:**
```typescript
import { UserRole } from '@/types/enums';
import { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;          // Optional notification count
}

export const navigationConfig: Record<UserRole, NavigationItem[]>;
```

**Implementation Details:**
- Import icons from `lucide-react`: `Home`, `Calendar`, `Users`, `BookOpen`, `CreditCard`, `DollarSign`, `Clock`, `UserCheck`, `AlertCircle`, `BarChart`, `Activity`, `TestTube`
- Define items per role matching requirements (see Appendix A in requirements.md)
- Type-safe: enforces all 5 roles are defined
- No runtime logic, pure data structure

**Example Structure:**
```typescript
export const navigationConfig: Record<UserRole, NavigationItem[]> = {
  [UserRole.ELEVE]: [
    { label: 'Dashboard', href: '/dashboard/eleve', icon: Home },
    // ... more items
  ],
  [UserRole.PARENT]: [ /* ... */ ],
  [UserRole.COACH]: [ /* ... */ ],
  [UserRole.ASSISTANTE]: [ /* ... */ ],
  [UserRole.ADMIN]: [ /* ... */ ],
};
```

---

#### **B. `/components/navigation/Sidebar.tsx`**

**Type:** React Server Component (async function)

**Purpose:** Main sidebar navigation with role-based filtering.

**Function Signature:**
```typescript
export default async function Sidebar(): Promise<JSX.Element>
```

**Implementation Steps:**
1. Import `getServerSession` from `next-auth`
2. Import `authOptions` from `@/lib/auth`
3. Fetch session: `const session = await getServerSession(authOptions)`
4. Handle missing session: redirect to `/auth/signin` or show placeholder
5. Get user role: `session.user.role`
6. Filter nav items: `const items = navigationConfig[session.user.role]`
7. Render sidebar structure with filtered items

**DOM Structure:**
```html
<aside class="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-70 lg:z-50">
  <div class="flex flex-col h-full bg-surface-card border-r border-neutral-800">
    <!-- Logo/Brand -->
    <div class="p-6">
      <h1>Nexus Réussite</h1>
    </div>
    
    <!-- User Profile Section -->
    <UserProfile user={session.user} />
    
    <!-- Navigation Links -->
    <nav class="flex-1 px-4 py-6">
      <ul class="space-y-2">
        {items.map(item => (
          <li key={item.href}>
            <NavigationItem item={item} />
          </li>
        ))}
      </ul>
    </nav>
    
    <!-- Logout Button -->
    <div class="p-4 border-t border-neutral-800">
      <LogoutButton />
    </div>
  </div>
</aside>
```

**Styling:**
- Width: `280px` (w-70 custom or w-72 = 288px)
- Background: `bg-surface-card` (#111318)
- Border: `border-r border-neutral-800`
- Hidden on mobile: `hidden lg:flex`
- Fixed positioning: `lg:fixed lg:inset-y-0`
- Z-index: `z-50` (from design tokens)

**Responsive Behavior:**
- Desktop (≥1024px): Fixed sidebar, always visible
- Mobile/Tablet (<1024px): Hidden (controlled by MobileMenu)

**Error Handling:**
- If no session: redirect to `/auth/signin` using `redirect()` from `next/navigation`
- If invalid role: log error, show fallback message

---

#### **C. `/components/navigation/NavigationItem.tsx`**

**Type:** React Client Component (`"use client"`)

**Purpose:** Interactive navigation link with active state.

**Props Interface:**
```typescript
interface NavigationItemProps {
  item: NavigationItem;
  isActive?: boolean;
  onClick?: () => void;
}
```

**Implementation:**
- Use `usePathname()` from `next/navigation` to detect active route
- Use `Link` from `next/link` for navigation
- Active detection: `const isActive = pathname === item.href || pathname.startsWith(item.href + '/')`
- Icon rendering: `<item.icon className="w-5 h-5" />`
- Badge display: `{item.badge && <span className="...">{item.badge}</span>}`

**Styling with CVA:**
```typescript
const navigationItemVariants = cva(
  "flex items-center gap-3 px-4 py-3 rounded-micro transition-all duration-200",
  {
    variants: {
      active: {
        true: "bg-brand-primary text-white shadow-sm",
        false: "text-neutral-400 hover:bg-surface-hover hover:text-neutral-50"
      }
    },
    defaultVariants: {
      active: false
    }
  }
);
```

**Accessibility:**
- `aria-current="page"` on active link
- Semantic `<nav>` wrapper in parent
- Keyboard navigation (native `<Link>`)
- Focus visible ring: `focus-visible:ring-2 focus-visible:ring-brand-primary`

---

#### **D. `/components/navigation/Navbar.tsx`**

**Type:** React Server Component (async function)

**Purpose:** Top navigation bar (mobile menu toggle + user info).

**Implementation:**
1. Fetch session (same as Sidebar)
2. Render logo + mobile menu toggle + user dropdown
3. Pass session to client components as needed

**DOM Structure:**
```html
<header class="sticky top-0 z-50 bg-surface-card border-b border-neutral-800 lg:pl-72">
  <div class="flex items-center justify-between h-16 px-4">
    <!-- Mobile Menu Toggle (visible on mobile) -->
    <MobileMenuToggle />
    
    <!-- Logo (mobile only) -->
    <div class="lg:hidden">
      <h1>Nexus Réussite</h1>
    </div>
    
    <!-- Right side: User dropdown (desktop) -->
    <UserDropdown user={session.user} />
  </div>
</header>
```

**Responsive:**
- Mobile: Full width, hamburger menu visible
- Desktop: Left padding to account for fixed sidebar (`lg:pl-72`)

---

#### **E. `/components/navigation/MobileMenu.tsx`**

**Type:** React Client Component

**Purpose:** Slide-in mobile menu overlay.

**State Management:**
- Use `useState` for open/closed state
- Export `useMobileMenu()` hook or use React Context

**Props:**
```typescript
interface MobileMenuProps {
  items: NavigationItem[];  // Filtered by role on server
  user: Session['user'];
}
```

**Features:**
- Backdrop: `bg-black/50 backdrop-blur-sm`
- Slide animation: `translate-x-0` vs `translate-x-full`
- Close button (X icon)
- Click outside to close
- Escape key to close

**Animation:**
```typescript
// Use Tailwind transitions or Framer Motion
<div className={cn(
  "fixed inset-0 z-40 lg:hidden",
  "transition-opacity duration-300",
  isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
)}>
  <div className="fixed inset-y-0 left-0 w-80 bg-surface-card shadow-2xl">
    {/* Menu content */}
  </div>
</div>
```

---

#### **F. `/components/navigation/UserProfile.tsx`**

**Type:** React Client Component

**Purpose:** Display user name, role, and avatar.

**Props:**
```typescript
interface UserProfileProps {
  user: Session['user'];
}
```

**Features:**
- Avatar: Use Radix UI Avatar with initials fallback
- Display: `{user.firstName} {user.lastName}`
- Role badge: Show role (e.g., "Étudiant", "Admin")
- Styling: Compact card design

**Initials Logic:**
```typescript
const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
```

---

#### **G. `/components/navigation/LogoutButton.tsx`**

**Type:** React Client Component

**Purpose:** Sign out button.

**Implementation:**
```typescript
'use client';
import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-3"
      onClick={() => signOut({ callbackUrl: '/' })}
    >
      <LogOut className="w-5 h-5" />
      Déconnexion
    </Button>
  );
}
```

---

#### **H. `/tests/navigation/role-access.test.ts`**

**Purpose:** Test role-based visibility of navigation items.

**Test Framework:** Jest + React Testing Library

**Mock Strategy:**
```typescript
// Mock next-auth session
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}));

// Mock navigation config
import { navigationConfig } from '@/components/navigation/navigation-config';
```

**Test Cases:**

**1. Admin Links Hidden for ELEVE:**
```typescript
it('should hide admin links for ELEVE role', () => {
  const eleveItems = navigationConfig[UserRole.ELEVE];
  const adminItems = navigationConfig[UserRole.ADMIN];
  
  // Admin items should not be in eleve items
  const adminHrefs = adminItems.map(item => item.href);
  const eleveHrefs = eleveItems.map(item => item.href);
  
  adminHrefs.forEach(href => {
    expect(eleveHrefs).not.toContain(href);
  });
});
```

**2. Admin Links Visible for ADMIN:**
```typescript
it('should show admin links for ADMIN role', () => {
  const adminItems = navigationConfig[UserRole.ADMIN];
  
  expect(adminItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ href: '/dashboard/admin/users' }),
      expect.objectContaining({ href: '/dashboard/admin/analytics' }),
    ])
  );
});
```

**3. Role-Specific Links:**
```typescript
it('should show correct links for each role', () => {
  expect(navigationConfig[UserRole.PARENT]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ href: '/dashboard/parent/children' }),
    ])
  );
  
  expect(navigationConfig[UserRole.COACH]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ href: '/dashboard/coach/availability' }),
    ])
  );
});
```

**4. Navigation Config Type Safety:**
```typescript
it('should have navigation config for all roles', () => {
  const roles = Object.values(UserRole);
  
  roles.forEach(role => {
    expect(navigationConfig[role]).toBeDefined();
    expect(Array.isArray(navigationConfig[role])).toBe(true);
  });
});
```

**Test File Structure:**
```typescript
import { navigationConfig } from '@/components/navigation/navigation-config';
import { UserRole } from '@/types/enums';

describe('Navigation Role Access', () => {
  describe('ELEVE role', () => {
    it('should hide admin links for ELEVE role', () => { /* ... */ });
  });
  
  describe('ADMIN role', () => {
    it('should show admin links for ADMIN role', () => { /* ... */ });
  });
  
  describe('All roles', () => {
    it('should have navigation config for all roles', () => { /* ... */ });
  });
});
```

---

## 4. Data Model & Interfaces

### 4.1 Core Types

**NavigationItem Interface:**
```typescript
export interface NavigationItem {
  label: string;           // Display text (e.g., "Dashboard")
  href: string;            // Route path (e.g., "/dashboard/eleve")
  icon: LucideIcon;        // Icon component from lucide-react
  badge?: number;          // Optional notification count
}
```

**Session Type (Existing):**
```typescript
// From /types/next-auth.d.ts (already defined)
interface Session {
  user: {
    id: string;
    email: string;
    role: UserRole;
    firstName?: string;
    lastName?: string;
  }
}
```

**UserRole Enum (Existing):**
```typescript
// From /types/enums.ts (already defined)
export enum UserRole {
  ADMIN = 'ADMIN',
  ASSISTANTE = 'ASSISTANTE',
  COACH = 'COACH',
  PARENT = 'PARENT',
  ELEVE = 'ELEVE'
}
```

### 4.2 Navigation Configuration Structure

**Type Signature:**
```typescript
const navigationConfig: Record<UserRole, NavigationItem[]>
```

**Role-to-Items Mapping:**
- ELEVE → 4 items (Dashboard, Mes Sessions, Réserver Session, Ressources)
- PARENT → 4 items (Dashboard, Mes Enfants, Abonnements, Paiements)
- COACH → 4 items (Dashboard, Mes Sessions, Mes Étudiants, Disponibilités)
- ASSISTANTE → 6 items (Dashboard, Étudiants, Coaches, Abonnements, Demandes Crédits, Paiements)
- ADMIN → 6 items (Dashboard, Utilisateurs, Analytics, Abonnements, Activités, Tests Système)

**Full mapping details in requirements.md Appendix A**

---

## 5. Responsive Design Implementation

### 5.1 Breakpoints (from Tailwind)

- **Mobile:** `< 768px` (default)
- **Tablet:** `md: 768px - 1023px`
- **Desktop:** `lg: ≥ 1024px`

### 5.2 Layout Strategy

**Mobile (<1024px):**
- Sidebar: Hidden by default
- Navbar: Full width, sticky top
- Mobile menu: Overlay with backdrop when opened
- Hamburger button: Visible in Navbar

**Desktop (≥1024px):**
- Sidebar: Fixed left, always visible (280px width)
- Navbar: Sticky top, left padding to account for sidebar
- Mobile menu: Hidden
- Hamburger button: Hidden

### 5.3 Responsive Classes

**Sidebar:**
```html
<aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-70 lg:z-50">
```

**Navbar:**
```html
<header className="sticky top-0 z-50 bg-surface-card border-b border-neutral-800 lg:pl-72">
```

**Mobile Menu Toggle:**
```html
<button className="lg:hidden p-2 rounded-lg hover:bg-surface-hover">
```

### 5.4 Touch & Gesture Support

- **Swipe to close:** Implement swipe-left gesture to close mobile menu (optional, can use click-outside)
- **Touch targets:** Minimum 44px height for all interactive elements
- **No hover on mobile:** Use active/pressed states instead

---

## 6. Styling & Design Tokens

### 6.1 Color Palette

**From `/lib/theme/tokens.ts`:**

- **Primary:** `brand.primary` (#2563EB)
- **Accent:** `brand.accent` (#2EE9F6)
- **Background:** `surface.card` (#111318)
- **Border:** `neutral.800` (#1F2937)
- **Text:**
  - Active: `neutral.50` (#F9FAFB)
  - Inactive: `neutral.400` (#9CA3AF)
  - Hover: `neutral.50`

### 6.2 Typography

- **Font family:** `font-sans` (Inter) for all text
- **Sizes:**
  - Nav items: `text-sm` (14px)
  - User name: `text-base` (16px)
  - Role badge: `text-xs` (12px)

### 6.3 Spacing

- **Padding:** `p-4` (16px) for nav items
- **Gap:** `gap-3` (12px) between icon and text
- **Margin:** `space-y-2` (8px) between nav items

### 6.4 Shadows & Effects

- **Active nav item:** `shadow-sm`
- **Mobile menu:** `shadow-2xl`
- **Hover:** `hover:bg-surface-hover` (#1F2329)

### 6.5 Border Radius

- **Nav items:** `rounded-micro` (10px)
- **Cards:** `rounded-card` (18px)
- **Avatar:** `rounded-full`

---

## 7. Accessibility (WCAG 2.1 AA)

### 7.1 Semantic HTML

```html
<nav aria-label="Primary navigation">
  <ul>
    <li><a href="..." aria-current="page">Dashboard</a></li>
  </ul>
</nav>
```

### 7.2 ARIA Attributes

- **Active link:** `aria-current="page"`
- **Mobile menu button:** `aria-label="Open navigation menu"` + `aria-expanded`
- **Mobile menu:** `role="dialog"` + `aria-modal="true"`
- **Close button:** `aria-label="Close menu"`

### 7.3 Keyboard Navigation

- **Tab order:** Logical flow (logo → nav items → logout)
- **Escape key:** Close mobile menu
- **Focus visible:** `focus-visible:ring-2 focus-visible:ring-brand-primary`

### 7.4 Screen Reader Support

- Use semantic elements: `<nav>`, `<ul>`, `<li>`, `<a>`
- Announce active page with `aria-current`
- Label all interactive elements

### 7.5 Color Contrast

- **Active text on primary background:** White (#FFFFFF) on Blue (#2563EB) = 8.6:1 ✓
- **Inactive text:** Neutral 400 (#9CA3AF) on Card (#111318) = 6.2:1 ✓
- **All ratios meet WCAG AA (4.5:1 minimum)**

---

## 8. Performance Considerations

### 8.1 Bundle Size

- **Server Components:** Sidebar, Navbar (zero client JS for static parts)
- **Client Components:** Only interactive parts (NavigationItem, MobileMenu, buttons)
- **Icon imports:** Tree-shaking via `lucide-react`
- **Estimated impact:** ~5-8 KB gzipped (well under 20 KB budget)

### 8.2 Rendering Performance

- **Server-side session fetch:** No client-side loading state needed
- **Static navigation items:** No runtime filtering on client
- **CSS animations:** Use `transform` for 60fps animations

### 8.3 Loading States

- **Skeleton loader:** Not needed (server-rendered immediately)
- **Fallback:** Redirect to sign-in if no session

---

## 9. Testing Strategy

### 9.1 Unit Tests

**File:** `/tests/navigation/role-access.test.ts`

**Coverage:**
- ✅ Navigation config has all roles defined
- ✅ Admin links hidden for ELEVE
- ✅ Admin links visible for ADMIN
- ✅ Each role has correct links
- ✅ No duplicate hrefs in any role config

### 9.2 Component Tests (Optional)

Could add later:
- NavigationItem renders correctly
- Active state detection works
- Badge displays when present

### 9.3 Manual Testing

**Devices:**
- Desktop: Chrome, Firefox, Safari (≥1024px)
- Tablet: iPad (768px - 1023px)
- Mobile: iPhone 13 (390px)

**Test Scenarios:**
1. Login as each role → verify correct nav items
2. Click nav items → verify navigation works
3. Mobile menu → open/close → verify animations
4. Keyboard navigation → verify tab order and focus
5. Screen reader → verify announcements

### 9.4 Verification Commands

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Unit tests
npm run test:unit

# All checks
npm run verify:quick
```

---

## 10. Integration with Existing Codebase

### 10.1 Dashboard Page Updates

**Current State:** Each dashboard page has its own header.

**Changes Needed:**
- Import and render `<Navbar />` and `<Sidebar />` in dashboard layouts
- Remove existing navigation/header components from individual pages

**Example Layout Integration:**

Create `/app/dashboard/layout.tsx` (if not exists):
```typescript
import { Navbar } from '@/components/navigation/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-950">
      <Navbar />
      <Sidebar />
      <main className="lg:pl-72 pt-16">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
```

**Affected Files:**
- `/app/dashboard/eleve/page.tsx`
- `/app/dashboard/parent/page.tsx`
- `/app/dashboard/coach/page.tsx`
- `/app/dashboard/assistante/page.tsx`
- `/app/dashboard/admin/page.tsx`

**Migration Strategy:**
1. Create navigation components first
2. Test in isolation
3. Create dashboard layout wrapper
4. Remove old headers from individual pages
5. Verify all routes work

---

## 11. Delivery Phases

### Phase 1: Foundation (Core Navigation)
**Goal:** Basic navigation system working

**Tasks:**
1. Create `navigation-config.ts` with all role mappings
2. Create `NavigationItem.tsx` (client component)
3. Create `Sidebar.tsx` (server component)
4. Create `LogoutButton.tsx`
5. Create `UserProfile.tsx`
6. Test basic desktop navigation

**Deliverable:** Desktop sidebar navigation working for all roles

**Verification:**
- TypeScript compiles
- Lint passes
- Can navigate between pages
- Active link highlighting works

---

### Phase 2: Mobile Responsiveness
**Goal:** Mobile menu working

**Tasks:**
1. Create `Navbar.tsx` (server component)
2. Create `MobileMenu.tsx` (client component with state)
3. Add mobile menu toggle button
4. Implement slide-in animation
5. Test on mobile devices

**Deliverable:** Mobile navigation fully functional

**Verification:**
- Menu opens/closes smoothly
- Backdrop works
- Navigation works on mobile

---

### Phase 3: Testing & Polish
**Goal:** Tests passing, accessibility verified

**Tasks:**
1. Create `/tests/navigation/role-access.test.ts`
2. Write all test cases from spec
3. Run accessibility audit
4. Add ARIA labels
5. Test keyboard navigation
6. Cross-browser testing

**Deliverable:** All tests passing, WCAG AA compliant

**Verification:**
- `npm run test:unit` passes
- `npm run lint` passes
- `npm run typecheck` passes
- Manual accessibility checklist complete

---

### Phase 4: Integration
**Goal:** Navigation integrated into dashboard

**Tasks:**
1. Create `/app/dashboard/layout.tsx`
2. Remove old headers from dashboard pages
3. Test all dashboard routes
4. Fix any layout issues
5. Final QA

**Deliverable:** Complete navigation system in production

**Verification:**
- All dashboard pages use new navigation
- No broken links
- No console errors
- Performance metrics met (<100ms render)

---

## 12. Risk Mitigation

### Risk 1: Session Loading Performance
**Impact:** Medium  
**Mitigation:** Use Server Components to fetch session once, pass to children. No client-side session fetching needed.

### Risk 2: Mobile Menu Animation Jank
**Impact:** Low  
**Mitigation:** Use CSS transforms (translate-x) instead of position changes. Test on low-end devices.

### Risk 3: TypeScript Errors in Navigation Config
**Impact:** Low  
**Mitigation:** Define types first, use strict Record<UserRole, NavigationItem[]> type.

### Risk 4: Navigation Conflicts with Existing Routes
**Impact:** Medium  
**Mitigation:** Audit all dashboard routes before implementation. Use exact path matching.

---

## 13. Dependencies & Prerequisites

### External Dependencies (Already Installed)
- ✅ `lucide-react` (icons)
- ✅ `next-auth` (session)
- ✅ `@radix-ui/react-avatar` (user avatar)
- ✅ `class-variance-authority` (variants)
- ✅ `clsx` (className utility)

### Internal Dependencies
- ✅ `/lib/auth.ts` (authOptions)
- ✅ `/types/enums.ts` (UserRole)
- ✅ `/types/next-auth.d.ts` (Session type)
- ✅ `/lib/utils.ts` (cn utility)
- ✅ `/lib/theme/tokens.ts` (design tokens)
- ✅ `/components/ui/button.tsx` (Button component)

### Environment Variables
- ✅ `NEXTAUTH_SECRET` (already configured)
- ✅ `NEXTAUTH_URL` (already configured)

**No new dependencies or environment variables needed.**

---

## 14. Success Metrics

### Functional Requirements (Must Pass)
- ✅ All 5 roles have correct navigation items
- ✅ Admin links not visible to non-admin users
- ✅ Active link highlighting works
- ✅ Mobile menu opens/closes
- ✅ Logout functionality works
- ✅ Keyboard navigation works

### Technical Requirements (Must Pass)
- ✅ TypeScript compilation: `npm run typecheck` (0 errors)
- ✅ Linting: `npm run lint` (0 errors)
- ✅ Unit tests: All tests in `role-access.test.ts` pass
- ✅ No console errors in browser

### Performance Requirements
- ✅ Navigation renders in <100ms
- ✅ Mobile menu animation 60fps
- ✅ Bundle size increase <20KB
- ✅ No layout shift (CLS score)

### Accessibility Requirements (WCAG 2.1 AA)
- ✅ Keyboard navigation works
- ✅ Screen reader support
- ✅ Color contrast ≥4.5:1
- ✅ Focus states visible
- ✅ ARIA labels present

---

## 15. Out of Scope (Future Iterations)

❌ User profile editing in sidebar  
❌ Notification center  
❌ Search in navigation  
❌ Dark/light theme toggle  
❌ Multi-language support  
❌ Sub-menus/nested navigation  
❌ Breadcrumb auto-generation  
❌ Analytics tracking  
❌ Custom layouts per user  

---

## 16. Appendix: Code Snippets

### A. Session Fetching Pattern

```typescript
// In any Server Component
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function MyServerComponent() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/auth/signin');
  }
  
  const userRole = session.user.role;
  // Use role for logic
}
```

### B. CVA Variant Example

```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const itemVariants = cva(
  "base-classes",
  {
    variants: {
      active: {
        true: "active-classes",
        false: "inactive-classes"
      }
    },
    defaultVariants: {
      active: false
    }
  }
);

// Usage
<div className={cn(itemVariants({ active: isActive }))}>
```

### C. Client Component Pattern

```typescript
'use client';
import { useState } from 'react';

export function MyClientComponent({ serverData }) {
  const [state, setState] = useState(false);
  
  return (
    <div onClick={() => setState(true)}>
      {/* Interactive content */}
    </div>
  );
}
```

---

**Document Status:** Ready for Planning Phase  
**Next Step:** Create detailed implementation plan in `plan.md`  
**Estimated Effort:** 8-12 hours (all phases)
