# Product Requirements Document
## Workspace Étudiant et Interface de Chat Intelligente ARIA

**Version:** 1.0  
**Date:** 2026-02-02  
**Status:** Draft - Awaiting Clarifications

---

## 1. Executive Summary

This feature enhances the student experience by creating a new student dashboard workspace at `/app/(dashboard)/student` that integrates the ARIA intelligent chat assistant with OpenAI streaming capabilities. The dashboard will display the student's credit balance and booking calendar using existing Radix UI components. An end-to-end test will verify the complete flow from student login through ARIA interaction.

---

## 2. Context & Background

### 2.1 Current State

**Existing Components:**
- Student dashboard exists at `/app/dashboard/eleve/page.tsx`
- ARIA chat component exists at `components/ui/aria-chat.tsx` (widget format)
- ARIA backend at `lib/aria.ts` using OpenAI non-streaming API
- Student dashboard API at `/app/api/student/dashboard/route.ts`
- ARIA chat API at `/app/api/aria/chat/route.ts`
- Radix UI components library (accordion, calendar, cards, dialogs, etc.)
- Session booking component with calendar at `components/ui/session-booking.tsx`
- Badge system and gamification components
- E2E test infrastructure with Playwright

**Architecture:**
- Next.js 15 with TypeScript
- App Router architecture
- PostgreSQL with Prisma ORM
- OpenAI GPT-4o-mini integration
- NextAuth.js for authentication
- Radix UI + Tailwind CSS v4

### 2.2 Business Requirements

**Goal:** Provide students with a dedicated workspace where they can:
1. Access ARIA chat with real-time streaming responses
2. Monitor their credit balance
3. View and manage their session bookings
4. Track their academic progress and badges

---

## 3. User Stories

### Primary User Story
**As a** student (ELEVE)  
**I want to** access a dedicated dashboard workspace with integrated ARIA chat  
**So that** I can get instant pedagogical assistance while managing my credits and sessions

### Supporting User Stories

1. **Chat with ARIA**
   - As a student, I want to ask ARIA questions about my subjects and see responses stream in real-time
   - As a student, I want to select a subject before asking questions to get relevant pedagogical content
   - As a student, I want to provide feedback (👍/👎) on ARIA's responses

2. **Monitor Credits**
   - As a student, I want to see my current credit balance prominently displayed
   - As a student, I want to view my recent credit transactions

3. **Manage Sessions**
   - As a student, I want to view my upcoming sessions in a calendar
   - As a student, I want to book new sessions directly from the dashboard

4. **Track Progress**
   - As a student, I want to see my earned badges
   - As a student, I want to view my recent sessions and their status

---

## 4. Functional Requirements

### 4.1 New Dashboard Route: `/app/(dashboard)/student`

**FR-1.1: Route Structure**
- Create a new route group `(dashboard)` in the app directory
- Path: `/app/(dashboard)/student/page.tsx`
- Accessible only to authenticated users with role `ELEVE`

**FR-1.2: Dashboard Layout**
- Header with student name and logout button
- Main grid layout with:
  - Credit balance card (top left)
  - Next session card (top center)
  - Progress/badges card (top right)
  - ARIA chat interface (left column, full height)
  - Calendar/booking interface (right column)
  - Recent sessions list (bottom)

**FR-1.3: Data Fetching**
- Use existing `/api/student/dashboard` endpoint
- Display:
  - Student profile (name, grade, school)
  - Credit balance and transaction history
  - Next scheduled session
  - Recent sessions (last 5)
  - ARIA conversation statistics
  - Earned badges (last 5)

### 4.2 ARIA Chat Integration with Streaming

**FR-2.1: Streaming Implementation**
- Upgrade ARIA chat to use OpenAI streaming API
- Display responses in real-time as tokens arrive
- Show typing indicator while waiting for first token

**FR-2.2: Chat Interface Enhancement**
- Embedded chat panel (not floating widget)
- Subject selector dropdown (using existing Subject enum)
- Message input with multi-line support
- Conversation history display
- Feedback buttons (👍/👎) on each ARIA response

**FR-2.3: Chat API Enhancement**
- Modify `/api/aria/chat/route.ts` to support streaming
- Use `ReadableStream` for Server-Sent Events (SSE)
- Return streaming response with proper headers
- Maintain existing conversation history and badge award logic

**FR-2.4: Conversation Management**
- Load existing conversations
- Create new conversations per subject
- Auto-save messages to database
- Display conversation metadata (subject, date, message count)

### 4.3 Credit Balance Display (Radix UI Components)

**FR-3.1: Credit Balance Card**
- Use existing `Card` component from `components/ui/card.tsx`
- Display:
  - Current balance (large, prominent)
  - Credit icon (CreditCard from lucide-react)
  - Last transaction info
  - Link to detailed transaction history

**FR-3.2: Credit Transaction History**
- Collapsible `Accordion` component (Radix UI)
- Show last 10 transactions
- Display: type, amount, date, description
- Color-coded by transaction type (green for credits added, red for usage)

### 4.4 Session Booking Calendar (Radix UI Components)

**FR-4.1: Calendar Component**
- Use `react-day-picker` integration (already in package.json)
- Display next 30 days
- Highlight dates with scheduled sessions
- Show session details on date hover/click

**FR-4.2: Session Details Popover**
- Use Radix UI `Popover` component
- Display when clicking a date with sessions:
  - Session title
  - Subject
  - Coach name
  - Time and duration
  - Status
  - Join button (if scheduled for today/now)

**FR-4.3: Booking Integration**
- Integrate existing `SessionBooking` component
- Open in `Dialog` component (Radix UI)
- Triggered by "Book Session" button
- Show available slots for selected date

### 4.5 Badge and Progress Display

**FR-5.1: Badge Widget**
- Reuse existing `BadgeWidget` component
- Display in dedicated card
- Show earned badges count
- Recent badges with icons and earned dates

**FR-5.2: Progress Indicators**
- Sessions completed count
- ARIA questions asked today
- Current streak (if applicable)

### 4.6 E2E Test with Playwright

**FR-6.1: Test Setup**
- Create `student.json` auth state file in `.auth/` directory
- Pre-authenticate a test student user
- Use Playwright's `storageState` for authentication

**FR-6.2: Test Scenario: "Student asks ARIA a question"**

Test file: `e2e/student-aria.spec.ts`

**Test Steps:**
1. **Setup:**
   - Use authenticated student state from `student.json`
   - Navigate to `/dashboard/student`

2. **Verify Dashboard Load:**
   - Assert page URL contains `/dashboard/student`
   - Assert student name is visible
   - Assert credit balance is displayed
   - Assert ARIA chat interface is visible

3. **Ask ARIA a Question:**
   - Select subject "Mathématiques" from dropdown
   - Type question: "Comment résoudre une équation du second degré ?"
   - Click send button

4. **Verify Streaming Response:**
   - Assert loading indicator appears
   - Wait for first response token
   - Assert ARIA response is displayed
   - Assert response contains mathematical content

5. **Verify Feedback:**
   - Assert thumbs up/down buttons are visible
   - Click thumbs up button
   - Assert feedback is registered (button state changes)

6. **Verify Persistence:**
   - Reload page
   - Assert conversation history contains the question
   - Assert ARIA response is still visible

---

## 5. Non-Functional Requirements

### 5.1 Performance
- Dashboard should load in < 2 seconds on 4G connection
- ARIA streaming should begin within 1 second of request
- Calendar should render < 500ms
- Support 100+ concurrent student users

### 5.2 Accessibility
- WCAG 2.1 AA compliance (inherited from Radix UI)
- Keyboard navigation for all interactive elements
- Screen reader support with proper ARIA labels
- Focus management in dialogs and popovers

### 5.3 Security
- Role-based access control (ELEVE role only)
- CSRF protection on all API endpoints
- Rate limiting on ARIA API (existing middleware)
- Secure credential storage for student.json (gitignored)

### 5.4 Browser Support
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

### 5.5 Responsive Design
- Desktop: 1280px+ (primary)
- Tablet: 768px-1279px
- Mobile: 375px-767px (limited functionality)

---

## 6. Technical Constraints

### 6.1 Existing Architecture
- Must use Next.js 15 App Router
- Must use existing Prisma schema
- Must use existing API routes where possible
- Must follow existing design system (Design System v2.0)

### 6.2 Component Reuse
- Must reuse existing Radix UI components
- Must reuse existing ARIA logic from `lib/aria.ts`
- Must reuse existing session booking component
- Must reuse existing badge widget

### 6.3 Database
- No schema changes required (existing schema supports all features)
- Use existing `Student`, `AriaConversation`, `AriaMessage` models
- Use existing `CreditTransaction` for credit history
- Use existing `Session` for booking data

---

## 7. Clarifications Needed

### 7.1 CRITICAL CLARIFICATIONS

**Q1: Dashboard Route Conflict**
- The task mentions creating dashboard at `/app/(dashboard)/student`
- An existing dashboard exists at `/app/dashboard/eleve`
- **Question:** Should we:
  - A) Create a NEW dashboard at `/app/(dashboard)/student` (route group)
  - B) Enhance the existing `/app/dashboard/eleve`
  - C) Migrate from `/app/dashboard/eleve` to `/app/(dashboard)/student`
- **Impact:** High - Affects project structure and routing
- **Assumption if not clarified:** Create NEW dashboard at `/app/(dashboard)/student` while keeping existing one

**Q2: "Lot 2" Components Reference**
- Task mentions "Utilise les composants Radix UI du Lot 2"
- No clear reference to "Lot 2" found in codebase
- **Question:** What specific Radix UI components are in "Lot 2"?
  - Is this a batch/phase reference?
  - Which components specifically: Calendar, Card, Dialog, Popover, Accordion?
- **Impact:** Medium - Affects component selection
- **Assumption if not clarified:** Use all available Radix UI components as needed (card, popover, dialog, accordion for credits/calendar)

**Q3: "Dossier Principal" Synchronization**
- Task mentions "Toute modification doit être reportée dans le dossier principal"
- **Question:** What is the "main folder" (dossier principal)?
  - Is it the root `/app` directory?
  - Is it a separate repository?
  - Is it a specific folder we should sync to?
- **Impact:** High - Affects development workflow
- **Assumption if not clarified:** All changes stay in current worktree structure

### 7.2 OPTIONAL CLARIFICATIONS

**Q4: OpenAI Streaming**
- Current ARIA implementation uses non-streaming API
- Task mentions "flux de streaming OpenAI"
- **Question:** Should we implement streaming or keep existing non-streaming approach?
- **Impact:** Medium - Affects user experience
- **Assumption if not clarified:** Implement streaming for better UX

**Q5: Calendar Booking Integration**
- **Question:** Should calendar allow:
  - View-only (see scheduled sessions)
  - OR Full booking (select date → book session)?
- **Impact:** Low - Can be implemented in phases
- **Assumption if not clarified:** View + book (full integration)

**Q6: Mobile Experience**
- **Question:** Should ARIA chat be accessible on mobile?
- **Impact:** Low - Desktop-first acceptable for student workspace
- **Assumption if not clarified:** Desktop-optimized, basic mobile support

---

## 8. Success Criteria

### 8.1 Must Have (MVP)
- ✅ New student dashboard route accessible at `/app/(dashboard)/student`
- ✅ ARIA chat interface embedded in dashboard
- ✅ OpenAI streaming responses working
- ✅ Credit balance displayed with Radix UI Card
- ✅ Session calendar displayed with react-day-picker
- ✅ E2E test passing: student asks question → receives answer
- ✅ All existing tests still passing

### 8.2 Should Have
- ✅ Conversation history persisted and loadable
- ✅ Feedback system (👍/👎) functional
- ✅ Badge display and gamification
- ✅ Session booking from calendar
- ✅ Responsive design for tablet

### 8.3 Nice to Have
- Real-time badge notifications
- Conversation search
- Export conversation history
- Mobile-optimized layout

---

## 9. Dependencies

### 9.1 Technical Dependencies
- ✅ OpenAI API key configured
- ✅ Database seeded with test student
- ✅ ARIA subjects and pedagogical content in database
- ✅ Active subscription with ARIA access

### 9.2 External Dependencies
- OpenAI API availability
- Next.js 15 stable
- Playwright test environment

### 9.3 Team Dependencies
- User acceptance for clarifications (Section 7)
- Design approval for dashboard layout
- QA review of E2E tests

---

## 10. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Route conflict with existing dashboard | High | Medium | Clarify with user (Q1), use route groups |
| OpenAI streaming implementation complexity | Medium | Low | Use OpenAI SDK stream helpers, fallback to non-streaming |
| Performance issues with streaming | Medium | Low | Implement request timeout, rate limiting |
| E2E test flakiness | Low | Medium | Use deterministic waits, proper selectors |
| "Lot 2" unclear reference | Low | High | Assume all Radix UI components available |

---

## 11. Timeline Estimate (for Planning Phase)

Based on codebase analysis:

- **Dashboard Route Creation:** 2 hours
- **ARIA Streaming Integration:** 4 hours
- **Credit Balance UI (Radix):** 2 hours
- **Calendar Integration (Radix):** 3 hours
- **E2E Test Implementation:** 3 hours
- **Testing & Bug Fixes:** 4 hours
- **Documentation:** 2 hours

**Total Estimated:** ~20 hours (2.5 days)

---

## 12. Next Steps

1. **Await User Clarifications** (Section 7) - PRIORITY
2. **Technical Specification** - After clarifications received
3. **Implementation Planning** - Detailed task breakdown
4. **Development** - Implement features
5. **Testing** - Unit, integration, E2E
6. **Documentation** - Update README, API docs

---

## Appendix A: Referenced Files

- `/app/dashboard/eleve/page.tsx` - Existing student dashboard
- `/components/ui/aria-chat.tsx` - ARIA chat widget
- `/lib/aria.ts` - ARIA backend logic
- `/app/api/aria/chat/route.ts` - ARIA API endpoint
- `/app/api/student/dashboard/route.ts` - Student data API
- `/components/ui/session-booking.tsx` - Session booking component
- `/components/ui/badge-widget.tsx` - Badge display component
- `/prisma/schema.prisma` - Database schema
- `/e2e/auth-and-booking.spec.ts` - Example E2E test
- `/docs/DESIGN_SYSTEM.md` - Design system documentation

---

## Appendix B: Radix UI Components Available

From `components/ui/`:
- ✅ Accordion (`accordion.tsx`)
- ✅ Avatar (`avatar.tsx`)
- ✅ Button (`button.tsx`)
- ✅ Card (`card.tsx`)
- ✅ Checkbox (`checkbox.tsx`)
- ✅ Dialog (`dialog.tsx`)
- ✅ Label (`label.tsx`)
- ✅ Popover (`popover.tsx`)
- ✅ Radio Group (`radio-group.tsx`)
- ✅ Scroll Area (`scroll-area.tsx`)
- ✅ Select (`select.tsx`)
- ✅ Switch (`switch.tsx`)
- ✅ Tabs (`tabs.tsx`)
- ✅ Toast (`toast.tsx`)
- ✅ Tooltip (`tooltip.tsx`)

Additional:
- ✅ `react-day-picker` (in package.json)
- ✅ Calendar integration in session booking

---

**Document Status:** Ready for Review & Clarifications  
**Next Action:** User to review and provide answers to Section 7 (Clarifications)
