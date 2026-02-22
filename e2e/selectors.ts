export const SELECTORS = {
  auth: {
    email: 'input[type="email"]',
    password: 'input[type="password"]',
    submit: 'button[type="submit"]',
  },
  booking: {
    subjectTrigger: 'booking-subject-trigger',
    coachTrigger: 'booking-coach-trigger',
    step1Next: 'booking-step1-next',
    firstSlot: 'booking-slot-0',
  },
  dashboards: {
    parentReady: 'parent-dashboard-ready',
    studentReady: 'student-dashboard-ready',
  },
} as const;
