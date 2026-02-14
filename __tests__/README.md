# Test Setup and Helpers

This directory contains test utilities and setup files for integration tests.

## Files

### `setup.ts`
Global test setup that runs before each integration test. Provides:
- **Automatic database cleanup** between tests
- **Prisma client** export for tests
- **Proper teardown** after all tests

### `helpers/test-data.ts`
Utilities for generating unique test data to avoid constraint violations:

#### Functions

**Email Generation**
```typescript
uniqueEmail('prefix') // Returns: prefix_timestamp_random@test.nexus.com
```

**User Data**
```typescript
createUniqueUserData('STUDENT') // Returns complete user object with unique email
```

**Payment Data**
```typescript
createUniquePaymentData(userId, 'konnect') // Returns payment with unique externalId
```

**Session Booking**
```typescript
createUniqueSessionData(studentId, coachId, slotIndex) // Returns non-overlapping session
generateNonOverlappingSlots(5) // Returns 5 non-overlapping time slots
```

**Other Helpers**
```typescript
uniquePseudonym('Coach') // For coach profiles
uniqueExternalId('pay') // For payment external IDs
uniquePhone() // For phone numbers
uniquePublicShareId() // For public share IDs
wait(100) // Async wait utility
```

## Usage in Tests

### Integration Tests

```typescript
import { prisma } from '../setup';
import { 
  createUniqueUserData, 
  createUniquePaymentData,
  createUniqueSessionData 
} from '../helpers/test-data';

describe('Payment Integration Tests', () => {
  it('should create payment without constraint violations', async () => {
    // Database is automatically cleaned before this test
    
    // Create unique user
    const userData = createUniqueUserData('STUDENT');
    const user = await prisma.user.create({ data: userData });
    
    // Create unique payment
    const paymentData = createUniquePaymentData(user.id, 'konnect');
    const payment = await prisma.payment.create({ data: paymentData });
    
    expect(payment).toBeDefined();
    expect(payment.externalId).toContain('pay_');
  });
});
```

### Session Booking Tests

```typescript
import { generateNonOverlappingSlots, createUniqueSessionData } from '../helpers/test-data';

describe('Session Booking Tests', () => {
  it('should create multiple sessions without overlap', async () => {
    const student = await prisma.user.create({ data: createUniqueUserData('STUDENT') });
    const coach = await prisma.user.create({ data: createUniqueUserData('COACH') });
    
    // Create 3 non-overlapping sessions
    for (let i = 0; i < 3; i++) {
      const sessionData = createUniqueSessionData(student.id, coach.id, i);
      await prisma.sessionBooking.create({ data: sessionData });
    }
    
    const sessions = await prisma.sessionBooking.findMany();
    expect(sessions).toHaveLength(3);
  });
});
```

## Configuration

### jest.integration.config.js
Separate Jest config for integration tests:
- Uses `node` environment (not jsdom)
- Loads `__tests__/setup.ts` for automatic cleanup
- Increased timeout (30s) for database operations
- Matches `*.integration.test.ts` files

### Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test
npm run test:integration -- path/to/test.integration.test.ts

# Run with coverage
npm run test:integration -- --coverage
```

## Best Practices

1. **Always use unique data helpers** to avoid constraint violations
2. **Don't rely on specific IDs** - they change between test runs
3. **Use descriptive test names** that explain what's being tested
4. **Clean up is automatic** - no need for manual cleanup in tests
5. **Avoid hardcoded values** for unique fields (email, externalId, etc.)

## Troubleshooting

### Duplicate Key Violations
- Use `uniqueEmail()`, `uniqueExternalId()`, etc.
- Check that you're not creating the same entity twice in one test

### Foreign Key Violations
- Ensure parent entities are created before children
- Check CASCADE settings in Prisma schema

### Exclusion Constraint Violations (Session Overlap)
- Use `generateNonOverlappingSlots()` for session times
- Use different `slotIndex` for each session in the same test

### "Role 'root' Does Not Exist"
- Check DATABASE_URL in .env.test
- Ensure PostgreSQL user matches connection string
