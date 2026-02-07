# Technical Specification
## Workspace Étudiant et Interface de Chat Intelligente ARIA

**Version:** 1.0  
**Date:** 2026-02-02  
**Based on:** requirements.md v1.0

---

## 1. Technical Context

### 1.1 Technology Stack

**Framework & Language:**
- Next.js 15.5.11 (App Router)
- TypeScript 5
- React 18.3.1

**Database & ORM:**
- PostgreSQL (production)
- Prisma 6.13.0
- Existing schema (no migrations required)

**Authentication:**
- NextAuth.js 4.24.11
- Role-based access control (ELEVE role)

**AI Integration:**
- OpenAI SDK 4.104.0
- GPT-4o-mini model
- Streaming API (to be implemented)

**UI Framework:**
- Radix UI components (accordion, dialog, popover, calendar, etc.)
- Tailwind CSS v4
- react-day-picker 9.8.1
- Framer Motion 11.0.0 (animations)
- Lucide React 0.536.0 (icons)

**Testing:**
- Playwright 1.58.1 (E2E)
- Jest 29.7.0 (unit/integration)
- Testing Library (React)

### 1.2 Existing Architecture

**Current Student Dashboard:**
- Route: `/app/dashboard/eleve/page.tsx`
- API: `/app/api/student/dashboard/route.ts`
- Returns: student profile, credits, sessions, ARIA stats, badges

**Current ARIA Implementation:**
- Widget: `components/ui/aria-chat.tsx` (floating widget)
- Backend: `lib/aria.ts` (non-streaming)
- API: `/app/api/aria/chat/route.ts` (POST endpoint)
- Features: subject selection, conversation history, feedback system

**Reusable Components:**
- `components/ui/session-booking.tsx` - Calendar + booking form
- `components/ui/badge-widget.tsx` - Badge display with gamification
- `components/ui/card.tsx` - Radix Card component
- `components/ui/dialog.tsx` - Radix Dialog (modals)
- `components/ui/popover.tsx` - Radix Popover
- `components/ui/accordion.tsx` - Radix Accordion

### 1.3 Design System Reference

**Tokens:** `lib/theme/tokens.ts`
- Brand colors: primary (#2563EB), accent (#2EE9F6)
- Neutral scale: 50-950
- Typography: Inter (body), Space Grotesk (headings)
- Spacing: 4px base scale
- Shadows: soft, medium, strong, card

**Component Pattern:** shadcn/ui
- CVA (class-variance-authority) for variants
- forwardRef for component composition
- TypeScript interfaces with VariantProps

---

## 2. Implementation Approach

### 2.1 Route Structure Decision

**Decision:** Create NEW dashboard at `/app/(dashboard)/student/page.tsx`

**Rationale:**
- Route groups `(dashboard)` allow shared layout without URL prefix
- Keeps existing `/app/dashboard/eleve` for backward compatibility
- Future-proof: allows gradual migration or A/B testing
- Clear separation of concerns

**Route Mapping:**
- Current: `/dashboard/eleve` → `/app/dashboard/eleve/page.tsx`
- New: `/dashboard/student` → `/app/(dashboard)/student/page.tsx`
- Redirect: Add optional redirect from `/dashboard/eleve` to `/dashboard/student` (future)

### 2.2 ARIA Streaming Implementation

**Current Flow:**
```
Client → POST /api/aria/chat → generateAriaResponse() → openai.chat.completions.create() → JSON response
```

**New Streaming Flow:**
```
Client → POST /api/aria/chat → generateAriaResponseStream() → openai.chat.completions.create({ stream: true }) → ReadableStream (SSE)
```

**Technical Approach:**

1. **Server-Side (API Route):**
   - Detect streaming request via header or query param
   - Use OpenAI SDK streaming: `stream: true`
   - Return `ReadableStream` with proper headers
   - Encode chunks as Server-Sent Events (SSE)

2. **Client-Side (React Component):**
   - Use `fetch()` with `ReadableStream` response
   - Read stream chunks with `reader.read()`
   - Append tokens to message content progressively
   - Show typing indicator until first chunk arrives

3. **Backward Compatibility:**
   - Keep non-streaming endpoint for mobile/legacy clients
   - Detect streaming support via header: `Accept: text/event-stream`
   - Fallback to existing non-streaming implementation

**Code Pattern:**
```typescript
// lib/aria.ts - New streaming function
export async function generateAriaResponseStream(
  studentId: string,
  subject: Subject,
  message: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<ReadableStream> {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [...],
    stream: true
  });
  
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        controller.enqueue(new TextEncoder().encode(`data: ${token}\n\n`));
      }
      controller.close();
    }
  });
}
```

### 2.3 Component Architecture

**Dashboard Layout Structure:**
```
/dashboard/student
├── Header (student name, logout)
├── Main Grid
│   ├── Left Column (60%)
│   │   ├── Stats Row (3 cards: credits, next session, badges)
│   │   └── ARIA Chat Panel (embedded, full height)
│   └── Right Column (40%)
│       ├── Calendar Widget (react-day-picker)
│       └── Recent Sessions List
```

**Component Breakdown:**

1. **StudentDashboardPage** (`app/(dashboard)/student/page.tsx`)
   - Server Component for initial data fetch
   - Role guard: redirect if not ELEVE
   - Pass data to client components

2. **StudentHeader** (inline in page)
   - Student name, avatar
   - Logout button
   - Simple, reuses existing Button component

3. **StatCards** (inline)
   - Credit Balance Card
   - Next Session Card
   - Badge Progress Card
   - Uses existing `Card` component from Radix UI

4. **AriaEmbeddedChat** (`components/ui/aria-embedded-chat.tsx`)
   - NEW component (based on aria-chat.tsx but embedded)
   - Subject selector (Select component)
   - Message list with streaming support
   - Input field with Send button
   - Feedback buttons (👍/👎)

5. **SessionCalendar** (`components/ui/session-calendar.tsx`)
   - NEW component wrapping react-day-picker
   - Highlights dates with sessions
   - Popover on date click (uses Radix Popover)
   - Book button → opens SessionBooking dialog

6. **RecentSessionsList** (inline)
   - Simple list with Card components
   - Session status badges
   - Links to session details

### 2.4 Data Fetching Strategy

**Server-Side Data Fetching:**
```typescript
// app/(dashboard)/student/page.tsx
export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || session.user.role !== 'ELEVE') {
    redirect('/auth/signin');
  }
  
  // Fetch dashboard data server-side
  const res = await fetch(`${process.env.NEXTAUTH_URL}/api/student/dashboard`, {
    headers: { cookie: headers().get('cookie') || '' }
  });
  
  const data = await res.json();
  
  return <StudentDashboardClient data={data} />;
}
```

**Advantages:**
- Faster initial load (no client-side API call)
- SEO-friendly (though not needed for dashboard)
- Automatic authentication via cookies
- No loading state needed for initial render

---

## 3. Source Code Structure Changes

### 3.1 New Files

```
app/
└── (dashboard)/
    └── student/
        ├── page.tsx                 # Main dashboard page (Server Component)
        └── layout.tsx               # Optional: shared layout for student routes

components/ui/
├── aria-embedded-chat.tsx           # Embedded ARIA chat (based on aria-chat.tsx)
└── session-calendar.tsx             # Calendar with session highlights

lib/
└── aria-streaming.ts                # NEW: Streaming utilities for ARIA

e2e/
└── student-aria.spec.ts             # E2E test for student + ARIA

e2e/.auth/
└── student.json                     # Auth state for student E2E tests
```

### 3.2 Modified Files

```
lib/aria.ts
  + generateAriaResponseStream()     # New streaming function
  + Keep existing generateAriaResponse() for compatibility

app/api/aria/chat/route.ts
  + Detect streaming request
  + Return ReadableStream for streaming
  + Maintain existing JSON response path

app/api/student/dashboard/route.ts
  + Add achievements.earnedBadges calculation
  + Ensure consistent response format
```

### 3.3 File Structure Summary

```
.
├── app/
│   ├── (dashboard)/                 # NEW: Route group
│   │   └── student/                 # NEW: Student workspace
│   │       └── page.tsx             # NEW: Main dashboard
│   ├── dashboard/
│   │   └── eleve/
│   │       └── page.tsx             # EXISTING: Keep for compatibility
│   └── api/
│       ├── aria/
│       │   └── chat/
│       │       └── route.ts         # MODIFIED: Add streaming
│       └── student/
│           └── dashboard/
│               └── route.ts         # EXISTING: No changes needed
├── components/ui/
│   ├── aria-embedded-chat.tsx       # NEW: Embedded chat
│   ├── session-calendar.tsx         # NEW: Calendar widget
│   ├── aria-chat.tsx                # EXISTING: Keep for other pages
│   ├── session-booking.tsx          # EXISTING: Reuse
│   └── badge-widget.tsx             # EXISTING: Reuse
├── lib/
│   ├── aria.ts                      # MODIFIED: Add streaming
│   └── aria-streaming.ts            # NEW: Streaming utilities
└── e2e/
    ├── student-aria.spec.ts         # NEW: E2E test
    └── .auth/
        └── student.json             # NEW: Auth state
```

---

## 4. Data Model / API / Interface Changes

### 4.1 Database Schema

**No schema changes required.**

All features use existing models:
- `Student` - Student profile and credits
- `AriaConversation` - Conversation metadata
- `AriaMessage` - Message storage
- `CreditTransaction` - Credit history
- `Session` - Session bookings
- `Badge` + `StudentBadge` - Gamification

### 4.2 API Endpoints

#### 4.2.1 Modified: `/api/aria/chat` (POST)

**Request (Streaming):**
```typescript
POST /api/aria/chat
Headers:
  Accept: text/event-stream
  Content-Type: application/json
Body:
{
  conversationId?: string,
  subject: Subject,
  content: string
}
```

**Response (Streaming):**
```
Content-Type: text/event-stream
Transfer-Encoding: chunked

data: {"type": "token", "content": "Bonjour"}
data: {"type": "token", "content": " ! Je"}
data: {"type": "token", "content": " suis"}
...
data: {"type": "done", "conversationId": "...", "messageId": "..."}
```

**Request (Non-Streaming - Existing):**
```typescript
POST /api/aria/chat
Headers:
  Content-Type: application/json
Body: { ... }
```

**Response (Non-Streaming - Existing):**
```json
{
  "success": true,
  "conversation": { "id": "...", "subject": "...", "title": "..." },
  "message": { "id": "...", "content": "...", "createdAt": "..." },
  "newBadges": [...]
}
```

#### 4.2.2 Existing: `/api/student/dashboard` (GET)

**No changes needed** - response format already matches requirements.

**Response:**
```typescript
{
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    grade: string;
    school: string;
  };
  credits: {
    balance: number;
    transactions: Array<{
      id: string;
      type: string;
      amount: number;
      description: string;
      createdAt: string;
    }>;
  };
  nextSession: {
    id: string;
    title: string;
    subject: string;
    scheduledAt: string;
    duration: number;
    coach: { firstName: string; lastName: string; pseudonym: string; };
  } | null;
  recentSessions: Array<{ ... }>;
  ariaStats: {
    messagesToday: number;
    totalConversations: number;
  };
  badges: Array<{ ... }>;
}
```

### 4.3 Component Interfaces

#### 4.3.1 AriaEmbeddedChat Props

```typescript
interface AriaEmbeddedChatProps {
  studentId: string;
  className?: string;
  defaultSubject?: Subject;
  onNewBadge?: (badge: Badge) => void;
}
```

#### 4.3.2 SessionCalendar Props

```typescript
interface SessionCalendarProps {
  sessions: Array<{
    id: string;
    title: string;
    subject: string;
    scheduledAt: Date;
    duration: number;
    status: SessionStatus;
  }>;
  onBookSession?: () => void;
  className?: string;
}
```

---

## 5. Delivery Phases

### Phase 1: Foundation (Core Dashboard)
**Goal:** Basic dashboard with static data display

**Tasks:**
1. Create route group `(dashboard)` and `student/page.tsx`
2. Implement server-side data fetching
3. Build dashboard layout with grid
4. Add StatCards (credits, next session, badges)
5. Add recent sessions list
6. Role-based access guard

**Verification:**
- ✅ `/dashboard/student` accessible for ELEVE role
- ✅ Redirects non-authenticated users
- ✅ Displays credit balance, next session, badges
- ✅ Shows recent sessions
- ✅ `npm run typecheck` passes
- ✅ `npm run lint` passes

**Deliverable:** Functional dashboard without ARIA

---

### Phase 2: ARIA Streaming Integration
**Goal:** Working ARIA chat with streaming responses

**Tasks:**
1. Create `lib/aria-streaming.ts` with streaming utilities
2. Modify `/api/aria/chat/route.ts` to support streaming
3. Create `AriaEmbeddedChat` component
4. Implement streaming message display
5. Add subject selector
6. Add feedback buttons (👍/👎)
7. Persist conversations to database

**Verification:**
- ✅ ARIA responds with streaming tokens
- ✅ Typing indicator shows before first token
- ✅ Messages save to database
- ✅ Subject selection works
- ✅ Feedback system functional
- ✅ Conversation history loads correctly
- ✅ Badge awards trigger on milestones

**Deliverable:** Streaming ARIA chat embedded in dashboard

---

### Phase 3: Calendar & Booking
**Goal:** Session calendar with booking functionality

**Tasks:**
1. Create `SessionCalendar` component
2. Integrate `react-day-picker`
3. Highlight dates with scheduled sessions
4. Add Popover for session details on date click
5. Integrate existing `SessionBooking` component in Dialog
6. Add "Book Session" button

**Verification:**
- ✅ Calendar displays next 30 days
- ✅ Session dates highlighted
- ✅ Popover shows session details
- ✅ Booking dialog opens
- ✅ Booking flow completes successfully
- ✅ Calendar refreshes after booking

**Deliverable:** Full calendar integration

---

### Phase 4: E2E Testing
**Goal:** Automated E2E test coverage

**Tasks:**
1. Create `e2e/.auth/student.json` auth state
2. Write `e2e/student-aria.spec.ts`
3. Test: login → dashboard load
4. Test: ask ARIA question → receive streaming answer
5. Test: provide feedback (👍)
6. Test: conversation persistence (reload page)
7. Add to CI pipeline

**Verification:**
- ✅ E2E test passes in Chromium
- ✅ E2E test passes in Firefox
- ✅ E2E test passes in WebKit
- ✅ All assertions pass
- ✅ No flaky tests (3 consecutive runs)

**Deliverable:** E2E test coverage

---

### Phase 5: Polish & Documentation
**Goal:** Production-ready code

**Tasks:**
1. Add loading states and error boundaries
2. Optimize performance (React.memo, useMemo)
3. Add keyboard navigation
4. Ensure WCAG 2.1 AA compliance
5. Add JSDoc comments to public APIs
6. Update README with new routes
7. Add inline code comments for complex logic

**Verification:**
- ✅ Lighthouse Accessibility score > 95
- ✅ No console errors/warnings
- ✅ Keyboard navigation works
- ✅ Screen reader compatible
- ✅ All linters pass
- ✅ All tests pass

**Deliverable:** Production-ready feature

---

## 6. Verification Approach

### 6.1 Automated Testing

**Unit Tests (Jest):**
```bash
npm run test:unit
```
- Test ARIA streaming utilities
- Test calendar date highlighting logic
- Test session filtering functions

**Integration Tests (Jest + Testing Library):**
```bash
npm run test:integration
```
- Test AriaEmbeddedChat component
- Test SessionCalendar component
- Mock API responses

**E2E Tests (Playwright):**
```bash
npm run test:e2e
```
- Test complete user flow
- Test streaming responses
- Test conversation persistence

### 6.2 Linting & Type Checking

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript
```

**Expected:** Zero errors, zero warnings

### 6.3 Manual Testing Checklist

**Dashboard:**
- [ ] Dashboard loads in < 2s on 4G
- [ ] Credit balance displayed correctly
- [ ] Next session shown (or "No session" message)
- [ ] Badge count accurate
- [ ] Recent sessions list populated

**ARIA Chat:**
- [ ] Subject selector works
- [ ] Message sends on Enter key
- [ ] Streaming begins within 1s
- [ ] Tokens appear progressively
- [ ] Full response displayed correctly
- [ ] Feedback buttons clickable
- [ ] Feedback state persists

**Calendar:**
- [ ] Current month displayed
- [ ] Session dates highlighted
- [ ] Popover shows on date click
- [ ] Session details accurate
- [ ] Book button opens dialog
- [ ] Booking completes successfully

**Accessibility:**
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Screen reader announcements correct
- [ ] ARIA labels present
- [ ] Color contrast passes WCAG AA

**Performance:**
- [ ] Dashboard load < 2s
- [ ] ARIA first token < 1s
- [ ] Calendar render < 500ms
- [ ] No layout shifts (CLS < 0.1)
- [ ] No memory leaks (DevTools profiler)

### 6.4 E2E Test Specification

**File:** `e2e/student-aria.spec.ts`

**Test: "Student can ask ARIA a question and receive streaming response"**

```typescript
test('Student asks ARIA a question and receives streaming answer', async ({ page }) => {
  // Use authenticated student state
  await page.goto('/dashboard/student');
  
  // Verify dashboard loaded
  await expect(page).toHaveURL(/\/dashboard\/student/);
  await expect(page.getByText(/Bonjour/i)).toBeVisible();
  
  // Verify credit balance visible
  await expect(page.getByText(/crédits?/i)).toBeVisible();
  
  // Select subject
  await page.getByLabel(/matière/i).click();
  await page.getByRole('option', { name: /mathématiques/i }).click();
  
  // Type question
  const input = page.getByPlaceholder(/votre question/i);
  await input.fill('Comment résoudre une équation du second degré ?');
  
  // Send message
  await page.getByRole('button', { name: /envoyer/i }).click();
  
  // Verify loading indicator
  await expect(page.getByTestId('aria-loading')).toBeVisible();
  
  // Wait for first token (streaming started)
  await expect(page.getByTestId('aria-response')).toBeVisible({ timeout: 5000 });
  
  // Wait for complete response
  await expect(page.getByText(/équation/i)).toBeVisible({ timeout: 15000 });
  
  // Verify feedback buttons visible
  await expect(page.getByRole('button', { name: /👍/i })).toBeVisible();
  
  // Click thumbs up
  await page.getByRole('button', { name: /👍/i }).click();
  
  // Verify feedback registered (button highlighted)
  await expect(page.getByRole('button', { name: /👍/i })).toHaveClass(/text-green/);
  
  // Reload page
  await page.reload();
  
  // Verify conversation persisted
  await expect(page.getByText(/Comment résoudre/i)).toBeVisible();
  await expect(page.getByText(/équation/i)).toBeVisible();
});
```

### 6.5 Performance Benchmarks

**Target Metrics:**
- Time to First Byte (TTFB): < 200ms
- First Contentful Paint (FCP): < 1.5s
- Largest Contentful Paint (LCP): < 2.5s
- Cumulative Layout Shift (CLS): < 0.1
- First Input Delay (FID): < 100ms
- ARIA first token: < 1s
- ARIA complete response: < 10s (avg)

**Measurement:**
```bash
# Lighthouse CI
npx lighthouse http://localhost:3000/dashboard/student --view

# Web Vitals (in browser console)
web-vitals.js metrics
```

---

## 7. Dependencies & Constraints

### 7.1 Technical Dependencies

**Required:**
- ✅ OpenAI API key configured (`OPENAI_API_KEY`)
- ✅ Database seeded with test student
- ✅ Active student subscription with ARIA access
- ✅ ARIA subjects and pedagogical content in DB

**Optional:**
- Redis for rate limiting (existing middleware)
- CDN for static assets (production)

### 7.2 Development Constraints

**Must Follow:**
- ✅ Existing design system (Design System v2.0)
- ✅ shadcn/ui component pattern
- ✅ Next.js App Router conventions
- ✅ TypeScript strict mode
- ✅ ESLint + Prettier rules
- ✅ Prisma schema (no breaking changes)

**Must NOT:**
- ❌ Introduce new UI frameworks
- ❌ Break existing `/dashboard/eleve` route
- ❌ Modify database schema
- ❌ Change authentication flow
- ❌ Remove existing features

### 7.3 Security Constraints

**Required:**
- ✅ Role-based access control (ELEVE only)
- ✅ CSRF protection on API endpoints
- ✅ Rate limiting on ARIA API (existing)
- ✅ Input validation with Zod
- ✅ No credentials in client-side code
- ✅ `.auth/student.json` gitignored

---

## 8. Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| OpenAI streaming API errors | High | Low | Implement fallback to non-streaming; add retry logic |
| Performance issues with streaming | Medium | Medium | Add request timeout; implement backpressure handling |
| E2E test flakiness with streaming | Medium | High | Use deterministic waits; add explicit stream completion checks |
| Route conflict with existing dashboard | High | Low | Use route groups; test both routes independently |
| Calendar rendering performance | Low | Low | Memoize date calculations; limit visible date range |
| Database query N+1 problems | Medium | Low | Use Prisma `include` efficiently; add query logging in dev |

---

## 9. Rollout Strategy

### 9.1 Development Workflow

```
1. Feature branch: feature/student-dashboard-aria
2. Development on local environment
3. Unit/integration tests pass
4. E2E tests pass locally
5. Code review + approval
6. Merge to main
7. Deploy to staging
8. QA validation on staging
9. Deploy to production
```

### 9.2 Feature Flag (Optional)

```typescript
// lib/feature-flags.ts
export const FEATURES = {
  NEW_STUDENT_DASHBOARD: process.env.NEXT_PUBLIC_ENABLE_NEW_DASHBOARD === 'true'
};

// Conditional redirect in middleware.ts
if (FEATURES.NEW_STUDENT_DASHBOARD && url.pathname === '/dashboard/eleve') {
  return NextResponse.redirect(new URL('/dashboard/student', request.url));
}
```

### 9.3 Monitoring

**Metrics to track:**
- Dashboard page load time
- ARIA API response time
- ARIA streaming success rate
- User engagement (messages per session)
- Error rate by endpoint
- Badge award frequency

**Tools:**
- Vercel Analytics (if deployed on Vercel)
- Custom logging with Pino (existing)
- Sentry for error tracking (if available)

---

## 10. Success Criteria

### 10.1 Functional Requirements

- ✅ Dashboard accessible at `/dashboard/student` for ELEVE role
- ✅ Credit balance displayed with transaction history
- ✅ Next session card shows upcoming session details
- ✅ Badge widget displays earned badges
- ✅ ARIA chat embedded in dashboard
- ✅ ARIA responses stream in real-time
- ✅ Subject selector filters ARIA responses
- ✅ Feedback system (👍/👎) works
- ✅ Conversations persist to database
- ✅ Calendar displays sessions with highlights
- ✅ Session booking integrated
- ✅ E2E test passes

### 10.2 Non-Functional Requirements

- ✅ Dashboard loads in < 2s on 4G
- ✅ ARIA streaming starts in < 1s
- ✅ Zero TypeScript errors
- ✅ Zero ESLint errors
- ✅ WCAG 2.1 AA compliant
- ✅ Mobile responsive (375px+)
- ✅ Works in Chrome, Firefox, Safari (latest 2 versions)

### 10.3 Code Quality

- ✅ All functions have JSDoc comments
- ✅ Components use TypeScript interfaces
- ✅ No `any` types (except unavoidable external libs)
- ✅ Test coverage > 80% for new code
- ✅ No duplicate code (DRY principle)
- ✅ Follows existing code conventions

---

## 11. Post-Implementation

### 11.1 Documentation Updates

**Files to update:**
- `README.md` - Add new route documentation
- `docs/API_CONVENTIONS.md` - Document streaming endpoint
- `ARCHITECTURE_TECHNIQUE.md` - Update with new components

### 11.2 Knowledge Transfer

**Team Briefing:**
- Demo new dashboard to stakeholders
- Walk through streaming implementation
- Explain E2E test setup
- Share performance metrics

### 11.3 Future Enhancements

**Out of scope (potential future work):**
- Real-time badge notifications
- Conversation search functionality
- Export conversation history (PDF/Markdown)
- Mobile app integration
- Multi-language support for ARIA
- Voice input for ARIA questions

---

## Appendix A: Key Files Reference

**Routes:**
- `/app/(dashboard)/student/page.tsx` - NEW: Main dashboard
- `/app/dashboard/eleve/page.tsx` - EXISTING: Legacy dashboard
- `/app/api/aria/chat/route.ts` - MODIFIED: Streaming support
- `/app/api/student/dashboard/route.ts` - EXISTING: No changes

**Components:**
- `components/ui/aria-embedded-chat.tsx` - NEW: Embedded ARIA
- `components/ui/session-calendar.tsx` - NEW: Calendar widget
- `components/ui/aria-chat.tsx` - EXISTING: Floating widget
- `components/ui/session-booking.tsx` - EXISTING: Reuse
- `components/ui/badge-widget.tsx` - EXISTING: Reuse

**Libraries:**
- `lib/aria.ts` - MODIFIED: Add streaming
- `lib/aria-streaming.ts` - NEW: Streaming utilities

**Tests:**
- `e2e/student-aria.spec.ts` - NEW: E2E test
- `e2e/.auth/student.json` - NEW: Auth state

**Config:**
- `playwright.config.ts` - EXISTING: No changes
- `tailwind.config.mjs` - EXISTING: No changes
- `prisma/schema.prisma` - EXISTING: No changes

---

**Document Status:** Ready for Implementation  
**Next Action:** Create detailed implementation plan (Planning step)
