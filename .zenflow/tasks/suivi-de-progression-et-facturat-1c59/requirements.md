# Product Requirements Document (PRD)
## Dashboard Parent: Suivi de Progression et Facturation

### 1. Overview

**Feature Name:** Dashboard Parent - Progression Tracking and Billing

**Objective:** Enhance the existing Parent Dashboard to display children's earned badges, financial transaction history, and progress evolution charts while ensuring parents only see their own children's data.

**Priority:** High

**Target Users:** Parents (UserRole: PARENT)

### 2. Background & Context

**Current State:**
- Basic parent dashboard exists at `/app/dashboard/parent/page.tsx`
- API endpoint `/api/parent/dashboard` provides children data including:
  - Basic child info (name, grade, school)
  - Credit balance
  - Active subscription
  - Next session
  - Overall progress percentage
  - Subject-specific progress
- Authentication and role-based access control implemented via NextAuth

**Gap Analysis:**
The current dashboard lacks:
1. Visual display of children's earned badges/achievements
2. Comprehensive financial transaction history
3. Visual charts showing progress evolution over time
4. Consolidated view of all financial activities (payments, subscriptions, credit purchases)

**Business Value:**
- Increased parent engagement and satisfaction
- Better visibility into child's achievements and motivation
- Transparent financial tracking
- Enhanced trust through clear data visualization
- Reduced support requests about progress and billing

### 3. Requirements

#### 3.1 Functional Requirements

**FR-1: Badge Display**
- **Description:** Display all badges earned by each child
- **Acceptance Criteria:**
  - Show badges from `StudentBadge` table for selected child
  - Display badge icon, name, description, category, and earned date
  - Group badges by category (ASSIDUITE, PROGRESSION, CURIOSITE)
  - Show total badge count per child
  - Visual indicator for recently earned badges (within last 7 days)
- **Data Source:** `StudentBadge` joined with `Badge` table
- **UI Location:** New card in dashboard grid or dedicated badges section

**FR-2: Financial Transaction History**
- **Description:** Display complete financial transaction history for parent account
- **Acceptance Criteria:**
  - Show all payments from `Payment` table for parent user
  - Display: date, type, amount, currency, status, description, method
  - Include credit transactions from `CreditTransaction` for all children
  - Support filtering by:
    - Transaction type (SUBSCRIPTION, CREDIT_PACK, USAGE, etc.)
    - Child (for credit transactions)
    - Date range
    - Status
  - Show running balance for credits per child
  - Paginated view with default 20 items per page
  - Export capability (CSV) for record keeping
- **Data Sources:** 
  - `Payment` table (filtered by parent userId)
  - `CreditTransaction` table (for all parent's children)
- **UI Location:** Dedicated "Historique Financier" card or tab

**FR-3: Progress Evolution Charts**
- **Description:** Visual charts showing score/progress trends over time
- **Acceptance Criteria:**
  - Line chart showing overall progress over time (last 3 months)
  - Bar chart comparing subject-specific progress
  - Session completion rate over time
  - Credit usage visualization
  - Interactive tooltips showing details on hover
  - Toggle between different children
  - Time range selector (1 month, 3 months, 6 months, 1 year)
  - Data points based on session completion dates
- **Chart Library:** Recharts (already in dependencies)
- **Data Calculation:**
  - Aggregate completed sessions per week/month
  - Calculate progress percentage at each milestone
  - Track subject-specific improvements
- **UI Location:** Dedicated "Évolution" card with charts

**FR-4: Data Access Security**
- **Description:** Ensure parents only see their own children's data
- **Acceptance Criteria:**
  - Backend API validates parent-child relationship via `ParentProfile` table
  - All queries filtered by `parentId` matching authenticated user
  - Return 403 Forbidden if attempting to access other parent's data
  - No client-side data leakage
  - Audit trail for data access (via existing logging)
- **Security Measures:**
  - Server-side session validation
  - Strict Prisma queries with `parentId` filter
  - No exposed child IDs in URLs (use internal mapping)

#### 3.2 Non-Functional Requirements

**NFR-1: Performance**
- Dashboard loads in < 2 seconds
- Charts render smoothly without lag
- Efficient database queries (use Prisma relations, limit N+1 queries)
- Implement pagination for large transaction lists

**NFR-2: Responsive Design**
- Mobile-first approach
- Charts adapt to screen size
- Touch-friendly interactions for mobile users
- Consistent with existing dashboard styling (Tailwind CSS)

**NFR-3: Accessibility**
- ARIA labels for charts and interactive elements
- Keyboard navigation support
- Color contrast meets WCAG 2.1 AA standards
- Screen reader compatible

**NFR-4: Data Integrity**
- Real-time data accuracy
- Transaction history immutable (no editing)
- Badge awards properly timestamped
- Progress calculations mathematically accurate

### 4. User Stories

**US-1:** As a parent, I want to see all badges my child has earned so that I can celebrate their achievements and understand their engagement.

**US-2:** As a parent, I want to view my complete financial history (payments, subscriptions, credit purchases) so that I can track my expenses and verify charges.

**US-3:** As a parent, I want to see charts showing my child's progress over time so that I can understand if they are improving or need additional support.

**US-4:** As a parent, I want to filter financial transactions by type and date so that I can easily find specific payments or charges.

**US-5:** As a parent, I want to export my financial history to CSV so that I can maintain my own records for tax or budgeting purposes.

**US-6:** As a parent with multiple children, I want the badge and progress displays to update when I switch between children so that I can compare their individual achievements.

### 5. Data Model Requirements

**Existing Models (No Changes Required):**
- `User` - Parent authentication
- `ParentProfile` - Parent-children relationship
- `Student` - Child entity
- `StudentBadge` - Badge awards
- `Badge` - Badge definitions
- `Payment` - Financial transactions
- `CreditTransaction` - Credit movements
- `SessionBooking` - Progress tracking data

**API Data Structure (Extension of Existing):**

```typescript
interface EnhancedChildData extends CurrentChildData {
  badges: Array<{
    id: string;
    badge: {
      name: string;
      description: string;
      category: string;
      icon: string;
    };
    earnedAt: Date;
    isRecent: boolean; // earned within last 7 days
  }>;
  progressHistory: Array<{
    date: Date;
    progress: number;
    sessionsCompleted: number;
  }>;
  subjectProgressHistory: Record<string, Array<{
    date: Date;
    progress: number;
  }>>;
}

interface FinancialTransaction {
  id: string;
  date: Date;
  type: 'PAYMENT' | 'CREDIT_ALLOCATION' | 'CREDIT_USAGE' | 'REFUND';
  description: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  childName?: string; // for credit transactions
}
```

### 6. UI/UX Requirements

**Layout Structure:**
1. Existing header with child selector (unchanged)
2. Child summary card (enhanced with badge count)
3. New section: "Badges et Récompenses" (collapsible card)
4. New section: "Évolution des Performances" (chart card)
5. New section: "Historique Financier" (table card)
6. Existing session agenda and subscription cards

**Visual Design:**
- Use existing Tailwind config and design tokens
- Card-based layout with shadow and rounded corners
- Brand colors: brand-primary for highlights
- Icons from lucide-react
- Recharts with brand color scheme
- Responsive grid (1 column mobile, 2 columns tablet, 3 columns desktop)

**Interaction Patterns:**
- Smooth animations (framer-motion)
- Loading skeletons during data fetch
- Error states with retry button
- Empty states with helpful messages
- Tooltips for additional information

### 7. Technical Considerations

**Frontend (Next.js 15 App Router):**
- Enhance existing `/app/dashboard/parent/page.tsx`
- Add new components:
  - `BadgeDisplay.tsx` - Badge grid with filtering
  - `ProgressChart.tsx` - Recharts line/bar charts
  - `FinancialHistory.tsx` - Transaction table with filters
- Use React Query or SWR for data fetching (or stick with existing fetch pattern)
- Client-side filtering/sorting for better UX

**Backend API:**
- Enhance `/app/api/parent/dashboard/route.ts` to include:
  - Student badges (join StudentBadge + Badge)
  - Historical progress data (aggregate SessionBooking by date)
  - Payment transactions (filter by parent userId)
  - Credit transaction history (for all children)
- Add new endpoint `/app/api/parent/transactions` for paginated financial data
- Implement efficient Prisma queries with proper indexing

**State Management:**
- Maintain existing useState/useCallback pattern
- Consider React Context if badge/transaction data needs sharing across components

**Testing Requirements:**
- Unit tests for progress calculation logic
- Integration tests for API endpoints with test parent data
- E2E test with `parent.json` test state (as mentioned in task)
- Test data isolation (parent can only see own children)

### 8. Assumptions & Decisions

**Assumptions:**
1. Badge system is already seeded with badge definitions
2. Parents have at least one child registered
3. Session completion data is accurate and up-to-date
4. Payment records are complete and correct in database
5. Parent.json test file will be created/used for verification

**Decisions:**
1. Use Recharts for charts (already in dependencies, lightweight, React-friendly)
2. Keep financial history on same page (avoid separate billing page for MVP)
3. Calculate progress history from SessionBooking.completedAt timestamps
4. Show last 3 months of progress by default (configurable)
5. No real-time updates (manual refresh via pull-to-refresh pattern)
6. CSV export uses client-side generation (no backend endpoint needed)
7. Badge display limited to 50 most recent per child (pagination if needed)

**Minor Details (Reasonable Assumptions):**
- Badge icons displayed as emoji (already defined in Badge table)
- Transaction amounts always positive (sign indicates debit/credit)
- Chart colors use existing brand palette from Tailwind config
- Empty states show friendly messaging encouraging first action
- Mobile view stacks charts vertically

### 9. Out of Scope (Future Enhancements)

- Real-time notifications when child earns a badge
- Comparative analytics across multiple children (side-by-side)
- Predictive analytics (forecasted progress)
- Invoice PDF generation
- Payment method management (add/edit cards)
- Scheduled payment reminders
- Export to other formats (PDF, Excel)
- Advanced filtering (multiple filters combined)
- Badge sharing on social media
- Custom progress goals set by parent

### 10. Success Metrics

- Parent engagement: 80%+ of parents access dashboard weekly
- Feature adoption: 60%+ parents view badges section within first week
- Support reduction: 30% decrease in billing-related inquiries
- User satisfaction: 4.5+ rating for dashboard clarity (if surveyed)
- Performance: Dashboard load time < 2s for 95th percentile

### 11. Dependencies

**External:**
- Recharts library (already installed)
- lucide-react icons (already installed)
- Tailwind CSS (configured)

**Internal:**
- Existing authentication system (NextAuth)
- Existing Prisma schema and database
- Existing parent/child relationship data
- Badge system seeded with definitions
- Session completion tracking functional

### 12. Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Large transaction history causes slow load | High | Medium | Implement pagination, lazy loading |
| Missing badge data for older students | Medium | Low | Show empty state, encourage engagement |
| Progress calculation inaccurate | High | Low | Thorough testing, verify with real data |
| Chart rendering issues on mobile | Medium | Medium | Responsive design testing, fallback to table |
| Parent.json test data missing | Low | Low | Create comprehensive test fixture |

### 13. Implementation Notes

**Phase 1: Backend Enhancement (API)**
1. Extend `/api/parent/dashboard` to include badges
2. Add progress history calculation
3. Add financial transaction aggregation
4. Ensure security filters on all queries

**Phase 2: Frontend Components**
1. Create BadgeDisplay component
2. Create ProgressChart component using Recharts
3. Create FinancialHistory table component
4. Integrate into existing page.tsx

**Phase 3: Testing & Refinement**
1. Create parent.json test fixture
2. Test with multiple children scenarios
3. Performance optimization (query batching)
4. Accessibility audit
5. Mobile responsiveness testing

**Phase 4: Documentation & Deployment**
1. Update API documentation
2. Create user guide for parents
3. Deploy to staging
4. UAT with real parent accounts
5. Production deployment

### 14. Open Questions & Clarifications

**Q1:** Should financial history include pending transactions or only completed?
**A1:** *Assumption: Include all statuses with clear visual distinction*

**Q2:** What time period should progress charts cover by default?
**A2:** *Decision: Last 3 months with option to change*

**Q3:** Should badges be shown for all children or only selected child?
**A3:** *Decision: Only for selected child (consistent with existing pattern)*

**Q4:** How granular should progress history be (daily, weekly, monthly)?
**A4:** *Decision: Weekly aggregation for up to 3 months, monthly for longer periods*

**Q5:** Should there be a limit on transaction history displayed?
**A5:** *Decision: Paginated with 20 items per page, infinite scroll or load more button*

### 15. Acceptance Criteria Summary

The feature is considered complete when:

✅ Parents can view all badges earned by each child with category grouping
✅ Parents can view complete financial transaction history with filtering
✅ Parents can see visual charts of progress evolution over time
✅ All data queries are secured (parents see only their children's data)
✅ Dashboard is responsive on mobile, tablet, and desktop
✅ Performance meets < 2s load time requirement
✅ Tests pass using parent.json test fixture
✅ Accessibility standards met (WCAG 2.1 AA)
✅ No console errors or warnings in browser
✅ All existing dashboard features remain functional
