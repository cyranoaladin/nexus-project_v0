# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: 98e052ea-04f1-4f51-8f83-0c835f6a974a -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: 7a3dbb33-31df-4cad-93ae-b62155fcf24b -->

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
<!-- chat-id: 6c1c38ea-a38f-4558-a983-ea33aa1b812d -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function) or too broad (entire feature).

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

---

## Implementation Steps

### [x] Step: Core Dashboard Structure
<!-- chat-id: 75e9b064-309c-4606-8200-19e5f8fb4e96 -->

Create the new student dashboard route with basic layout and data fetching.

**Files to create:**
- `app/(dashboard)/student/page.tsx` - Main dashboard page (Server Component)
- `app/(dashboard)/student/layout.tsx` - Optional: shared layout

**Tasks:**
- [ ] Create route group `(dashboard)` directory
- [ ] Implement server-side data fetching from `/api/student/dashboard`
- [ ] Add role-based access guard (ELEVE only, redirect others)
- [ ] Create dashboard grid layout (left 60% / right 40%)
- [ ] Add header with student name and logout button

**References:**
- Spec: Section 2.1, 2.4, 3.1
- Existing: `/app/dashboard/eleve/page.tsx`, `/app/api/student/dashboard/route.ts`

**Verification:**
- `/dashboard/student` accessible for ELEVE role
- Redirects non-authenticated users to `/auth/signin`
- TypeScript compiles: `npm run typecheck`
- Linting passes: `npm run lint`

---

### [x] Step: Dashboard Stat Cards
<!-- chat-id: 1586e56d-13d0-4fed-8a5a-0d02778990f2 -->

Implement credit balance, next session, and badges cards using Radix UI components.

**Files to modify/create:**
- `app/(dashboard)/student/page.tsx` - Add StatCards components

**Tasks:**
- [ ] Create Credit Balance Card with icon (lucide-react CreditCard)
- [ ] Create Next Session Card with session details
- [ ] Create Badge Progress Card with badge count
- [ ] Add credit transaction history with Accordion (Radix UI)
- [ ] Style cards with existing Card component from `components/ui/card.tsx`

**References:**
- Spec: Section 4.3 (FR-3.1, FR-5.1)
- Existing: `components/ui/card.tsx`, `components/ui/accordion.tsx`

**Verification:**
- Credit balance displays current balance and transaction history
- Next session card shows upcoming session (or "No session" message)
- Badge card displays earned badge count
- Accordion expands/collapses transaction history
- TypeScript + lint pass

---

### [x] Step: ARIA Streaming Backend
<!-- chat-id: f1d23404-25ea-470d-b9ef-a5532cd02dd1 -->

Implement OpenAI streaming in ARIA backend with Server-Sent Events.

**Files to create/modify:**
- `lib/aria-streaming.ts` - NEW: Streaming utilities
- `lib/aria.ts` - MODIFIED: Add `generateAriaResponseStream()` function
- `app/api/aria/chat/route.ts` - MODIFIED: Support streaming requests

**Tasks:**
- [ ] Create `generateAriaResponseStream()` in `lib/aria-streaming.ts`
- [ ] Use OpenAI SDK with `stream: true` option
- [ ] Return ReadableStream with SSE format (`data: {token}\n\n`)
- [ ] Modify `/api/aria/chat` to detect `Accept: text/event-stream` header
- [ ] Return streaming response for streaming requests
- [ ] Maintain backward compatibility (non-streaming path)
- [ ] Keep existing conversation history and badge award logic

**References:**
- Spec: Section 2.2, 4.2.1
- Existing: `lib/aria.ts`, `app/api/aria/chat/route.ts`

**Verification:**
- Streaming endpoint returns `Content-Type: text/event-stream`
- Tokens sent progressively via SSE
- Non-streaming endpoint still works
- Conversations and messages save to database
- Badge awards trigger correctly
- TypeScript + lint pass

---

### [ ] Step: ARIA Embedded Chat Component

Create embedded ARIA chat interface with streaming support.

**Files to create:**
- `components/ui/aria-embedded-chat.tsx` - NEW: Embedded ARIA chat

**Tasks:**
- [ ] Create `AriaEmbeddedChat` component (TypeScript + React)
- [ ] Add subject selector (Select component from Radix UI)
- [ ] Implement message input field with Send button
- [ ] Add message list with conversation history
- [ ] Implement streaming message display (append tokens progressively)
- [ ] Show typing indicator while waiting for first token
- [ ] Add feedback buttons (👍/👎) on each ARIA response
- [ ] Persist feedback to database
- [ ] Handle loading and error states

**References:**
- Spec: Section 2.3, 4.3.1
- Existing: `components/ui/aria-chat.tsx` (reference but don't modify)

**Verification:**
- Subject selector displays all available subjects
- Messages send on Enter key and button click
- Streaming begins within 1 second
- Tokens appear progressively in real-time
- Full response displays correctly
- Feedback buttons work and persist state
- Conversation history loads on mount
- TypeScript + lint pass

---

### [ ] Step: Integrate ARIA into Dashboard

Add ARIA chat component to student dashboard with proper styling.

**Files to modify:**
- `app/(dashboard)/student/page.tsx` - Add AriaEmbeddedChat

**Tasks:**
- [ ] Import and add `AriaEmbeddedChat` to dashboard layout
- [ ] Position in left column (full height)
- [ ] Pass student ID from session
- [ ] Add proper spacing and container styling
- [ ] Test with multiple subjects

**References:**
- Spec: Section 2.3, 4.2 (FR-2.2)

**Verification:**
- ARIA chat visible in dashboard
- Subject selection works
- Messages send and stream correctly
- Layout doesn't break on different screen sizes
- TypeScript + lint pass

---

### [ ] Step: Session Calendar Component

Create calendar widget with session highlights using react-day-picker.

**Files to create:**
- `components/ui/session-calendar.tsx` - NEW: Calendar widget

**Tasks:**
- [ ] Create `SessionCalendar` component with TypeScript interface
- [ ] Integrate `react-day-picker` (already in package.json)
- [ ] Display next 30 days
- [ ] Highlight dates with scheduled sessions
- [ ] Add Popover (Radix UI) for session details on date click
- [ ] Display session info: title, subject, coach, time, status
- [ ] Add "Join Session" button (if scheduled for today/now)
- [ ] Style with Tailwind CSS matching design system

**References:**
- Spec: Section 4.4 (FR-4.1, FR-4.2), 4.3.2
- Existing: `components/ui/popover.tsx`, `components/ui/session-booking.tsx`

**Verification:**
- Calendar displays current month
- Session dates highlighted correctly
- Popover shows on date click
- Session details accurate
- Dates without sessions don't show popover
- TypeScript + lint pass

---

### [ ] Step: Session Booking Integration

Integrate session booking into calendar using Dialog component.

**Files to modify:**
- `components/ui/session-calendar.tsx` - Add booking dialog
- Existing: Reuse `components/ui/session-booking.tsx`

**Tasks:**
- [ ] Add "Book Session" button to calendar
- [ ] Wrap `SessionBooking` component in Dialog (Radix UI)
- [ ] Pass selected date to booking component
- [ ] Handle booking completion callback
- [ ] Refresh calendar after successful booking
- [ ] Add error handling for booking failures

**References:**
- Spec: Section 4.4 (FR-4.3)
- Existing: `components/ui/session-booking.tsx`, `components/ui/dialog.tsx`

**Verification:**
- Book button opens dialog
- Booking form displays available slots
- Booking completes successfully
- Calendar refreshes with new booking
- Dialog closes after booking
- TypeScript + lint pass

---

### [ ] Step: Recent Sessions List

Add recent sessions list to dashboard bottom section.

**Files to modify:**
- `app/(dashboard)/student/page.tsx` - Add recent sessions component

**Tasks:**
- [ ] Create recent sessions list section
- [ ] Display last 5 sessions from dashboard API
- [ ] Show session status badges (scheduled, completed, cancelled)
- [ ] Add links to session details pages
- [ ] Style with Card components

**References:**
- Spec: Section 4.1 (FR-1.2), 4.2

**Verification:**
- Recent sessions display correctly
- Status badges color-coded properly
- Links navigate to correct pages
- Empty state shows appropriate message
- TypeScript + lint pass

---

### [ ] Step: E2E Test Setup

Create Playwright E2E test infrastructure for student dashboard.

**Files to create:**
- `e2e/.auth/student.json` - Auth state for student user
- `e2e/student-aria.spec.ts` - E2E test suite

**Tasks:**
- [ ] Create authenticated student session state in `.auth/student.json`
- [ ] Add student.json to `.gitignore`
- [ ] Setup Playwright test with `storageState` authentication
- [ ] Add test utilities for waiting on streaming responses

**References:**
- Spec: Section 6.4
- Existing: `playwright.config.ts`, other E2E tests in `e2e/` directory

**Verification:**
- Auth state file created and gitignored
- Playwright recognizes auth state
- Test can navigate to protected routes
- TypeScript compiles test file

---

### [ ] Step: E2E Test - ARIA Interaction

Write E2E test for student asking ARIA a question with streaming response.

**Files to modify:**
- `e2e/student-aria.spec.ts` - Add test cases

**Tasks:**
- [ ] Test: Navigate to `/dashboard/student`
- [ ] Test: Verify dashboard loads (student name, credits visible)
- [ ] Test: Select subject "Mathématiques"
- [ ] Test: Type and send question to ARIA
- [ ] Test: Verify loading indicator appears
- [ ] Test: Wait for streaming response to begin
- [ ] Test: Verify complete response displayed
- [ ] Test: Click thumbs up feedback button
- [ ] Test: Verify feedback state persists
- [ ] Test: Reload page and verify conversation history

**References:**
- Spec: Section 4.6 (FR-6.2), 6.4

**Verification:**
- All test assertions pass
- Test passes in Chromium
- Test passes in Firefox
- Test passes in WebKit
- No flaky tests (run 3 times consecutively)
- Command: `npm run test:e2e`

---

### [ ] Step: Polish and Accessibility

Add loading states, error boundaries, and accessibility improvements.

**Tasks:**
- [ ] Add loading skeletons for dashboard cards
- [ ] Add error boundaries for ARIA chat and calendar
- [ ] Ensure keyboard navigation works (Tab, Enter, Escape)
- [ ] Add proper ARIA labels for screen readers
- [ ] Test focus management in dialogs and popovers
- [ ] Optimize with React.memo for performance
- [ ] Add error messages for API failures
- [ ] Test responsive layout (1280px, 768px, 375px)

**References:**
- Spec: Section 5.2, 5.5

**Verification:**
- Lighthouse Accessibility score > 95
- Keyboard navigation works for all interactions
- Screen reader announces content correctly
- No console errors or warnings
- Layout works on tablet and mobile
- TypeScript + lint pass

---

### [ ] Step: Final Verification

Run all tests and verification commands to ensure production readiness.

**Tasks:**
- [ ] Run TypeScript type checking: `npm run typecheck`
- [ ] Run ESLint: `npm run lint`
- [ ] Run unit tests: `npm run test:unit` (if available)
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Test manual flow: login → dashboard → ARIA → calendar → booking
- [ ] Verify existing dashboard `/dashboard/eleve` still works
- [ ] Check performance (dashboard < 2s, ARIA < 1s)
- [ ] Test error scenarios (network failure, API error)

**References:**
- Spec: Section 6 (Verification Approach)

**Verification:**
- ✅ All TypeScript errors resolved
- ✅ All ESLint errors resolved
- ✅ All unit tests pass
- ✅ All E2E tests pass
- ✅ Manual testing checklist completed
- ✅ No regressions in existing features
- ✅ Performance benchmarks met
