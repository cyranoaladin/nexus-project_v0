# Product Requirements Document (PRD)
**Feature**: Interface Coach et Flux de Reporting
**Date**: 2026-02-02
**Status**: Requirements Phase

---

## 1. Overview

### 1.1 Feature Description
Develop a comprehensive session management workflow for coaches in the `/app/(dashboard)/coach` directory. This includes:
- Availability management interface (already exists but needs review)
- Session report form (StudentReport) for coaches to submit after sessions
- Notification system to alert parents when a report is validated
- Prisma integration to update session status to 'COMPLETED'

### 1.2 Business Objectives
- Enable coaches to efficiently manage their availability
- Provide structured post-session reporting capability
- Improve parent communication by notifying them of completed sessions
- Maintain data integrity with proper session status updates

### 1.3 Target Users
- **Primary**: Coaches (UserRole.COACH)
- **Secondary**: Parents (receive notifications)
- **Indirect**: Students (session records)

---

## 2. Current Architecture Analysis

### 2.1 Tech Stack
- **Framework**: Next.js 15.5.11, React 18.3.1
- **Database**: PostgreSQL with Prisma ORM 6.13.0
- **Authentication**: NextAuth 4.24.11
- **UI Components**: Radix UI, Tailwind CSS 4.1.18
- **Email**: Nodemailer 7.0.13
- **Validation**: Zod 3.23.8
- **Type Safety**: TypeScript 5

### 2.2 Existing Data Models
**Relevant Prisma Models**:
- `SessionBooking`: Main session entity with status tracking
- `CoachAvailability`: Coach availability management (recurring and specific dates)
- `SessionNotification`: Notification system for session events
- `StudentReport`: Report model with coach and student relations
- `CoachProfile`: Coach information including pseudonym, subjects, etc.
- `User`: Authentication and role management
- `Student`: Student entity with credit tracking

**Session Status Enum**:
```prisma
enum SessionStatus {
  SCHEDULED
  CONFIRMED
  IN_PROGRESS
  COMPLETED      // Target status after report submission
  CANCELLED
  NO_SHOW
  RESCHEDULED
}
```

### 2.3 Existing Components
- **CoachAvailability** (`/components/ui/coach-availability.tsx`): Full-featured availability management component (already exists)
- **Session Management** (`/components/ui/session-management.tsx`): Session listing and management
- **Email Service** (`/lib/email-service.ts`): Existing email templates and sending functions

### 2.4 Existing APIs
- `GET /api/coach/dashboard`: Fetches coach dashboard data including sessions, students, stats
- `POST /api/coaches/availability`: Manages coach availability (weekly and specific dates)
- `GET /api/coaches/availability`: Retrieves coach availability
- `GET /api/notifications`: Fetches user notifications
- `PATCH /api/notifications`: Marks notifications as read

---

## 3. Functional Requirements

### 3.1 Availability Management Interface
**Status**: ✅ Already exists in `/components/ui/coach-availability.tsx`

**Requirements**:
- [x] Display weekly recurring availability (already implemented)
- [x] Support specific date availability (already implemented)
- [x] Time slot management with add/remove functionality (already implemented)
- [x] Save to CoachAvailability model via API (already implemented)

**Action**: Verify component is properly integrated in coach dashboard

### 3.2 Session Report Form (StudentReport)

**Component Location**: `/components/ui/session-report-form.tsx` (to be created)

**Form Fields**:
1. **Session Selection** (required)
   - Dropdown or autocomplete to select from coach's CONFIRMED/IN_PROGRESS sessions
   - Display: Student name, subject, date/time
   - Filter: Only show sessions not yet completed

2. **Report Content** (required)
   - **Session Summary**: Textarea for general session overview
   - **Topics Covered**: Textarea for subjects/topics addressed
   - **Student Performance**: Rating (1-5 stars) or structured feedback
   - **Progress Notes**: Textarea for progress observations
   - **Recommendations**: Textarea for next steps/homework

3. **Session Metrics** (optional but recommended)
   - **Attendance**: Checkbox - Student attended
   - **Engagement Level**: Select (Low/Medium/High)
   - **Homework Assigned**: Textarea
   - **Next Session Focus**: Textarea

**Validation**:
- All required fields must be filled
- Session ID must exist and belong to coach
- Session must not already be COMPLETED
- Coach must be authenticated and authorized

**Behavior**:
- Auto-save draft functionality (localStorage)
- Confirmation dialog before submission
- Success message with option to submit another report
- Error handling with clear user feedback

### 3.3 Report Submission Workflow

**Backend API**: `POST /api/coach/sessions/[sessionId]/report` (to be created)

**Request Body**:
```typescript
{
  sessionId: string;
  reportData: {
    summary: string;
    topicsCovered: string;
    performanceRating: number;  // 1-5
    progressNotes: string;
    recommendations: string;
    attendance: boolean;
    engagementLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    homeworkAssigned?: string;
    nextSessionFocus?: string;
  }
}
```

**Transaction Steps** (atomic operation):
1. Validate session ownership (coachId matches authenticated user)
2. Validate session status (must be IN_PROGRESS or CONFIRMED)
3. Create/Update StudentReport record
4. Update SessionBooking.status to COMPLETED
5. Update SessionBooking.completedAt timestamp
6. Create SessionNotification for parent
7. Send email notification to parent
8. Return success response

**Error Handling**:
- 401: Unauthorized (not logged in)
- 403: Forbidden (session doesn't belong to coach)
- 404: Session not found
- 400: Invalid data / Session already completed
- 500: Internal server error (rollback transaction)

### 3.4 Parent Notification System

**Notification Creation**:
- **Type**: SESSION_COMPLETED
- **Recipients**: Parent of student (if parentId exists on SessionBooking)
- **Title**: "Compte-rendu de session disponible"
- **Message**: "{Coach pseudonym} a complété le compte-rendu de la session de {subject} du {date}"
- **Method**: EMAIL + IN_APP
- **Data**: JSON with sessionId, reportId, studentId

**Email Template** (to be added to email-service.ts):
```typescript
SESSION_REPORT_NOTIFICATION: {
  subject: '📝 Nouveau compte-rendu de session',
  html: (session, student, coach, report) => `
    <div>
      <h1>Compte-rendu disponible</h1>
      <p>Bonjour,</p>
      <p>{coach.pseudonym} a complété le compte-rendu de la session de {subject}.</p>
      <div>
        <h3>Détails de la session :</h3>
        <ul>
          <li>Élève : {student.firstName} {student.lastName}</li>
          <li>Matière : {session.subject}</li>
          <li>Date : {session.scheduledDate}</li>
          <li>Durée : {session.duration} minutes</li>
        </ul>
      </div>
      <a href="{dashboardUrl}/parent/rapports/{reportId}">
        Voir le compte-rendu complet
      </a>
    </div>
  `
}
```

---

## 4. Non-Functional Requirements

### 4.1 Performance
- Report submission < 2 seconds (excluding email sending)
- Email notification sent asynchronously (don't block response)
- Form should be responsive and work on mobile devices

### 4.2 Security
- Verify coach ownership of session before allowing report submission
- Sanitize all user inputs
- Use CSRF protection (Next.js built-in)
- Validate all data with Zod schemas

### 4.3 Data Integrity
- Use Prisma transactions for atomic operations
- Ensure session status can only transition to COMPLETED once
- Prevent duplicate report submissions
- Follow existing data invariants (see docs/DATA_INVARIANTS.md)

### 4.4 User Experience
- Clear error messages
- Loading states during submission
- Success confirmation
- Mobile-responsive design
- Accessible (ARIA labels, keyboard navigation)

### 4.5 Code Quality
- Follow existing API conventions (docs/API_CONVENTIONS.md)
- Use existing UI components from /components/ui
- Implement proper TypeScript types
- Write unit and integration tests
- Follow project naming conventions

---

## 5. Integration Points

### 5.1 Coach Dashboard Integration
- Add "Soumettre un compte-rendu" button to session cards
- Show report status indicator on completed sessions
- Display recent reports in dashboard overview

### 5.2 Parent Dashboard Integration
- Show notification badge for new reports
- Create report viewing page: `/app/dashboard/parent/rapports/[reportId]`
- Display report in chronological order

### 5.3 Student Dashboard Integration (Optional)
- Allow students to view their session reports
- Show progress tracking based on reports

---

## 6. User Stories

### US-1: Coach Submits Session Report
**As a** coach  
**I want to** submit a detailed report after completing a session  
**So that** parents are informed about their child's progress

**Acceptance Criteria**:
- Coach can access report form from dashboard
- Coach can select a session from their completed sessions
- Coach can fill in all required fields
- System validates all inputs
- Report is saved to database
- Session status updates to COMPLETED
- Parent receives notification
- Coach sees success confirmation

### US-2: Parent Receives Report Notification
**As a** parent  
**I want to** receive a notification when a session report is available  
**So that** I can stay informed about my child's learning

**Acceptance Criteria**:
- Parent receives in-app notification
- Parent receives email notification
- Notification includes session details
- Notification links to full report view
- Parent can mark notification as read

### US-3: Coach Manages Availability
**As a** coach  
**I want to** set my weekly availability and specific date exceptions  
**So that** students can only book sessions when I'm available

**Acceptance Criteria**:
- Coach can view current availability (✅ exists)
- Coach can set recurring weekly schedule (✅ exists)
- Coach can set specific date availability (✅ exists)
- Changes are saved and reflected in booking system (✅ exists)

---

## 7. Success Metrics

- **Adoption**: 80% of coaches submit reports within 24h of session completion
- **Satisfaction**: Parent satisfaction score > 4.5/5 for report quality
- **Engagement**: 90% of parents view reports within 48h of notification
- **Technical**: Report submission success rate > 99%
- **Performance**: Average report submission time < 2 seconds

---

## 8. Out of Scope

The following are explicitly **not** included in this feature:
- Report editing after submission (coaches cannot edit)
- Report templates or pre-filled content
- Bulk report submission
- Report analytics dashboard
- Student feedback on reports
- Report approval workflow
- Multi-language reports
- PDF export functionality
- Report history comparison

These may be considered for future iterations.

---

## 9. Assumptions and Dependencies

### Assumptions
1. Coaches have stable internet connection for report submission
2. Parents have valid email addresses in system
3. Sessions follow normal workflow: SCHEDULED → CONFIRMED → IN_PROGRESS → COMPLETED
4. Coach profiles are complete with pseudonym and subjects

### Dependencies
1. Existing CoachAvailability component (already available)
2. Email service infrastructure (nodemailer configured)
3. Notification system (models and APIs exist)
4. Authentication system (NextAuth configured)
5. Prisma client and database access

### Known Constraints
1. SMTP configuration must be valid for email notifications
2. Session booking system must be operational
3. Parent records must exist for notification delivery

---

## 10. Questions for Clarification

### Resolved by Default Decisions

1. **Q**: Should reports be editable after submission?  
   **A**: No - reports are immutable once submitted for data integrity

2. **Q**: What happens if parent email fails?  
   **A**: Log error, save in-app notification, report still considered submitted

3. **Q**: Can coaches submit reports for past sessions?  
   **A**: Yes - allow submission for any non-COMPLETED session within last 30 days

4. **Q**: Should we validate report before allowing submission?  
   **A**: Yes - all required fields must be completed, zod validation

5. **Q**: Can a coach submit multiple reports for same session?  
   **A**: No - one report per session. If report exists, show edit/view mode

6. **Q**: Should students see the reports?  
   **A**: Out of scope for v1 - focus on parent notification only

7. **Q**: Report content visibility - public or private?  
   **A**: Private - only coach, parent, and admins can view

8. **Q**: Should we track report view analytics?  
   **A**: Future enhancement - just track notification read status for now

---

## 11. Future Enhancements

Potential improvements for future iterations:
- Report templates based on session type/subject
- Rich text editor for report content
- Photo/file attachments to reports
- Report analytics for coaches (trends, common themes)
- AI-assisted report generation
- Student self-assessment integration
- Report comparison over time
- Gamification (badges for consistent reporting)
- Report export to PDF
- Parent response/feedback mechanism
- Multi-language support

---

## 12. Technical Notes

### Database Migration Considerations
- StudentReport model already exists in schema
- May need to add indexes for performance:
  - `@@index([coachId, createdAt])`
  - `@@index([studentId, createdAt])`
- Consider adding `submittedAt` timestamp field
- Consider adding `reportType` enum field for future categorization

### API Rate Limiting
- Implement rate limiting on report submission endpoint (e.g., max 10 reports per minute)
- Prevent spam/abuse

### Monitoring
- Log all report submissions
- Track email delivery success/failure
- Monitor notification delivery rates
- Alert on high error rates

---

## Appendix A: Component Hierarchy

```
/app/dashboard/coach/page.tsx
├── Header (existing)
├── Tabs: Dashboard | Disponibilités (existing)
│   ├── Dashboard Tab (existing)
│   │   ├── Stats Cards (existing)
│   │   ├── Today's Sessions (existing)
│   │   │   └── [NEW] "Soumettre rapport" button per completed session
│   │   ├── Students List (existing)
│   │   └── [NEW] Recent Reports Section
│   │
│   └── Disponibilités Tab (existing)
│       └── <CoachAvailability /> (existing component)
│
└── [NEW] <SessionReportDialog />
    └── <SessionReportForm />
        ├── Session Selection
        ├── Report Fields
        └── Submit Button
```

---

## Appendix B: API Endpoints

### New Endpoints
1. `POST /api/coach/sessions/[sessionId]/report`
   - Create session report
   - Update session status
   - Trigger notifications

2. `GET /api/coach/sessions/[sessionId]/report`
   - Retrieve existing report
   - Check if report exists

### Existing Endpoints (to be used)
1. `GET /api/coach/dashboard` - fetch coach sessions
2. `POST /api/coaches/availability` - manage availability
3. `GET /api/notifications` - view notifications
4. `PATCH /api/notifications` - mark as read

---

## Appendix C: Email Template Specifications

**From**: "Nexus Réussite" <noreply@nexus-reussite.com>  
**Subject**: 📝 Nouveau compte-rendu de session - {Student Name} - {Subject}  
**Priority**: Normal  
**Content-Type**: text/html; charset=UTF-8

**Required Variables**:
- `student.firstName`, `student.lastName`
- `coach.pseudonym`
- `session.subject`, `session.scheduledDate`, `session.duration`
- `report.summary` (excerpt)
- `dashboardUrl`
- `reportId`

**Call-to-Action**: Link to parent dashboard report view

---

**End of Requirements Document**
