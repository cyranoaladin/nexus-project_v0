# E2E Test Fixtures

This directory contains test data fixtures for end-to-end (E2E) testing.

## Parent Dashboard Fixture (`parent.json`)

Comprehensive test data for parent dashboard E2E tests.

### Data Structure

#### Users
- **1 Parent**: Marie Dupont (parent.dashboard@test.com)
- **2 Children**: 
  - Yasmine Dupont (Terminale) - IMMERSION subscription
  - Karim Dupont (Première) - HYBRIDE subscription
- **2 Coaches**: 
  - Hélios (Mathematics, Physics, NSI)
  - Zénon (French, Philosophy, History)

#### Badges (18 total)
- **ASSIDUITE** (6 badges): Premier Pas, Régularité Bronze/Argent/Or, Présence Parfaite, Assidu de la Semaine
- **PROGRESSION** (6 badges): Progression Rapide, Mathématicien, Scientifique, Littéraire, Progrès Constant, Progresseur du Mois
- **CURIOSITE** (6 badges): Question Pertinente, Explorateur, Chercheur, Multidisciplinaire, Esprit Critique, Penseur Créatif

#### Student Badge Assignments
- **Yasmine**: 12 badges earned (most recent: Feb 1, 2026)
- **Karim**: 7 badges earned (most recent: Jan 30, 2026)

#### Session History (40 sessions over 3 months)

**Yasmine (24 sessions)**:
- Mathematics: 12 sessions
- Physics-Chemistry: 6 sessions
- NSI: 6 sessions
- Status: 18 completed, 6 scheduled
- Period: Nov 2025 - Feb 2026

**Karim (16 sessions)**:
- French: 8 sessions
- Mathematics: 8 sessions
- Status: 12 completed, 4 scheduled
- Period: Nov 2025 - Jan 2026

#### Credit Transactions (26 transactions)
- **Yasmine**: 
  - 3 monthly allocations (Nov, Dec, Jan) × 12 credits = 36 credits
  - 14 usage transactions (sessions) = -14 credits
  - Current balance: 8 credits
- **Karim**: 
  - 3 monthly allocations (Nov, Dec, Jan) × 8 credits = 24 credits
  - 12 usage transactions (sessions) = -12 credits
  - Current balance: 5 credits

#### Payments (15 transactions)

**Completed (13)**:
- Nov 2025: 4 payments (subscriptions + ARIA add-ons) = 1,200 TND
- Dec 2025: 4 payments (subscriptions + ARIA add-ons) = 1,200 TND
- Jan 2026: 4 payments (subscriptions + ARIA add-ons) = 1,200 TND
- Nov 2025: 1 credit pack purchase = 200 TND
- **Total**: 3,800 TND

**Pending (2)**:
- Feb 2026: 2 payments (subscriptions) = 1,000 TND

### Test Credentials

All users use the same password: `password123`

| Role | Email | Name |
|------|-------|------|
| Parent | parent.dashboard@test.com | Marie Dupont |
| Student | yasmine.dupont@test.com | Yasmine Dupont |
| Student | karim.dupont@test.com | Karim Dupont |
| Coach | helios@test.com | Alexandre Martin (Hélios) |
| Coach | zenon@test.com | Sophie Bernard (Zénon) |

## Seeding the Database

### Using the Dedicated Seed Script

```bash
# Set E2E database URL
export DATABASE_URL="postgresql://user:password@localhost:5433/nexus_e2e"

# Run the parent dashboard seed script
npx tsx scripts/seed-parent-dashboard-e2e.ts
```

### Manual Seeding Steps

If you need to manually seed or verify the data:

1. **Clear existing test data**:
   ```bash
   # Remove conflicting test users
   npx prisma studio # Delete users manually
   ```

2. **Run seed script**:
   ```bash
   npm run test:e2e:setup
   ```

3. **Verify seeding**:
   ```bash
   # Check database contents
   npx prisma studio
   ```

## Test Scenarios Covered

### Badge Display
- Multiple badge categories (ASSIDUITE, PROGRESSION, CURIOSITE)
- Recent badges (earned within last 7 days)
- Different badge counts per child
- Empty state handling (if modified)

### Progress Tracking
- 3 months of session history
- Multiple subjects per student
- Varied completion rates
- Time-based progress evolution

### Financial History
- Multiple transaction types (SUBSCRIPTION, CREDIT_PACK, ARIA add-ons)
- Different payment statuses (COMPLETED, PENDING)
- Monthly recurring payments
- Credit pack purchases
- Transaction history over 3+ months

### Multi-Child Management
- 2 children with different:
  - Grade levels (Terminale vs Première)
  - Subscription plans (IMMERSION vs HYBRIDE)
  - Subject preferences
  - Session counts and progress rates
  - Badge achievements

### Parent Data Isolation
- Parent can only see their own children's data
- Cannot access data from other parents
- All queries filtered by parent ID

## Modifying Fixtures

To add or modify test data:

1. **Edit `parent.json`** directly
2. **Update the seed script** if new relationships are added
3. **Run the seed script** to verify changes
4. **Update this README** with new data structure

### Important Considerations

- **IDs**: Use consistent ID patterns (`student-001`, `badge-001`, etc.)
- **Dates**: Use ISO 8601 format (`2026-01-15T10:00:00Z`)
- **Relationships**: Ensure foreign keys match (studentId, badgeId, etc.)
- **Enums**: Use valid Prisma enum values (UserRole, Subject, SessionStatus, etc.)
- **Constraints**: Respect unique constraints (email, externalId, etc.)

## Troubleshooting

### Seeding Fails

**Error: Unique constraint violation**
- Check for duplicate emails, externalIds, or other unique fields
- Clear the database and re-seed

**Error: Foreign key constraint**
- Ensure parent records are created before children
- Check relationship IDs match

**Error: Invalid enum value**
- Verify enum values match Prisma schema
- Check spelling and case sensitivity

### Missing Data in Tests

**Parent dashboard shows no children**
- Verify parent-child relationship (parentId)
- Check user IDs match between User and Student tables

**Badges not appearing**
- Verify StudentBadge records created
- Check badge IDs match Badge table
- Verify earnedAt dates are reasonable

**Financial transactions missing**
- Check Payment and CreditTransaction records
- Verify userId and studentId match

## Related Files

- **Fixture data**: `/e2e/fixtures/parent.json`
- **Seed script**: `/scripts/seed-parent-dashboard-e2e.ts`
- **E2E tests**: `/e2e/parent-dashboard.spec.ts` (to be created)
- **API endpoint**: `/app/api/parent/dashboard/route.ts`
- **Page component**: `/app/dashboard/parent/page.tsx`
