# Product Requirements Document: Dynamic Navigation System

**Version:** 1.0  
**Date:** 2026-02-02  
**Status:** Ready for Implementation

---

## 1. Executive Summary

Create a role-based, responsive navigation system for the Nexus Réussite dashboard application. The navigation will include a Sidebar and Navbar component that dynamically display links based on user roles extracted from NextAuth sessions. The system will be built using React Server Components for security and performance, following a mobile-first approach.

---

## 2. Problem Statement

### Current State
- Each dashboard page (`/app/dashboard/eleve`, `/app/dashboard/parent`, `/app/dashboard/coach`, `/app/dashboard/assistante`, `/app/dashboard/admin`) implements its own header/navigation
- No consistent navigation experience across dashboard sections
- Code duplication for navigation logic
- No centralized role-based access control for navigation items

### Target State
- Unified, reusable navigation components (Sidebar + Navbar)
- Server-side role validation using React Server Components
- Dynamic menu items based on user role
- Mobile-responsive design (mobile-first approach)
- Comprehensive test coverage for role-based access

---

## 3. User Roles & Permissions

### Supported Roles
Based on the existing `UserRole` enum:

1. **ELEVE** (Student)
   - Access to: Dashboard, Sessions, Resources
   - No access to: Admin tools, Coach management, Parent features

2. **PARENT** (Parent)
   - Access to: Dashboard, Children management, Subscriptions, Payments
   - No access to: Admin tools, Coach features

3. **COACH** (Coach)
   - Access to: Dashboard, My Sessions, Availability, Students
   - No access to: Admin tools, Parent features

4. **ASSISTANTE** (Assistant)
   - Access to: Dashboard, Students, Coaches, Subscriptions, Credit Requests, Payments
   - No access to: Full admin features

5. **ADMIN** (Administrator)
   - Access to: All features including Analytics, User Management, System Settings, Activities

---

## 4. Feature Requirements

### 4.1 Navigation Components

#### Sidebar Component
**Location:** `/components/navigation/Sidebar.tsx`

**Features:**
- Display user profile information (name, role, avatar)
- Render navigation links based on user role
- Active link highlighting
- Collapsible/expandable on mobile (hamburger menu)
- Logout button
- Server Component for security

**Navigation Items by Role:**

**ELEVE:**
- Dashboard (`/dashboard/eleve`)
- Mes Sessions (`/dashboard/eleve/mes-sessions`)
- Réserver Session (`/dashboard/eleve/sessions`)
- Ressources (`/dashboard/eleve/ressources`)

**PARENT:**
- Dashboard (`/dashboard/parent`)
- Mes Enfants (`/dashboard/parent/children`)
- Abonnements (`/dashboard/parent/abonnements`)
- Paiements (`/dashboard/parent/paiement`)

**COACH:**
- Dashboard (`/dashboard/coach`)
- Mes Sessions (`/dashboard/coach/sessions`)
- Mes Étudiants (`/dashboard/coach/students`)
- Disponibilités (`/dashboard/coach/availability`)

**ASSISTANTE:**
- Dashboard (`/dashboard/assistante`)
- Étudiants (`/dashboard/assistante/students`)
- Coaches (`/dashboard/assistante/coaches`)
- Abonnements (`/dashboard/assistante/subscriptions`)
- Demandes Crédits (`/dashboard/assistante/credit-requests`)
- Paiements (`/dashboard/assistante/paiements`)

**ADMIN:**
- Dashboard (`/dashboard/admin`)
- Utilisateurs (`/dashboard/admin/users`)
- Analytics (`/dashboard/admin/analytics`)
- Abonnements (`/dashboard/admin/subscriptions`)
- Activités (`/dashboard/admin/activities`)
- Tests Système (`/dashboard/admin/tests`)

#### Navbar Component
**Location:** `/components/navigation/Navbar.tsx`

**Features:**
- Responsive top bar for mobile devices
- Logo/brand name
- Mobile menu toggle button
- User profile dropdown (desktop)
- Breadcrumb navigation (optional)
- Server Component for security

**Responsive Behavior:**
- **Mobile (< 768px):** 
  - Full-width top navbar
  - Hamburger menu button
  - Sidebar slides in from left
- **Tablet (768px - 1024px):**
  - Navbar + collapsible sidebar
- **Desktop (>= 1024px):**
  - Fixed sidebar + top navbar

### 4.2 Role-Based Access Control

**Implementation Approach:**
- Use React Server Components to fetch session server-side
- Extract user role from NextAuth session
- Filter navigation items based on role
- Prevent unauthorized access to navigation items

**Security Requirements:**
- Session validation on server side only
- No role information exposed to client unnecessarily
- Type-safe role checking using TypeScript enums
- Graceful handling of missing/invalid sessions

### 4.3 Responsive Design

**Mobile-First Breakpoints:**
- **Mobile:** 320px - 767px
- **Tablet:** 768px - 1023px
- **Desktop:** 1024px+

**Design Tokens (from existing design system):**
- Colors: `brand.primary`, `brand.accent`, `neutral`, `surface`
- Typography: `font-sans` (Inter), `font-display` (Space Grotesk)
- Spacing: Tailwind spacing scale
- Shadows: `shadow-soft`, `shadow-medium`
- Border radius: `rounded-card` (18px)

**Accessibility:**
- ARIA labels for navigation elements
- Keyboard navigation support
- Focus states for interactive elements
- Semantic HTML (nav, ul, li, a)
- Screen reader support

### 4.4 Testing Requirements

**Test File:** `/tests/navigation/role-access.test.ts`

**Test Cases:**
1. **Role-based visibility:**
   - Admin links are hidden for ELEVE role
   - Admin links are visible for ADMIN role
   - Parent links are hidden for ELEVE role
   - Coach links are hidden for PARENT role

2. **Navigation rendering:**
   - Sidebar renders with correct links for each role
   - Active link highlighting works correctly
   - Mobile menu toggle functions properly

3. **Session handling:**
   - Handles missing session gracefully
   - Handles invalid role gracefully
   - Redirects to login if no session

4. **Accessibility:**
   - All links have proper ARIA labels
   - Keyboard navigation works
   - Focus management is correct

**Testing Tools:**
- Jest for unit testing
- React Testing Library for component testing
- Mock NextAuth session data

---

## 5. Technical Specifications

### 5.1 Tech Stack
- **Framework:** Next.js 15.5.11 (App Router)
- **React:** 18.3.1 with Server Components
- **Authentication:** NextAuth 4.24.11
- **Styling:** Tailwind CSS v4 + Design tokens
- **UI Components:** Radix UI (shadcn/ui pattern)
- **Icons:** Lucide React
- **Testing:** Jest + React Testing Library
- **TypeScript:** Strict mode enabled

### 5.2 File Structure
```
/components/navigation/
├── Sidebar.tsx              # Main sidebar (Server Component)
├── Navbar.tsx               # Top navbar (Server Component)
├── NavigationItem.tsx       # Individual nav link (Client Component)
├── MobileMenu.tsx           # Mobile menu overlay (Client Component)
├── UserProfile.tsx          # User info display (Client Component)
└── navigation-config.ts     # Navigation items configuration

/tests/navigation/
└── role-access.test.ts      # Role-based access tests
```

### 5.3 Data Models

**Navigation Item Type:**
```typescript
interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];         // Roles allowed to see this item
  badge?: number;            // Optional notification badge
  children?: NavigationItem[]; // Optional sub-items
}
```

**Session Type (from NextAuth):**
```typescript
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

### 5.4 Component APIs

**Sidebar Component:**
```typescript
interface SidebarProps {
  // Server Component - no props needed, reads session internally
}

export default async function Sidebar(): Promise<JSX.Element>
```

**Navbar Component:**
```typescript
interface NavbarProps {
  // Server Component - no props needed
}

export default async function Navbar(): Promise<JSX.Element>
```

**NavigationItem Component (Client):**
```typescript
interface NavigationItemProps {
  item: NavigationItem;
  isActive?: boolean;
  onClick?: () => void;
}

export function NavigationItem(props: NavigationItemProps): JSX.Element
```

---

## 6. User Experience

### 6.1 User Flows

**Flow 1: Desktop User (ELEVE)**
1. User logs in with ELEVE role
2. Redirected to `/dashboard/eleve`
3. Sees fixed sidebar on left with:
   - Profile section (name, role)
   - Dashboard link
   - Mes Sessions link
   - Réserver Session link
   - Ressources link
   - Logout button
4. Top navbar shows breadcrumb and user dropdown
5. Clicks "Mes Sessions" → navigates to sessions page
6. Active link is highlighted

**Flow 2: Mobile User (PARENT)**
1. User logs in on mobile device
2. Sees compact top navbar with hamburger menu
3. Taps hamburger → sidebar slides in from left
4. Sees navigation items for PARENT role
5. Taps navigation item → sidebar closes, navigates
6. Can swipe left to close sidebar

**Flow 3: Admin User**
1. Admin logs in
2. Sees expanded navigation with all admin options
3. Can access all system management features
4. Sees visual distinction for admin-only items

### 6.2 Visual Design

**Sidebar (Desktop):**
- Width: 280px (fixed)
- Background: `surface.card` (#111318)
- Border: Right border with `neutral.200` (1px)
- Padding: 24px
- Typography: `font-sans` (Inter)

**Navigation Items:**
- Height: 44px
- Padding: 12px 16px
- Border radius: 10px (`rounded-micro`)
- Active state: `bg-brand-primary`, `text-white`
- Hover state: `bg-surface.hover`
- Icon size: 20px

**Mobile Sidebar:**
- Full width overlay with backdrop
- Slide-in animation from left
- Backdrop: `bg-black/50` with blur
- Close button: Top right corner

**Color Palette:**
- Primary: `#2563EB` (brand.primary)
- Accent: `#2EE9F6` (brand.accent)
- Text: `#F9FAFB` (neutral.50) on dark backgrounds
- Inactive text: `#6B7280` (neutral.500)

---

## 7. Success Criteria

### 7.1 Functional Requirements
✅ Navigation displays correct links for each user role  
✅ Active link highlighting works correctly  
✅ Mobile menu opens/closes smoothly  
✅ Logout functionality works  
✅ All navigation links are accessible via keyboard  
✅ Server-side session validation prevents unauthorized access  

### 7.2 Technical Requirements
✅ All tests pass (including role-access.test.ts)  
✅ TypeScript compilation succeeds with no errors  
✅ Lint passes (npm run lint)  
✅ Component tree follows React Server Component patterns  
✅ No prop drilling (use Server Components to fetch data)  

### 7.3 Performance Requirements
✅ Navigation renders in < 100ms  
✅ Mobile menu animation is smooth (60fps)  
✅ No layout shift on page load  
✅ Bundle size increase < 20KB  

### 7.4 Accessibility Requirements
✅ WCAG 2.1 AA compliance  
✅ Keyboard navigation works correctly  
✅ Screen reader announces navigation items  
✅ Focus states are clearly visible  
✅ Color contrast ratios meet standards  

---

## 8. Out of Scope

The following are explicitly **not** included in this iteration:

❌ User profile editing within navigation  
❌ Notification center in navbar  
❌ Search functionality in navigation  
❌ Theme switching (dark/light mode)  
❌ Multi-language support in navigation  
❌ Custom navigation layout per user  
❌ Navigation analytics/tracking  
❌ Breadcrumb auto-generation  

These may be considered for future iterations.

---

## 9. Dependencies & Assumptions

### Dependencies
- Existing NextAuth setup is working correctly
- User roles are properly set in database
- Design system tokens are available in Tailwind config
- Radix UI and Lucide icons are installed

### Assumptions
- All users have a valid role assigned
- Session is always available in dashboard routes (protected routes)
- Current dashboard page structure will be maintained
- Mobile devices support modern CSS (flexbox, grid)

---

## 10. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Session loading delay affects UX | Medium | Medium | Add loading skeleton for navigation |
| Role changes don't reflect immediately | Low | Low | Document session refresh requirements |
| Mobile menu performance on low-end devices | Medium | Low | Use CSS transforms for animations, test on devices |
| Accessibility issues missed | High | Medium | Include accessibility tests, manual testing with screen readers |
| Navigation items conflict with existing routes | Medium | Low | Audit all routes before implementation |

---

## 11. Open Questions & Decisions Needed

### Resolved Decisions
✅ **Use Server Components?** → Yes, for security and performance  
✅ **Sidebar always visible on desktop?** → Yes, fixed sidebar  
✅ **Show user avatar?** → Optional, can use initials fallback  
✅ **Active link detection?** → Use current pathname matching  

### Open Questions (To be resolved during implementation)
- Should we add transition animations between routes?
- Do we need a "Quick Actions" section in sidebar?
- Should admin users see a visual badge/indicator?
- Do we want collapsible sub-menus for nested navigation?

**Recommended Decisions:**
- **No** route transition animations initially (can add later)
- **No** Quick Actions section (keep navigation simple)
- **Yes** to admin badge (small "Admin" label in profile section)
- **No** sub-menus initially (flat navigation hierarchy)

---

## 12. Implementation Notes

### Development Approach
1. Start with Sidebar component (Server Component)
2. Add NavigationItem (Client Component for interactivity)
3. Build Navbar component
4. Add mobile responsiveness
5. Implement tests
6. Integrate into existing dashboard pages

### Code Conventions
- Follow existing component patterns (see `/components/ui/`)
- Use CVA (class-variance-authority) for variant management
- Use `cn()` utility for className merging
- Follow existing file naming: PascalCase for components
- Add JSDoc comments for public APIs

### Testing Strategy
- Unit tests for navigation config logic
- Component tests for each navigation component
- Integration test for role-based visibility
- Manual testing on multiple devices/browsers

---

## 13. Acceptance Criteria

**Definition of Done:**
- [ ] Sidebar component created with server-side session handling
- [ ] Navbar component created
- [ ] Navigation displays correct links for all 5 roles
- [ ] Mobile responsive design works on screens < 768px
- [ ] Test file `role-access.test.ts` passes with Admin link visibility test
- [ ] TypeScript compiles without errors
- [ ] Lint passes (`npm run lint`)
- [ ] All navigation links are keyboard accessible
- [ ] Component documentation (JSDoc) is complete
- [ ] Code review approved
- [ ] Manual testing on Chrome, Firefox, Safari (desktop + mobile)

---

## Appendix A: Navigation Items Reference

### Complete Navigation Mapping

```typescript
const navigationItems: Record<UserRole, NavigationItem[]> = {
  ELEVE: [
    { label: 'Dashboard', href: '/dashboard/eleve', icon: Home },
    { label: 'Mes Sessions', href: '/dashboard/eleve/mes-sessions', icon: Calendar },
    { label: 'Réserver Session', href: '/dashboard/eleve/sessions', icon: Plus },
    { label: 'Ressources', href: '/dashboard/eleve/ressources', icon: BookOpen },
  ],
  PARENT: [
    { label: 'Dashboard', href: '/dashboard/parent', icon: Home },
    { label: 'Mes Enfants', href: '/dashboard/parent/children', icon: Users },
    { label: 'Abonnements', href: '/dashboard/parent/abonnements', icon: CreditCard },
    { label: 'Paiements', href: '/dashboard/parent/paiement', icon: DollarSign },
  ],
  COACH: [
    { label: 'Dashboard', href: '/dashboard/coach', icon: Home },
    { label: 'Mes Sessions', href: '/dashboard/coach/sessions', icon: Calendar },
    { label: 'Mes Étudiants', href: '/dashboard/coach/students', icon: Users },
    { label: 'Disponibilités', href: '/dashboard/coach/availability', icon: Clock },
  ],
  ASSISTANTE: [
    { label: 'Dashboard', href: '/dashboard/assistante', icon: Home },
    { label: 'Étudiants', href: '/dashboard/assistante/students', icon: Users },
    { label: 'Coaches', href: '/dashboard/assistante/coaches', icon: UserCheck },
    { label: 'Abonnements', href: '/dashboard/assistante/subscriptions', icon: CreditCard },
    { label: 'Demandes Crédits', href: '/dashboard/assistante/credit-requests', icon: AlertCircle },
    { label: 'Paiements', href: '/dashboard/assistante/paiements', icon: DollarSign },
  ],
  ADMIN: [
    { label: 'Dashboard', href: '/dashboard/admin', icon: Home },
    { label: 'Utilisateurs', href: '/dashboard/admin/users', icon: Users },
    { label: 'Analytics', href: '/dashboard/admin/analytics', icon: BarChart },
    { label: 'Abonnements', href: '/dashboard/admin/subscriptions', icon: CreditCard },
    { label: 'Activités', href: '/dashboard/admin/activities', icon: Activity },
    { label: 'Tests Système', href: '/dashboard/admin/tests', icon: TestTube },
  ],
};
```

---

**Document Prepared By:** AI Assistant  
**Review Status:** Ready for Technical Specification  
**Next Step:** Create Technical Specification Document
