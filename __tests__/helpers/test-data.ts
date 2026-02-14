/**
 * Test Data Helpers
 * 
 * Provides utilities to generate unique test data and avoid constraint violations.
 */

/**
 * Generate unique email for tests
 */
export function uniqueEmail(prefix = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}@test.nexus.com`;
}

/**
 * Generate unique pseudonym for coaches
 */
export function uniquePseudonym(prefix = 'Coach'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Generate unique external ID for payments
 */
export function uniqueExternalId(prefix = 'ext'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Generate unique phone number
 */
export function uniquePhone(): string {
  const timestamp = Date.now().toString().slice(-8);
  return `+216${timestamp}`;
}

/**
 * Generate unique public share ID
 */
export function uniquePublicShareId(): string {
  return `share_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Generate non-overlapping time slots for session bookings
 * Returns array of [startTime, endTime] pairs
 */
export function generateNonOverlappingSlots(count: number, baseDate: Date = new Date()): Array<[Date, Date]> {
  const slots: Array<[Date, Date]> = [];
  const startHour = 9; // Start at 9 AM
  
  for (let i = 0; i < count; i++) {
    const start = new Date(baseDate);
    start.setHours(startHour + (i * 2), 0, 0, 0); // 2-hour gaps between sessions
    
    const end = new Date(start);
    end.setHours(start.getHours() + 1); // 1-hour sessions
    
    slots.push([start, end]);
  }
  
  return slots;
}

/**
 * Create unique user data for tests
 */
export function createUniqueUserData(role: 'STUDENT' | 'PARENT' | 'COACH' | 'ADMIN' = 'STUDENT') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  
  return {
    email: `${role.toLowerCase()}_${timestamp}_${random}@test.nexus.com`,
    name: `Test ${role} ${timestamp}`,
    role,
    password: 'test-password-123',
  };
}

/**
 * Create unique payment data for tests
 */
export function createUniquePaymentData(userId: string, method: string = 'konnect') {
  return {
    userId,
    type: 'SUBSCRIPTION' as const,
    amount: 100,
    currency: 'TND',
    description: `Test payment ${Date.now()}`,
    status: 'COMPLETED' as const,
    method,
    externalId: uniqueExternalId('pay'),
  };
}

/**
 * Create unique session booking data for tests
 */
export function createUniqueSessionData(studentId: string, coachId: string, slotIndex: number = 0) {
  const slots = generateNonOverlappingSlots(10);
  const [startTime, endTime] = slots[slotIndex];
  
  return {
    studentId,
    coachId,
    subject: 'MATHEMATIQUES' as const,
    type: 'INDIVIDUAL' as const,
    status: 'CONFIRMED' as const,
    startTime,
    endTime,
    duration: 60,
  };
}

/**
 * Wait for a short time (useful for avoiding race conditions in tests)
 */
export function wait(ms: number = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
