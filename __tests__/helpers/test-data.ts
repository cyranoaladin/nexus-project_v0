/**
 * Test Data Helpers
 * 
 * Provides utilities to generate unique test data and avoid constraint violations.
 * Uses crypto.randomUUID() for absolute uniqueness across parallel tests.
 */

import { randomUUID } from 'crypto';

/**
 * Generate unique email for tests
 * Uses UUID to guarantee uniqueness even in parallel test execution
 */
export function uniqueEmail(prefix = 'test'): string {
  const uuid = randomUUID();
  return `${prefix}_${uuid}@test.nexus.com`;
}

/**
 * Generate unique pseudonym for coaches
 * Uses UUID to guarantee uniqueness
 */
export function uniquePseudonym(prefix = 'Coach'): string {
  const uuid = randomUUID().substring(0, 8);
  return `${prefix}_${uuid}`;
}

/**
 * Generate unique external ID for payments
 * Uses UUID to guarantee uniqueness
 */
export function uniqueExternalId(prefix = 'ext'): string {
  const uuid = randomUUID();
  return `${prefix}_${uuid}`;
}

/**
 * Generate unique phone number
 * Uses UUID to guarantee uniqueness
 */
export function uniquePhone(): string {
  const uuid = randomUUID().replace(/-/g, '').substring(0, 8);
  return `+216${uuid}`;
}

/**
 * Generate unique public share ID
 * Uses UUID to guarantee uniqueness
 */
export function uniquePublicShareId(): string {
  const uuid = randomUUID();
  return `share_${uuid}`;
}

/**
 * Generate non-overlapping time slots for session bookings
 * Returns array of [startTime, endTime] pairs
 * Uses large time offsets to prevent exclusion constraint violations
 */
export function generateNonOverlappingSlots(count: number, baseDate: Date = new Date()): Array<[Date, Date]> {
  const slots: Array<[Date, Date]> = [];
  
  for (let i = 0; i < count; i++) {
    // Use 1-day offset between slots to guarantee no overlap
    const start = new Date(baseDate.getTime() + (i * 24 * 60 * 60 * 1000));
    start.setHours(10, 0, 0, 0); // Fixed 10:00 AM start time
    
    const end = new Date(start);
    end.setHours(11, 0, 0, 0); // 1-hour sessions (10:00-11:00)
    
    slots.push([start, end]);
  }
  
  return slots;
}

/**
 * Create unique user data for tests
 * Uses UUID to guarantee uniqueness across parallel tests
 */
export function createUniqueUserData(role: 'STUDENT' | 'PARENT' | 'COACH' | 'ADMIN' = 'STUDENT') {
  const uuid = randomUUID();
  
  return {
    email: `${role.toLowerCase()}_${uuid}@test.nexus.com`,
    name: `Test ${role} ${uuid.substring(0, 8)}`,
    role,
    password: 'test-password-123',
  };
}

/**
 * Create unique payment data for tests
 * Uses UUID for externalId to guarantee uniqueness
 */
export function createUniquePaymentData(userId: string, method: string = 'konnect') {
  const uuid = randomUUID();
  return {
    userId,
    type: 'SUBSCRIPTION' as const,
    amount: 100,
    currency: 'TND',
    description: `Test payment ${uuid.substring(0, 8)}`,
    status: 'COMPLETED' as const,
    method,
    externalId: uniqueExternalId('pay'),
  };
}

/**
 * Create unique session booking data for tests
 * Uses non-overlapping slots with 1-day offset to prevent exclusion constraint violations
 */
export function createUniqueSessionData(studentId: string, coachId: string, slotIndex: number = 0) {
  const slots = generateNonOverlappingSlots(100); // Generate enough slots for parallel tests
  const [startTime, endTime] = slots[slotIndex % 100];
  const uuid = randomUUID().substring(0, 8);
  
  return {
    studentId,
    coachId,
    subject: 'MATHEMATIQUES' as const,
    type: 'INDIVIDUAL' as const,
    status: 'CONFIRMED' as const,
    startTime,
    endTime,
    duration: 60,
    title: `Test Session ${uuid}`,
    description: `Test session booking ${uuid}`,
  };
}

/**
 * Wait for a short time (useful for avoiding race conditions in tests)
 */
export function wait(ms: number = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
