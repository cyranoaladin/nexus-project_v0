# Technical Specification
**Feature**: Interface Coach et Flux de Reporting  
**Date**: 2026-02-02  
**Status**: Technical Specification Phase

---

## 1. Technical Context

### 1.1 Technology Stack
- **Framework**: Next.js 15.5.11 with App Router (RSC)
- **Language**: TypeScript 5
- **Database**: PostgreSQL with Prisma ORM 6.13.0
- **Authentication**: NextAuth 4.24.11
- **UI Framework**: React 18.3.1
- **UI Components**: Radix UI primitives with Tailwind CSS 4.1.18
- **Email Service**: Nodemailer 7.0.13
- **Validation**: Zod 3.23.8
- **Animation**: Framer Motion 11.0.0

### 1.2 Key Dependencies
```json
{
  "react-hook-form": "^7.62.0",
  "date-fns": "^4.1.0",
  "sonner": "^2.0.7",
  "lucide-react": "^0.536.0"
}
```

### 1.3 Development Commands
- **Build**: `npm run build`
- **Type Check**: `npm run typecheck`
- **Lint**: `npm run lint`
- **Test**: `npm run test`
- **Unit Tests**: `npm run test:unit`
- **Integration Tests**: `npm run test:integration`

---

## 2. Architecture Overview

### 2.1 Existing Architecture
The application follows Next.js App Router conventions with a clear separation:
- **Frontend**: `/app/dashboard/coach/page.tsx` - Client component with tabs
- **Backend**: `/app/api/coach/**` - API routes for coach operations
- **Components**: `/components/ui/**` - Reusable UI components
- **Services**: `/lib/**` - Business logic and utilities

### 2.2 Data Flow
```
[Coach Dashboard] 
    ↓
[Session Report Form Component]
    ↓
[API: POST /api/coach/sessions/[sessionId]/report]
    ↓
[Prisma Transaction]
    ├── Create/Update StudentReport
    ├── Update SessionBooking.status → COMPLETED
    ├── Update SessionBooking.completedAt
    ├── Create SessionNotification
    └── Send Email (async)
    ↓
[Parent Notification]
```

---

## 3. Implementation Approach

### 3.1 Component Architecture

#### 3.1.1 Session Report Dialog Component
**Location**: `/components/ui/session-report-dialog.tsx`

**Purpose**: Modal dialog wrapper for session report form

**Props**:
```typescript
interface SessionReportDialogProps {
  sessionId?: string;
  onReportSubmitted?: () => void;
  trigger?: React.ReactNode;
}
```

**Features**:
- Opens in Dialog (Radix UI)
- Can be triggered from coach dashboard
- Handles success/error states
- Refreshes dashboard on submission

#### 3.1.2 Session Report Form Component
**Location**: `/components/ui/session-report-form.tsx`

**Purpose**: Form for submitting session reports

**Form Schema (Zod)**:
```typescript
const sessionReportSchema = z.object({
  sessionId: z.string().cuid(),
  summary: z.string().min(20, "Le résumé doit contenir au moins 20 caractères"),
  topicsCovered: z.string().min(10, "Veuillez décrire les sujets abordés"),
  performanceRating: z.number().min(1).max(5),
  progressNotes: z.string().min(10, "Veuillez ajouter des notes de progression"),
  recommendations: z.string().min(10, "Veuillez ajouter des recommandations"),
  attendance: z.boolean(),
  engagementLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  homeworkAssigned: z.string().optional(),
  nextSessionFocus: z.string().optional(),
});
```

**State Management**:
- React Hook Form for form state
- Auto-save to localStorage (draft)
- Loading state during submission
- Error handling with toast notifications (Sonner)

**UI Components Used**:
- `Form` (react-hook-form + Radix)
- `Select` for session selection
- `Textarea` for text fields
- `RadioGroup` for performance rating (1-5 stars)
- `Switch` for attendance
- `Button` for submit/cancel

### 3.2 API Architecture

#### 3.2.1 Report Submission Endpoint
**Location**: `/app/api/coach/sessions/[sessionId]/report/route.ts`

**Method**: `POST`

**Request Schema**:
```typescript
const reportSubmissionSchema = z.object({
  summary: z.string().min(20),
  topicsCovered: z.string().min(10),
  performanceRating: z.number().min(1).max(5),
  progressNotes: z.string().min(10),
  recommendations: z.string().min(10),
  attendance: z.boolean(),
  engagementLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  homeworkAssigned: z.string().optional(),
  nextSessionFocus: z.string().optional(),
});
```

**Response Schema**:
```typescript
// Success
{
  success: true,
  reportId: string,
  sessionId: string,
  message: string
}

// Error
{
  success: false,
  error: string
}
```

**Authentication & Authorization**:
- Require NextAuth session with role `COACH`
- Verify coach owns the session via `coachId` match
- Return 401 if not authenticated
- Return 403 if not authorized

**Business Logic Flow**:
```typescript
1. Extract sessionId from URL params
2. Validate request body with Zod
3. Get authenticated coach from session
4. Verify coach owns session
5. Check session status (must be CONFIRMED or IN_PROGRESS)
6. Start Prisma transaction
   a. Upsert StudentReport (update if exists, create if not)
   b. Update SessionBooking:
      - status: COMPLETED
      - completedAt: new Date()
      - coachNotes: summary
      - studentAttended: attendance
      - rating: performanceRating
   c. Get parent user from session
   d. Create SessionNotification for parent
   e. Queue email notification (non-blocking)
7. Commit transaction
8. Return success response
```

**Error Handling**:
```typescript
- Invalid sessionId → 400
- Validation errors → 400
- Session not found → 404
- Coach doesn't own session → 403
- Session already completed → 409
- Database errors → 500
```

#### 3.2.2 Report Retrieval Endpoint
**Location**: `/app/api/coach/sessions/[sessionId]/report/route.ts`

**Method**: `GET`

**Purpose**: Check if report exists and retrieve it

**Response**:
```typescript
{
  success: true,
  report: StudentReport | null
}
```

#### 3.2.3 Coach Sessions List Endpoint
**Enhancement**: Add report status to existing `/api/coach/dashboard` endpoint

**Changes**:
- Include `hasReport` boolean in session objects
- Include `reportId` if report exists

### 3.3 Email Service Enhancement

#### 3.3.1 New Email Template
**Location**: `/lib/email-service.ts`

**Template Name**: `SESSION_REPORT_NOTIFICATION`

**Template Structure**:
```typescript
SESSION_REPORT_NOTIFICATION: {
  subject: '📝 Nouveau compte-rendu de session - {studentName} - {subject}',
  html: (session, student, coach, report, dashboardUrl) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
        <h1>📝 Compte-rendu de session disponible</h1>
      </div>
      <div style="padding: 30px;">
        <p>Bonjour,</p>
        
        <p><strong>{coach.pseudonym}</strong> a complété le compte-rendu de la session de <strong>{session.subject}</strong>.</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>📋 Détails de la session :</h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>👨‍🎓 Élève :</strong> {student.firstName} {student.lastName}</li>
            <li><strong>📚 Matière :</strong> {session.subject}</li>
            <li><strong>📅 Date :</strong> {scheduledDate}</li>
            <li><strong>⏱️ Durée :</strong> {session.duration} minutes</li>
            <li><strong>⭐ Performance :</strong> {report.performanceRating}/5</li>
          </ul>
        </div>
        
        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>📊 Résumé :</h3>
          <p>{report.summary}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="{dashboardUrl}/parent/rapports/{reportId}"
             style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px;">
            📖 Voir le compte-rendu complet
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          Vous recevrez un compte-rendu après chaque session pour suivre les progrès de votre enfant.
        </p>
      </div>
    </div>
  `
}
```

#### 3.3.2 Send Function
**Function Name**: `sendSessionReportNotification`

**Signature**:
```typescript
export async function sendSessionReportNotification(
  session: SessionWithDetails,
  student: StudentInfo,
  coach: CoachInfo,
  report: ReportSummary,
  parentEmail: string
): Promise<void>
```

**Error Handling**:
- Log errors but don't throw (email failures shouldn't block report submission)
- Create notification in database even if email fails

---

## 4. Data Model Changes

### 4.1 Existing Models (No Changes Required)

#### SessionBooking Model
```prisma
model SessionBooking {
  id            String           @id @default(cuid())
  studentId     String
  coachId       String
  subject       Subject
  title         String
  scheduledDate DateTime
  startTime     String
  endTime       String
  duration      Int
  status        SessionStatus    @default(SCHEDULED)
  creditsUsed   Int              @default(1)
  coachNotes    String?          // Will store report summary
  studentNotes  String?
  rating        Int?             // 1-5 stars (performance rating)
  studentAttended Boolean?       // Attendance tracking
  completedAt   DateTime?        // Timestamp when marked complete
  // ... other fields
}
```

#### StudentReport Model
**Note**: Currently designed for periodic reports. Will be repurposed for session reports.

**Proposed Fields Mapping**:
- `title` → "{Subject} - {Date}"
- `content` → JSON string containing all report fields
- `period` → "Session du {date}"
- `sessionsCount` → 1
- `progressNotes` → progressNotes field
- `recommendations` → recommendations field

**Alternative**: Add new fields to StudentReport or create SessionReport model

### 4.2 Recommended Schema Enhancement

#### Option A: Extend StudentReport (Minimal Changes)
```prisma
model StudentReport {
  id        String @id @default(cuid())
  studentId String
  coachId   String?
  
  // Session link
  sessionId String? // NEW FIELD
  session   SessionBooking? @relation(fields: [sessionId], references: [id])
  
  // Existing fields (repurposed)
  title       String  // "Session subject - date"
  content     String  // JSON with detailed report data
  period      String  // "Session du {date}"
  
  // Report-specific fields
  sessionsCount    Int     @default(1)
  averageGrade     Float?  // Maps to performanceRating
  progressNotes    String?
  recommendations  String?
  
  createdAt DateTime @default(now())
  
  @@map("student_reports")
}
```

#### Option B: Create New SessionReport Model (Recommended)
```prisma
model SessionReport {
  id        String @id @default(cuid())
  sessionId String @unique
  session   SessionBooking @relation(fields: [sessionId], references: [id])
  
  studentId String
  student   Student @relation(fields: [studentId], references: [id])
  
  coachId   String?
  coach     CoachProfile? @relation(fields: [coachId], references: [id])
  
  // Report Content
  summary              String
  topicsCovered        String
  performanceRating    Int    // 1-5
  progressNotes        String
  recommendations      String
  attendance           Boolean
  engagementLevel      String? // LOW, MEDIUM, HIGH
  homeworkAssigned     String?
  nextSessionFocus     String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([studentId, createdAt])
  @@index([coachId, createdAt])
  @@map("session_reports")
}
```

**Recommendation**: Use Option B (new SessionReport model) for:
- Better separation of concerns
- Type safety
- Easier queries
- Future extensibility

### 4.3 SessionNotification Enhancement

**Existing Enum**:
```prisma
enum NotificationType {
  SESSION_BOOKED
  SESSION_CONFIRMED
  SESSION_REMINDER
  SESSION_CANCELLED
  SESSION_RESCHEDULED
  SESSION_COMPLETED  // Already exists!
  COACH_ASSIGNED
  PAYMENT_REQUIRED
}
```

**Usage**: Create notification with type `SESSION_COMPLETED`

---

## 5. Integration Points

### 5.1 Coach Dashboard Integration

#### Location: `/app/dashboard/coach/page.tsx`

**Changes Required**:

1. **Add "Submit Report" Button** to session cards in "Planning d'Aujourd'hui" section
```tsx
<div className="flex items-center space-x-2">
  {session.status === 'CONFIRMED' || session.status === 'IN_PROGRESS' ? (
    <SessionReportDialog 
      sessionId={session.id}
      onReportSubmitted={() => fetchDashboardData()}
      trigger={
        <Button size="sm" variant="default">
          <FileText className="w-4 h-4 mr-2" />
          Soumettre rapport
        </Button>
      }
    />
  ) : null}
</div>
```

2. **Add Report Status Indicator** for completed sessions
```tsx
{session.status === 'COMPLETED' && (
  <Badge variant="success">
    <CheckCircle className="w-3 h-3 mr-1" />
    Rapport soumis
  </Badge>
)}
```

3. **Add Recent Reports Section** (optional enhancement)
```tsx
<Card>
  <CardHeader>
    <CardTitle>Rapports récents</CardTitle>
  </CardHeader>
  <CardContent>
    {recentReports.map(report => (
      <div key={report.id}>
        {/* Report summary card */}
      </div>
    ))}
  </CardContent>
</Card>
```

### 5.2 Parent Dashboard Integration (Future)

#### Location: `/app/dashboard/parent/rapports/[reportId]/page.tsx` (New)

**Out of scope for initial implementation** - just create the notification

**Future Implementation**:
- Create report view page
- Display all report fields
- Show session details
- Allow parents to download/print

---

## 6. Source Code Structure

### 6.1 New Files to Create

```
/app/api/coach/sessions/[sessionId]/report/
  └── route.ts                          # API endpoint for report submission

/components/ui/
  ├── session-report-dialog.tsx         # Dialog wrapper component
  └── session-report-form.tsx           # Form component

/lib/
  ├── validations/
  │   └── session-report.ts             # Zod schemas
  └── email-service.ts                  # (Modified) Add new template
```

### 6.2 Files to Modify

```
/app/dashboard/coach/page.tsx           # Add report dialog trigger
/lib/email-service.ts                   # Add SESSION_REPORT_NOTIFICATION template
/prisma/schema.prisma                   # Add SessionReport model (recommended)
```

### 6.3 Migration Files

```
/prisma/migrations/
  └── [timestamp]_add_session_reports/
      └── migration.sql                 # Create SessionReport table
```

---

## 7. Implementation Phases

### Phase 1: Database Schema & Models (Priority: HIGH)
**Tasks**:
- [ ] Create SessionReport model in Prisma schema
- [ ] Generate and run migration
- [ ] Update Prisma client
- [ ] Test database connection

**Acceptance Criteria**:
- Migration runs successfully
- SessionReport model accessible via Prisma client
- No breaking changes to existing models

**Estimated Time**: 1-2 hours

---

### Phase 2: API Endpoint Development (Priority: HIGH)
**Tasks**:
- [ ] Create Zod validation schemas
- [ ] Implement POST `/api/coach/sessions/[sessionId]/report` endpoint
- [ ] Implement GET `/api/coach/sessions/[sessionId]/report` endpoint
- [ ] Add authentication/authorization checks
- [ ] Implement Prisma transaction logic
- [ ] Add error handling and logging
- [ ] Write unit tests for API logic

**Acceptance Criteria**:
- API returns 200 for valid requests
- Returns appropriate error codes (400, 401, 403, 404, 409, 500)
- Report is created in database
- Session status updates to COMPLETED
- Notification is created
- Transaction rollback works on errors

**Test Cases**:
```typescript
describe('POST /api/coach/sessions/[sessionId]/report', () => {
  it('should create report and update session', async () => {})
  it('should return 403 if coach doesnt own session', async () => {})
  it('should return 409 if session already completed', async () => {})
  it('should return 400 for invalid data', async () => {})
  it('should rollback on email failure', async () => {}) // Should NOT rollback
  it('should create notification even if email fails', async () => {})
})
```

**Estimated Time**: 4-6 hours

---

### Phase 3: Form Component Development (Priority: HIGH)
**Tasks**:
- [ ] Create session-report-form.tsx component
- [ ] Integrate React Hook Form
- [ ] Add form validation with Zod
- [ ] Implement auto-save to localStorage
- [ ] Add loading states
- [ ] Add error handling with toast notifications
- [ ] Style with Tailwind CSS
- [ ] Add accessibility features (ARIA labels, keyboard nav)
- [ ] Test form validation
- [ ] Test form submission

**Acceptance Criteria**:
- Form validates all required fields
- Displays validation errors inline
- Auto-saves draft to localStorage
- Shows loading state during submission
- Displays success message on completion
- Displays error message on failure
- Accessible via keyboard
- Mobile responsive

**Estimated Time**: 4-6 hours

---

### Phase 4: Dialog Component & Integration (Priority: MEDIUM)
**Tasks**:
- [ ] Create session-report-dialog.tsx wrapper
- [ ] Integrate with Radix Dialog
- [ ] Add trigger button customization
- [ ] Handle dialog open/close state
- [ ] Integrate form component
- [ ] Add success callback
- [ ] Update coach dashboard page
- [ ] Add "Submit Report" buttons to session cards
- [ ] Add report status indicators
- [ ] Test dialog interactions

**Acceptance Criteria**:
- Dialog opens on button click
- Dialog closes on successful submission
- Dialog closes on cancel
- Dashboard refreshes after submission
- Status indicators show correctly

**Estimated Time**: 3-4 hours

---

### Phase 5: Email Service Enhancement (Priority: MEDIUM)
**Tasks**:
- [ ] Add SESSION_REPORT_NOTIFICATION template to email-service.ts
- [ ] Implement sendSessionReportNotification function
- [ ] Add email types and interfaces
- [ ] Test email template rendering
- [ ] Test email sending (use admin/test-email endpoint)
- [ ] Add error logging
- [ ] Ensure non-blocking behavior

**Acceptance Criteria**:
- Email template renders correctly
- Email is sent to parent
- Email failure doesn't block report submission
- Notification is created even if email fails
- Error is logged for failed emails

**Estimated Time**: 2-3 hours

---

### Phase 6: Testing & Refinement (Priority: HIGH)
**Tasks**:
- [ ] Write integration tests
- [ ] Test complete flow (form → API → database → email)
- [ ] Test edge cases (session already completed, invalid coach, etc.)
- [ ] Test error scenarios
- [ ] Test UI/UX on different screen sizes
- [ ] Test accessibility
- [ ] Perform manual QA testing
- [ ] Fix bugs found during testing

**Acceptance Criteria**:
- All unit tests pass
- All integration tests pass
- No console errors
- UI works on mobile/tablet/desktop
- Accessible to screen readers
- No performance issues

**Test Scenarios**:
1. Happy path: Coach submits report → Session marked complete → Parent receives email
2. Report already exists: Show existing report, allow view but not edit
3. Invalid session: Show error message
4. Network error during submission: Show error, preserve draft
5. Email service down: Report still created, notification created, error logged

**Estimated Time**: 4-5 hours

---

### Phase 7: Performance Optimization (Priority: LOW)
**Tasks**:
- [ ] Add database indexes if needed
- [ ] Optimize Prisma queries (use `select` to limit fields)
- [ ] Add request caching where appropriate
- [ ] Monitor API response times
- [ ] Optimize email template rendering

**Acceptance Criteria**:
- API response time < 2 seconds (excluding email)
- Database queries use indexes
- No N+1 query issues

**Estimated Time**: 1-2 hours

---

## 8. Verification Approach

### 8.1 Unit Testing
**Framework**: Jest with React Testing Library

**Test Files**:
```
/__tests__/
  ├── api/
  │   └── coach-session-report.test.ts
  ├── components/
  │   ├── session-report-form.test.tsx
  │   └── session-report-dialog.test.tsx
  └── lib/
      └── validations/session-report.test.ts
```

**Coverage Target**: > 80%

### 8.2 Integration Testing
**Test Complete Workflow**:
1. Login as coach
2. Navigate to dashboard
3. Click "Submit Report" on a session
4. Fill form
5. Submit
6. Verify database updates
7. Verify notification created
8. Verify email sent (mock email service)

### 8.3 Manual Testing Checklist

**Form Validation**:
- [ ] Required fields show error when empty
- [ ] Character count validation works
- [ ] Rating must be 1-5
- [ ] Attendance checkbox works
- [ ] Optional fields are optional

**API Behavior**:
- [ ] Authenticated requests succeed
- [ ] Unauthenticated requests fail (401)
- [ ] Unauthorized requests fail (403)
- [ ] Invalid data returns 400
- [ ] Session already completed returns 409
- [ ] Valid requests return 200

**UI/UX**:
- [ ] Dialog opens smoothly
- [ ] Form fields are responsive
- [ ] Loading states show during submission
- [ ] Success message appears after submission
- [ ] Error messages are clear
- [ ] Dialog closes after success
- [ ] Dashboard refreshes showing updated status

**Email Notifications**:
- [ ] Email is sent to parent
- [ ] Email contains correct information
- [ ] Email template renders properly
- [ ] Links in email work correctly

**Data Integrity**:
- [ ] Report is created with all fields
- [ ] Session status is updated to COMPLETED
- [ ] Session completedAt timestamp is set
- [ ] Notification is created
- [ ] Transaction rollback works on error

### 8.4 Verification Commands

**Before Committing**:
```bash
npm run lint        # Check code quality
npm run typecheck   # Verify TypeScript types
npm run test:unit   # Run unit tests
npm run test:integration # Run integration tests
```

**Before Deployment**:
```bash
npm run build       # Ensure build succeeds
npm run test        # Run all tests
```

---

## 9. Non-Functional Requirements

### 9.1 Performance
- API response time: < 2 seconds (excluding email sending)
- Email sending: Asynchronous (non-blocking)
- Form auto-save: Debounced (500ms)
- Database queries: Use indexes, avoid N+1

### 9.2 Security
- Authentication: NextAuth session required
- Authorization: Verify coach owns session
- Input validation: Zod schemas on frontend and backend
- SQL injection: Prevented by Prisma
- XSS: Sanitize all inputs (React handles by default)

### 9.3 Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation support
- Screen reader friendly
- Color contrast ratios meet WCAG AA
- Focus indicators visible

### 9.4 Scalability
- Database indexes for performance
- Email service can handle bulk notifications
- API can handle concurrent requests
- Transaction-based updates prevent race conditions

### 9.5 Monitoring & Logging
- Log all report submissions
- Log email delivery success/failure
- Track API errors with error codes
- Monitor notification delivery rates

---

## 10. Risk Analysis & Mitigation

### Risk 1: Email Service Failure
**Impact**: High (parents won't be notified)  
**Likelihood**: Medium  
**Mitigation**:
- Create in-app notification even if email fails
- Log email failures for monitoring
- Implement retry mechanism for failed emails
- Don't block report submission on email failure

### Risk 2: Database Transaction Failure
**Impact**: High (data inconsistency)  
**Likelihood**: Low  
**Mitigation**:
- Use Prisma transactions for atomic updates
- Implement proper error handling
- Test rollback scenarios
- Monitor database errors

### Risk 3: Performance Degradation
**Impact**: Medium (slow user experience)  
**Likelihood**: Low  
**Mitigation**:
- Add database indexes
- Optimize queries
- Use async email sending
- Monitor API response times

### Risk 4: Validation Bypass
**Impact**: Medium (invalid data in database)  
**Likelihood**: Low  
**Mitigation**:
- Validate on both frontend and backend
- Use TypeScript for type safety
- Write comprehensive tests
- Use Zod for schema validation

---

## 11. Open Questions & Decisions

### Decision 1: StudentReport vs SessionReport Model
**Options**:
- A) Reuse StudentReport model
- B) Create new SessionReport model

**Recommendation**: Option B (SessionReport)  
**Rationale**: 
- Better separation of concerns
- Clearer data model
- Type safety
- Easier to query
- Future extensibility

**Decision**: TBD (to be confirmed during implementation)

---

### Decision 2: Allow Report Editing?
**Options**:
- A) Reports are immutable after submission
- B) Allow coaches to edit within 24 hours
- C) Allow unlimited editing

**Recommendation**: Option A (immutable)  
**Rationale**:
- Data integrity
- Audit trail
- Prevents manipulation
- Simpler implementation

**Decision**: Immutable (as per requirements)

---

### Decision 3: Email Sending Strategy
**Options**:
- A) Synchronous (wait for email to send)
- B) Fire-and-forget (don't wait)
- C) Queue-based (background job)

**Recommendation**: Option B (fire-and-forget)  
**Rationale**:
- Non-blocking user experience
- Email failures don't block submission
- Simple implementation
- Sufficient for current scale

**Future Enhancement**: Option C for higher scale

---

## 12. Future Enhancements (Out of Scope)

The following features are **not** included in this specification but may be considered for future iterations:

1. **Report Templates**: Pre-filled content based on session type
2. **Rich Text Editor**: WYSIWYG editor for report content
3. **File Attachments**: Upload photos/documents to reports
4. **Report Analytics**: Trends, statistics, visualizations
5. **AI-Assisted Reporting**: Auto-generated summaries
6. **Student View**: Allow students to view their reports
7. **Report Comparison**: Compare reports over time
8. **PDF Export**: Generate PDF version of reports
9. **Parent Feedback**: Allow parents to respond to reports
10. **Bulk Report Submission**: Submit multiple reports at once

---

## 13. Dependencies & Prerequisites

### 13.1 External Dependencies
- SMTP server configured (env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD)
- Database accessible (env: DATABASE_URL)
- NextAuth configured (env: NEXTAUTH_URL, NEXTAUTH_SECRET)

### 13.2 Internal Dependencies
- CoachAvailability component (✅ already exists)
- Email service infrastructure (✅ already exists)
- Notification system (✅ already exists)
- Authentication system (✅ already exists)

### 13.3 Development Environment
```bash
# Required environment variables
DATABASE_URL=postgresql://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=noreply@nexus-reussite.com
```

---

## 14. Rollout Strategy

### Phase 1: Development
- Implement all features
- Write tests
- Code review

### Phase 2: Staging
- Deploy to staging environment
- Manual QA testing
- Fix bugs

### Phase 3: Beta Testing (Optional)
- Select 2-3 coaches for beta
- Gather feedback
- Iterate

### Phase 4: Production Deployment
- Deploy to production
- Monitor errors
- Gather user feedback

### Phase 5: Iteration
- Address issues
- Implement improvements
- Plan future enhancements

---

## 15. Success Criteria

The feature will be considered successfully implemented when:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Code review approved
- [ ] Lint and typecheck pass with no errors
- [ ] Build succeeds with no errors
- [ ] Coach can submit session reports via dashboard
- [ ] Reports are saved to database
- [ ] Session status updates to COMPLETED
- [ ] Parent receives email notification
- [ ] Parent receives in-app notification
- [ ] UI is responsive and accessible
- [ ] Performance meets requirements (< 2s response time)
- [ ] No console errors in production
- [ ] Documentation is complete

---

**End of Technical Specification**
