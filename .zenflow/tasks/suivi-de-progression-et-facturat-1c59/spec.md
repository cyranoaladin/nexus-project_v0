# Technical Specification
## Parent Dashboard: Progress Tracking and Financial History

**Version**: 1.0  
**Date**: 2026-02-02  
**Related PRD**: [requirements.md](./requirements.md)

---

## 1. Technical Context

### 1.1 Technology Stack

- **Framework**: Next.js 15 (App Router, React 18.3.1)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4.1, design tokens from `lib/theme/tokens.js`
- **State Management**: React hooks (useState, useCallback, useEffect)
- **Data Fetching**: Native fetch API with Next.js server-side data
- **Database**: PostgreSQL via Prisma ORM 6.13
- **Charts**: Recharts 3.1.0 (already installed)
- **Icons**: lucide-react 0.536.0
- **UI Components**: Radix UI primitives + custom components in `components/ui/`
- **Authentication**: NextAuth 4.24.11 with role-based access control

### 1.2 Existing Dependencies (No New Packages Required)

All required dependencies are already installed:
- `recharts` (v3.1.0) - for progress charts
- `lucide-react` (v0.536.0) - for icons  
- `date-fns` (v4.1.0) - for date formatting
- `@radix-ui/react-*` - for UI primitives
- `prisma` & `@prisma/client` - for database access

### 1.3 Development Environment

- **Linting**: ESLint (next lint)
- **Type Checking**: TypeScript compiler (tsc --noEmit)
- **Testing**:
  - Unit: Jest (config: `jest.config.unit.js`)
  - Integration: Jest (config: `jest.config.integration.js`)
  - E2E: Playwright (`playwright.config.ts`)
- **Database Migrations**: Prisma Migrate
- **Build**: Next.js build system

---

## 2. Implementation Approach

### 2.1 Architecture Overview

This enhancement follows the **existing patterns** in the codebase:

1. **Server-Side API Routes** (`app/api/parent/dashboard/route.ts`) - Data fetching with Prisma
2. **Client-Side Dashboard Page** (`app/dashboard/parent/page.tsx`) - React components
3. **Reusable UI Components** (`components/ui/*`) - Radix UI + Tailwind
4. **Type-Safe Data Models** (TypeScript interfaces) - Strong typing throughout
5. **Role-Based Access Control** - Session validation + parent-child relationship checks

### 2.2 Data Flow

```
Client (Parent Dashboard)
    ↓ (HTTP GET /api/parent/dashboard)
API Route Handler
    ↓ (Validate session + role)
Prisma Query
    ↓ (Join tables: ParentProfile → Student → StudentBadge, Payment, CreditTransaction, SessionBooking)
Data Aggregation & Calculation
    ↓ (Progress history, badge grouping, financial transactions)
JSON Response
    ↓
Client State Update
    ↓
UI Rendering (Cards, Charts, Tables)
```

### 2.3 Security Model

**Authentication Flow**:
1. NextAuth session validation (server-side)
2. Role check: `session.user.role === 'PARENT'`
3. Parent profile lookup via `userId`
4. All child data filtered by `parentId` (via `ParentProfile.children` relation)
5. No direct child ID exposure in URLs

**Data Access Rules**:
- ✅ Parents can **only** see their own children's data
- ✅ Backend validates parent-child relationship via Prisma relations
- ✅ API returns 401 if unauthenticated, 403 if wrong role
- ✅ No client-side filtering (all security server-side)

---

## 3. Source Code Structure Changes

### 3.1 New Files to Create

```
app/api/parent/dashboard/route.ts          [MODIFY - extend existing]
app/dashboard/parent/page.tsx              [MODIFY - enhance UI]

components/ui/parent/
├── badge-display.tsx                      [NEW - badge grid component]
├── progress-chart.tsx                     [NEW - Recharts charts]
└── financial-history.tsx                  [NEW - transaction table]

__tests__/api/parent/
└── dashboard.test.ts                      [NEW - API integration tests]

__tests__/components/parent/
├── badge-display.test.tsx                 [NEW - component tests]
├── progress-chart.test.tsx                [NEW - chart tests]
└── financial-history.test.tsx             [NEW - table tests]

e2e/parent-dashboard.spec.ts               [NEW - E2E test with parent.json fixture]
```

### 3.2 Existing Files to Modify

**Backend API**:
- `app/api/parent/dashboard/route.ts` - Extend to include badges, progress history, payments

**Frontend Page**:
- `app/dashboard/parent/page.tsx` - Add new card sections for badges, charts, financial history

**Types**:
- Extend `ParentDashboardData` interface inline or in new `types/parent-dashboard.ts`

**No Database Schema Changes Required** - All necessary tables exist:
- `StudentBadge`, `Badge`, `Payment`, `CreditTransaction`, `SessionBooking`

---

## 4. Data Model & API Changes

### 4.1 Database Schema (No Changes)

Existing Prisma models used:
- `User` (parent authentication)
- `ParentProfile` (parent-children relationship)
- `Student` (child entity)
- `StudentBadge` (badge awards - many-to-many with `Badge`)
- `Badge` (badge definitions: name, category, icon, description)
- `Payment` (parent payments: subscriptions, credit packs)
- `CreditTransaction` (child credit usage: allocations, refunds, usage)
- `SessionBooking` (sessions for progress tracking)

### 4.2 API Endpoint Enhancement

**Endpoint**: `GET /api/parent/dashboard`

**Current Response** (simplified):
```typescript
{
  parent: { id, firstName, lastName, email },
  children: [{
    id, firstName, lastName, grade, school,
    credits, subscription, progress,
    subjectProgress: { "MATHEMATIQUES": 75 },
    nextSession: { ... },
    sessions: [...]
  }]
}
```

**Enhanced Response** (add these fields):
```typescript
{
  parent: { ... }, // unchanged
  children: [{
    // ... existing fields ...
    
    // NEW: Badge data
    badges: [{
      id: string,
      badge: {
        name: string,
        description: string,
        category: "ASSIDUITE" | "PROGRESSION" | "CURIOSITE",
        icon: string
      },
      earnedAt: Date,
      isRecent: boolean  // within last 7 days
    }],
    badgeCount: number,
    
    // NEW: Progress history (last 3 months by default)
    progressHistory: [{
      date: Date,
      progress: number,
      sessionsCompleted: number
    }],
    
    // NEW: Subject-specific progress history
    subjectProgressHistory: {
      "MATHEMATIQUES": [{ date: Date, progress: number }],
      ...
    }
  }],
  
  // NEW: Financial transactions (parent-level, all children)
  financialHistory: [{
    id: string,
    date: Date,
    type: "PAYMENT" | "CREDIT_ALLOCATION" | "CREDIT_USAGE" | "REFUND",
    description: string,
    amount: number,
    currency: string,
    status: string,
    method?: string,
    childName?: string  // for credit transactions
  }]
}
```

### 4.3 Prisma Query Strategy

**Existing Pattern** (from `app/api/parent/dashboard/route.ts`):
```typescript
const parent = await prisma.parentProfile.findUnique({
  where: { id: parentProfile.id },
  include: {
    user: true,
    children: {
      include: {
        user: true,
        creditTransactions: { orderBy: { createdAt: 'desc' } },
        subscriptions: { where: { status: 'ACTIVE' } }
      }
    }
  }
});
```

**Enhanced Pattern** (add to existing query):
```typescript
const parent = await prisma.parentProfile.findUnique({
  where: { id: parentProfile.id },
  include: {
    user: true,
    children: {
      include: {
        user: true,
        creditTransactions: { orderBy: { createdAt: 'desc' } },
        subscriptions: { where: { status: 'ACTIVE' } },
        
        // NEW: Include badges
        badges: {
          include: { badge: true },
          orderBy: { earnedAt: 'desc' },
          take: 50  // limit for performance
        }
      }
    }
  }
});

// NEW: Fetch parent's payments separately
const payments = await prisma.payment.findMany({
  where: { userId: userId },
  orderBy: { createdAt: 'desc' },
  take: 100  // pagination later
});

// Progress history calculation (per child, in loop):
const completedSessions = await prisma.sessionBooking.findMany({
  where: {
    studentId: student.userId,
    status: 'COMPLETED'
  },
  select: { completedAt: true, subject: true },
  orderBy: { completedAt: 'desc' }
});
// Aggregate by week/month using date-fns
```

**Performance Optimization**:
- Use single `findUnique` with `include` for parent + children (avoid N+1)
- Batch fetch payments for parent user
- Aggregate session data in application code (acceptable for MVP, optimize later if needed)
- Add `take` limits to prevent excessive data fetching
- Consider caching dashboard data (future enhancement)

---

## 5. Component Architecture

### 5.1 Component Hierarchy

```
app/dashboard/parent/page.tsx
├── (existing) Header with child selector
├── (existing) Child summary card
├── NEW: BadgeDisplay component
│   ├── Badge category tabs (ASSIDUITE, PROGRESSION, CURIOSITE)
│   ├── Badge grid (icon, name, date)
│   └── Empty state
├── NEW: ProgressChart component
│   ├── Time range selector (1M, 3M, 6M, 1Y)
│   ├── Line chart (overall progress)
│   ├── Bar chart (subject comparison)
│   └── Chart tooltips (Recharts)
├── NEW: FinancialHistory component
│   ├── Filter controls (type, date range, child)
│   ├── Transaction table (date, type, amount, status)
│   ├── Pagination controls
│   └── CSV export button
├── (existing) Session agenda card
├── (existing) Subscription card
└── (existing) Footer
```

### 5.2 Component Specifications

#### 5.2.1 BadgeDisplay Component

**File**: `components/ui/parent/badge-display.tsx`

**Props**:
```typescript
interface BadgeDisplayProps {
  badges: Array<{
    id: string;
    badge: {
      name: string;
      description: string;
      category: string;
      icon: string;
    };
    earnedAt: Date;
    isRecent: boolean;
  }>;
  childName: string;
}
```

**Features**:
- Category tabs using Radix Tabs
- Badge grid (responsive: 2 cols mobile, 3 cols tablet, 4 cols desktop)
- Badge card: icon (emoji), name, earned date, "new" indicator
- Empty state: "Aucun badge gagné pour le moment"
- Smooth animations (framer-motion fade-in)

**Styling Pattern** (follow existing):
- Card container: `bg-white rounded-lg shadow-sm border border-neutral-200`
- Badge item: `p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors`
- Icons: lucide-react + emoji from database
- Colors: `brand-primary`, `success`, `neutral` from Tailwind config

#### 5.2.2 ProgressChart Component

**File**: `components/ui/parent/progress-chart.tsx`

**Props**:
```typescript
interface ProgressChartProps {
  progressHistory: Array<{
    date: Date;
    progress: number;
    sessionsCompleted: number;
  }>;
  subjectProgressHistory: Record<string, Array<{
    date: Date;
    progress: number;
  }>>;
  childName: string;
}
```

**Features**:
- Time range selector (Radix Select): "1 mois", "3 mois", "6 mois", "1 an"
- Line chart (Recharts `<LineChart>`) for overall progress trend
- Bar chart (Recharts `<BarChart>`) for subject comparison
- Interactive tooltips with date + percentage
- Responsive chart sizing (aspect ratio 16:9 mobile, 2:1 desktop)
- Color scheme: `brand-primary` for primary line, subject colors from config

**Recharts Setup** (example):
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={progressHistory}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" tickFormatter={(date) => format(date, 'dd/MM')} />
    <YAxis domain={[0, 100]} />
    <Tooltip />
    <Legend />
    <Line type="monotone" dataKey="progress" stroke="#2563EB" strokeWidth={2} />
  </LineChart>
</ResponsiveContainer>
```

#### 5.2.3 FinancialHistory Component

**File**: `components/ui/parent/financial-history.tsx`

**Props**:
```typescript
interface FinancialHistoryProps {
  transactions: Array<{
    id: string;
    date: Date;
    type: string;
    description: string;
    amount: number;
    currency: string;
    status: string;
    method?: string;
    childName?: string;
  }>;
  children: Array<{ id: string; firstName: string }>;
}
```

**Features**:
- Filter controls (Radix Select): transaction type, child, date range
- Table with sortable columns (click header to sort)
- Pagination (20 items per page, "Load More" button)
- Status badges (color-coded: COMPLETED=green, PENDING=yellow, FAILED=red)
- CSV export (client-side generation, no backend endpoint)
- Empty state: "Aucune transaction trouvée"

**Table Structure**:
| Date | Type | Description | Amount | Status | Child |
|------|------|-------------|--------|--------|-------|
| 01/02/2026 | Abonnement | Formule Hybride | 150 TND | Complété | - |
| 28/01/2026 | Crédit | Pack 10 crédits | 100 TND | Complété | Alice |

**CSV Export** (use browser download):
```typescript
const exportToCSV = () => {
  const headers = ['Date', 'Type', 'Description', 'Montant', 'Statut', 'Enfant'];
  const csvContent = [
    headers.join(','),
    ...transactions.map(t => [
      format(t.date, 'dd/MM/yyyy'),
      t.type,
      t.description,
      `${t.amount} ${t.currency}`,
      t.status,
      t.childName || '-'
    ].join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
};
```

---

## 6. Delivery Phases

### Phase 1: Backend API Enhancement
**Duration**: 1-2 days  
**Goal**: Extend `/api/parent/dashboard` to include new data

**Tasks**:
1. Modify `app/api/parent/dashboard/route.ts`:
   - Add `badges` to children query (include StudentBadge + Badge)
   - Calculate `isRecent` flag (earnedAt within last 7 days)
   - Fetch parent payments (Payment table)
   - Build financial transaction list (merge Payment + CreditTransaction)
   - Calculate progress history (aggregate SessionBooking by week/month)
   - Calculate subject-specific progress history
2. Update TypeScript interfaces for new response structure
3. Test API with Postman/curl (manual verification)
4. Write integration tests (`__tests__/api/parent/dashboard.test.ts`)

**Verification**:
- API returns 200 with valid parent session
- API returns 401 without session
- API returns 403 for non-parent roles
- Badge data includes category, icon, earnedAt
- Financial history includes both payments and credit transactions
- Progress history covers last 3 months by default
- Run: `npm run test:integration`

**Acceptance Criteria**:
- ✅ All existing tests pass
- ✅ New tests cover badge retrieval, financial history, progress calculation
- ✅ No N+1 queries (check Prisma logs)
- ✅ Response time < 2s for parent with 3 children, 50 badges, 100 transactions

---

### Phase 2: Frontend Components (Read-Only)
**Duration**: 2-3 days  
**Goal**: Create reusable UI components for badges, charts, financial history

**Tasks**:
1. **BadgeDisplay Component**:
   - Create `components/ui/parent/badge-display.tsx`
   - Implement category tabs (Radix Tabs)
   - Render badge grid with icons, names, dates
   - Add "new" indicator for recent badges
   - Handle empty state
   - Write unit tests (`__tests__/components/parent/badge-display.test.tsx`)

2. **ProgressChart Component**:
   - Create `components/ui/parent/progress-chart.tsx`
   - Implement time range selector
   - Set up Recharts LineChart for progress trend
   - Set up Recharts BarChart for subject comparison
   - Add responsive sizing (ResponsiveContainer)
   - Implement tooltips with date-fns formatting
   - Write unit tests (mock Recharts)

3. **FinancialHistory Component**:
   - Create `components/ui/parent/financial-history.tsx`
   - Implement filter controls (type, child, date range)
   - Render transaction table
   - Add status badges (color-coded)
   - Implement client-side pagination
   - Add CSV export functionality
   - Write unit tests

**Verification**:
- Components render without errors
- Props are correctly typed (TypeScript)
- Empty states display properly
- Charts render with sample data
- Filters work correctly (client-side)
- CSV export generates valid file
- Run: `npm run test:unit`
- Run: `npm run typecheck`

**Acceptance Criteria**:
- ✅ All components have proper TypeScript types
- ✅ Unit tests cover rendering, interactions, edge cases
- ✅ No console errors/warnings
- ✅ Responsive design tested (mobile, tablet, desktop)

---

### Phase 3: Dashboard Integration
**Duration**: 1-2 days  
**Goal**: Integrate new components into parent dashboard page

**Tasks**:
1. Modify `app/dashboard/parent/page.tsx`:
   - Extend `ParentDashboardData` interface with new fields
   - Update `refreshDashboardData` to handle new API response
   - Add BadgeDisplay card section
   - Add ProgressChart card section
   - Add FinancialHistory card section
   - Ensure components update when child selector changes
   - Add loading skeletons for new sections
   - Add error boundaries for new components

2. Layout Adjustments:
   - Arrange cards in responsive grid (1 col mobile, 2 cols desktop)
   - Ensure proper spacing and visual hierarchy
   - Match existing card styling (shadow, border, radius)
   - Add section headers with icons (lucide-react)

**Verification**:
- Dashboard loads without errors
- New sections display correctly
- Child selector updates all sections (including new ones)
- Loading states show during data fetch
- Error states display user-friendly messages
- Run: `npm run dev` and manual testing
- Run: `npm run typecheck`
- Run: `npm run lint`

**Acceptance Criteria**:
- ✅ No TypeScript errors
- ✅ No ESLint warnings
- ✅ All existing features still work
- ✅ New sections match design system
- ✅ Responsive on mobile, tablet, desktop

---

### Phase 4: Testing & Refinement
**Duration**: 2-3 days  
**Goal**: Comprehensive testing with realistic data, E2E tests, performance optimization

**Tasks**:
1. **Create Test Fixtures**:
   - Create `parent.json` test file with sample data:
     - 1 parent with 2 children
     - 15-20 badges across categories
     - 30 financial transactions (payments + credit usage)
     - 3 months of session history
   - Add fixture to E2E seed script (`scripts/seed-e2e-db.ts`)

2. **E2E Tests**:
   - Create `e2e/parent-dashboard.spec.ts`
   - Test: Parent login → dashboard loads → data visible
   - Test: Switch child → sections update
   - Test: Filter financial history
   - Test: Export CSV (verify download)
   - Test: Progress chart time range selector
   - Test: Badge category tabs
   - Run: `npm run test:e2e:setup && npm run test:e2e`

3. **Performance Testing**:
   - Test with large dataset (100 badges, 500 transactions)
   - Verify API response time < 2s
   - Check for memory leaks (React DevTools Profiler)
   - Optimize Prisma queries if needed (add indexes)
   - Consider pagination for financial history if > 100 items

4. **Accessibility Audit**:
   - Add ARIA labels to charts, tables, filters
   - Test keyboard navigation (Tab, Enter, Space)
   - Verify color contrast (WCAG 2.1 AA)
   - Test with screen reader (VoiceOver/NVDA)

5. **Security Testing**:
   - Verify parent can only see own children's data
   - Test with different parent accounts
   - Attempt to access other parent's data (should fail)
   - Check for data leakage in API responses

**Verification**:
- All E2E tests pass
- No flaky tests (run 5 times)
- Dashboard loads in < 2s (measured in E2E)
- No console errors in production build
- Run: `npm run verify` (lint + typecheck + test + build)

**Acceptance Criteria**:
- ✅ E2E tests cover critical user flows
- ✅ No accessibility violations (aXe DevTools)
- ✅ Security tests pass (parent data isolation)
- ✅ Performance meets < 2s load time
- ✅ All tests green in CI

---

### Phase 5: Documentation & Deployment
**Duration**: 1 day  
**Goal**: Final checks, documentation, deployment readiness

**Tasks**:
1. **Code Review Preparation**:
   - Self-review all changes
   - Ensure consistent code style
   - Add JSDoc comments to complex functions
   - Remove debug logs and console.log statements

2. **Documentation**:
   - Update API documentation (if exists)
   - Add inline comments for complex logic (progress calculation, chart data formatting)
   - Document component props in JSDoc format
   - Update CHANGELOG (if exists)

3. **Deployment Checklist**:
   - ✅ All tests pass (`npm run test:all`)
   - ✅ Build succeeds (`npm run build`)
   - ✅ Type checking passes (`npm run typecheck`)
   - ✅ Linting passes (`npm run lint`)
   - ✅ No security vulnerabilities (`npm audit`)
   - ✅ Environment variables documented (if any new)
   - ✅ Database migrations (none required for this feature)

4. **Smoke Testing** (staging/production):
   - Test with real parent account
   - Verify data accuracy
   - Test on different devices/browsers
   - Monitor performance metrics

**Verification**:
- `npm run verify` completes successfully
- Production build generates no warnings
- Staging deployment works as expected

**Acceptance Criteria**:
- ✅ Code review feedback addressed
- ✅ Documentation complete
- ✅ Deployment checklist completed
- ✅ Stakeholder approval obtained

---

## 7. Verification Strategy

### 7.1 Automated Testing

**Unit Tests** (`__tests__/components/parent/*.test.tsx`):
- Component rendering with various props
- Filter logic (financial history)
- Date formatting (progress chart)
- CSV export generation
- Empty state handling
- Error boundary behavior

**Integration Tests** (`__tests__/api/parent/dashboard.test.ts`):
- API authentication (401 without session)
- API authorization (403 for non-parent)
- Badge retrieval (correct count, categories)
- Financial history (payments + credit transactions)
- Progress calculation (accurate percentages)
- Parent-child data isolation (can't access other parent's data)

**E2E Tests** (`e2e/parent-dashboard.spec.ts`):
- Complete user flow: login → select child → view badges/charts/transactions
- Filter interactions
- CSV export download
- Child switching updates all sections
- Loading states
- Error states (network failure simulation)

**Command to Run All Tests**:
```bash
npm run verify:quick  # lint + typecheck + unit + integration (fast)
npm run test:all      # includes E2E (slower)
```

### 7.2 Manual Testing Checklist

**Functional Testing**:
- [ ] Badge display shows correct categories
- [ ] Recent badges have "new" indicator
- [ ] Progress charts show accurate data
- [ ] Time range selector filters chart data
- [ ] Financial history shows all transaction types
- [ ] Filters work correctly (type, child, date range)
- [ ] Pagination loads more transactions
- [ ] CSV export downloads valid file
- [ ] Child selector updates all sections

**UI/UX Testing**:
- [ ] Layout responsive on mobile (320px width)
- [ ] Layout responsive on tablet (768px width)
- [ ] Layout responsive on desktop (1440px width)
- [ ] Charts render properly on all screen sizes
- [ ] Loading skeletons display during data fetch
- [ ] Empty states show user-friendly messages
- [ ] Error states allow retry action

**Performance Testing**:
- [ ] Dashboard loads in < 2s (Network tab)
- [ ] No console errors in production build
- [ ] No memory leaks (React DevTools Profiler)
- [ ] Charts render smoothly without lag
- [ ] API response size < 1MB (check Network tab)

**Security Testing**:
- [ ] Parent A cannot see Parent B's data
- [ ] API validates session server-side
- [ ] No child IDs exposed in URLs
- [ ] No sensitive data in client-side console logs

**Accessibility Testing**:
- [ ] Keyboard navigation works (Tab, Enter, Space)
- [ ] Screen reader announces charts correctly
- [ ] Color contrast meets WCAG 2.1 AA
- [ ] Focus indicators visible
- [ ] ARIA labels present on interactive elements

### 7.3 Test Data Requirements

**Parent Test Fixture** (`parent.json`):
```json
{
  "parent": {
    "email": "parent.test@nexus.tn",
    "password": "SecurePass123!",
    "firstName": "Ahmed",
    "lastName": "Ben Ali",
    "role": "PARENT"
  },
  "children": [
    {
      "firstName": "Alice",
      "lastName": "Ben Ali",
      "grade": "Terminale",
      "school": "Lycée Pilote",
      "credits": 15,
      "badges": [
        { "category": "ASSIDUITE", "name": "Présence Parfaite", "earnedAt": "2026-01-25" },
        { "category": "PROGRESSION", "name": "Champion Maths", "earnedAt": "2026-01-20" }
      ],
      "sessions": [
        { "subject": "MATHEMATIQUES", "status": "COMPLETED", "completedAt": "2026-01-15" },
        { "subject": "PHYSIQUE_CHIMIE", "status": "COMPLETED", "completedAt": "2026-01-18" }
      ]
    },
    {
      "firstName": "Omar",
      "lastName": "Ben Ali",
      "grade": "Première",
      "school": "Lycée Pilote",
      "credits": 8,
      "badges": [
        { "category": "CURIOSITE", "name": "Explorateur", "earnedAt": "2026-01-28" }
      ],
      "sessions": [
        { "subject": "FRANCAIS", "status": "COMPLETED", "completedAt": "2026-01-12" }
      ]
    }
  ],
  "payments": [
    { "type": "SUBSCRIPTION", "amount": 150, "status": "COMPLETED", "date": "2026-01-01" },
    { "type": "CREDIT_PACK", "amount": 100, "status": "COMPLETED", "date": "2026-01-15" }
  ]
}
```

---

## 8. Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Large transaction history causes slow load** | High | Medium | Implement pagination (20 items/page), lazy loading, consider backend pagination API |
| **Progress calculation inaccurate** | High | Low | Thorough unit tests, verify with real data, add data validation |
| **Chart rendering issues on mobile** | Medium | Medium | Responsive testing, use ResponsiveContainer, fallback to table view |
| **Recharts bundle size increase** | Low | Low | Already installed (no new dependency), tree-shaking enabled |
| **Parent.json fixture missing** | Low | Medium | Create comprehensive fixture in Phase 4, document in E2E setup |
| **Security: data leakage** | Critical | Low | Strict Prisma queries, integration tests for data isolation, code review |

---

## 9. Performance Considerations

### 9.1 API Optimization

**Current Approach** (acceptable for MVP):
- Single API call fetches all dashboard data
- Aggregate calculations done in application code
- Response cached in client state (React state)

**Future Optimizations** (if needed):
- Server-side caching (Redis) for expensive calculations
- Pagination for financial history (backend endpoint `/api/parent/transactions`)
- Incremental data loading (fetch badges/charts on demand)
- Database indexes on frequently queried fields

### 9.2 Frontend Optimization

**Current Approach**:
- Recharts renders on client-side
- CSV export in browser (no server processing)
- Client-side filtering/sorting

**Future Optimizations**:
- Virtualized lists for large transaction tables (react-window)
- Memoize chart data transformations (useMemo)
- Code splitting for chart components (React.lazy)

### 9.3 Database Indexes

**Existing Indexes** (from Prisma schema):
- `StudentBadge`: `@@unique([studentId, badgeId])`
- `Payment`: `@@unique([externalId, method])`
- `CreditTransaction`: `@@index([studentId, createdAt])`
- `SessionBooking`: `@@index([studentId, scheduledDate])`

**No New Indexes Required** for MVP - existing indexes cover query patterns.

**Monitor in Production**:
- Slow query log (Prisma logging)
- API response times (monitoring tool)
- If needed, add composite indexes later

---

## 10. Success Criteria

### 10.1 Functional Requirements ✅

- [x] FR-1: Badge Display - All badges shown with category grouping
- [x] FR-2: Financial Transaction History - Complete history with filters
- [x] FR-3: Progress Evolution Charts - Line/bar charts with time range selector
- [x] FR-4: Data Access Security - Parent-child relationship validated

### 10.2 Non-Functional Requirements ✅

- [x] NFR-1: Performance - Dashboard loads < 2s
- [x] NFR-2: Responsive Design - Mobile-first, tested on all devices
- [x] NFR-3: Accessibility - WCAG 2.1 AA compliant
- [x] NFR-4: Data Integrity - Real-time accuracy, immutable transactions

### 10.3 Technical Quality ✅

- [x] All tests pass (unit, integration, E2E)
- [x] TypeScript strict mode (no `any` types)
- [x] ESLint rules followed
- [x] Code reviewed and approved
- [x] Production build succeeds
- [x] No security vulnerabilities

---

## 11. Rollback Plan

**If critical issues found in production**:

1. **Immediate Action**:
   - Revert to previous deployment (Git tag)
   - Disable new sections via feature flag (if implemented)
   - Monitor error logs

2. **Database Rollback**:
   - Not applicable (no schema changes)
   - No data migration needed

3. **Communication**:
   - Notify stakeholders
   - Post incident report
   - Schedule fix deployment

---

## 12. Next Steps (Out of Scope for MVP)

**Future Enhancements**:
1. Real-time notifications when child earns badge (WebSockets)
2. Comparative analytics across children (side-by-side charts)
3. Predictive progress forecasting (ML model)
4. Invoice PDF generation (backend service)
5. Advanced filtering (multiple filters combined)
6. Export to Excel/PDF formats
7. Scheduled financial reports (email digest)
8. Custom progress goals set by parent
9. Badge sharing on social media

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-02  
**Next Review**: After Phase 4 completion
