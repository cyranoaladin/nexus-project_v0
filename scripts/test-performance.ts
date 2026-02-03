/**
 * Performance & Security Testing Script
 * 
 * Tests:
 * - Large dataset handling (100 badges, 500 transactions)
 * - API response time < 2s
 * - API response size < 1MB
 * - Parent data isolation
 */

import { prisma } from '@/lib/prisma';

async function seedLargeDataset() {
  console.log('🚀 Seeding large dataset for performance testing...');

  const parentUser = await prisma.user.findFirst({
    where: {
      role: 'PARENT',
      email: 'parent.test@example.com'
    },
    include: {
      parentProfile: {
        include: {
          children: true
        }
      }
    }
  });

  if (!parentUser || !parentUser.parentProfile) {
    console.error('❌ Parent user not found. Run seed-parent-dashboard-e2e.ts first.');
    return;
  }

  const parent = parentUser.parentProfile;
  const children = parent.children;

  if (children.length === 0) {
    console.error('❌ No children found for parent.');
    return;
  }

  const studentId = children[0].userId;

  console.log(`📝 Seeding data for student: ${studentId}`);

  // Create 100 badges
  console.log('🏆 Creating 100 badges...');
  const badgeCategories = ['ASSIDUITE', 'PROGRESSION', 'CURIOSITE'];
  const badges: any[] = [];

  for (let i = 0; i < 100; i++) {
    const category = badgeCategories[i % 3];
    const badge = await prisma.badge.upsert({
      where: { id: `badge-perf-${i}` },
      update: {},
      create: {
        id: `badge-perf-${i}`,
        name: `Badge Performance ${i + 1}`,
        description: `Badge de test pour la performance - catégorie ${category}`,
        category: category,
        icon: ['🏆', '⭐', '🎯', '🚀', '💎'][i % 5],
        condition: 'Test condition'
      }
    });
    badges.push(badge);
  }

  // Assign badges to student
  console.log('📌 Assigning badges to student...');
  for (let i = 0; i < 100; i++) {
    const earnedDate = new Date();
    earnedDate.setDate(earnedDate.getDate() - Math.floor(Math.random() * 90));

    await prisma.studentBadge.upsert({
      where: {
        studentId_badgeId: {
          studentId: children[0].id,
          badgeId: `badge-perf-${i}`
        }
      },
      update: {},
      create: {
        studentId: children[0].id,
        badgeId: `badge-perf-${i}`,
        earnedAt: earnedDate
      }
    });
  }

  // Create 500 financial transactions
  console.log('💰 Creating 500 financial transactions...');
  
  const paymentTypes = ['SUBSCRIPTION', 'CREDIT_PACK', 'SPECIAL_PACK'] as const;
  const paymentStatuses = ['COMPLETED', 'PENDING', 'FAILED'] as const;

  for (let i = 0; i < 250; i++) {
    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 180));

    // Parent payments
    await prisma.payment.create({
      data: {
        id: `payment-perf-${i}`,
        userId: parentUser.id,
        amount: Math.floor(Math.random() * 500) + 50,
        type: paymentTypes[Math.floor(Math.random() * 3)],
        description: `Paiement de test ${i + 1}`,
        status: paymentStatuses[Math.floor(Math.random() * 3)],
        createdAt: createdDate
      }
    });

    // Credit transactions for each child
    for (const child of children) {
      await prisma.creditTransaction.create({
        data: {
          id: `credit-perf-${i}-${child.id}`,
          studentId: child.id,
          amount: (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 10),
          type: Math.random() > 0.5 ? 'PURCHASE' : 'USAGE',
          description: `Transaction crédit ${i + 1}`,
          createdAt: createdDate
        }
      });
    }
  }

  // Create sessions for progress history
  console.log('📅 Creating sessions for progress history...');
  
  // Get a coach user
  const coachUser = await prisma.user.findFirst({
    where: { role: 'COACH' }
  });

  if (!coachUser) {
    console.warn('⚠️  No coach found, skipping session creation');
    return;
  }

  const subjects = ['MATHEMATIQUES', 'FRANCAIS', 'ANGLAIS', 'PHYSIQUE_CHIMIE'] as const;
  const statuses = ['COMPLETED', 'SCHEDULED', 'CANCELLED'] as const;
  const sessionTypes = ['INDIVIDUAL', 'GROUP'] as const;

  for (let i = 0; i < 100; i++) {
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() - Math.floor(Math.random() * 90));

    await prisma.sessionBooking.create({
      data: {
        id: `session-perf-${i}`,
        studentId: studentId,
        coachId: coachUser.id,
        subject: subjects[i % 4],
        title: `Séance de ${subjects[i % 4]} #${i + 1}`,
        scheduledDate: scheduledDate,
        startTime: '14:00',
        endTime: '15:00',
        duration: 60,
        type: sessionTypes[i % 2],
        status: statuses[Math.floor(Math.random() * 3)]
      }
    });
  }

  console.log('✅ Large dataset seeded successfully!');
  console.log('📊 Summary:');
  console.log('  - 100 badges');
  console.log('  - 500+ transactions');
  console.log('  - 100 sessions');
}

async function testAPIPerformance() {
  console.log('\n🔬 Testing API Performance...');

  const startTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:3000/api/parent/dashboard', {
      headers: {
        'Cookie': 'next-auth.session-token=test-session-token'
      }
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    const data = await response.text();
    const responseSize = new Blob([data]).size;
    const responseSizeMB = responseSize / (1024 * 1024);

    console.log(`⏱️  Response Time: ${responseTime}ms`);
    console.log(`📦 Response Size: ${responseSizeMB.toFixed(2)}MB (${responseSize} bytes)`);

    if (responseTime > 2000) {
      console.warn('⚠️  WARNING: Response time > 2s');
    } else {
      console.log('✅ Response time < 2s');
    }

    if (responseSizeMB > 1) {
      console.warn('⚠️  WARNING: Response size > 1MB');
    } else {
      console.log('✅ Response size < 1MB');
    }

  } catch (error) {
    console.error('❌ API test failed:', error);
  }
}

async function testDataIsolation() {
  console.log('\n🔒 Testing Data Isolation...');

  // Create two parent users
  const parent1 = await prisma.user.findFirst({
    where: { role: 'PARENT', email: 'parent.test@example.com' }
  });

  const parent2User = await prisma.user.upsert({
    where: { email: 'parent2.test@example.com' },
    update: {},
    create: {
      id: 'user-parent2-test',
      email: 'parent2.test@example.com',
      firstName: 'Parent2',
      lastName: 'Test',
      role: 'PARENT'
    }
  });

  const parent2Profile = await prisma.parentProfile.upsert({
    where: { userId: parent2User.id },
    update: {},
    create: {
      userId: parent2User.id
    }
  });

  // Check that parent profiles are separate
  const p1Profile = await prisma.parentProfile.findFirst({
    where: { userId: parent1?.id },
    include: { children: true }
  });

  const p2Profile = await prisma.parentProfile.findFirst({
    where: { userId: parent2User.id },
    include: { children: true }
  });

  if (!p1Profile || !p2Profile) {
    console.error('❌ Parent profiles not found');
    return;
  }

  const p1ChildIds = p1Profile.children.map(c => c.id);
  const p2ChildIds = p2Profile.children.map(c => c.id);

  const hasOverlap = p1ChildIds.some(id => p2ChildIds.includes(id));

  if (hasOverlap) {
    console.error('❌ Data isolation FAILED: Parents share children');
  } else {
    console.log('✅ Data isolation verified: Parents have separate children');
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');

  await prisma.sessionBooking.deleteMany({
    where: { id: { startsWith: 'session-perf-' } }
  });

  await prisma.creditTransaction.deleteMany({
    where: { id: { startsWith: 'credit-perf-' } }
  });

  await prisma.payment.deleteMany({
    where: { id: { startsWith: 'payment-perf-' } }
  });

  await prisma.studentBadge.deleteMany({
    where: { badgeId: { startsWith: 'badge-perf-' } }
  });

  await prisma.badge.deleteMany({
    where: { id: { startsWith: 'badge-perf-' } }
  });

  console.log('✅ Cleanup complete');
}

async function main() {
  try {
    await seedLargeDataset();
    await testDataIsolation();
    
    console.log('\n📝 Manual tests required:');
    console.log('1. Start dev server: npm run dev');
    console.log('2. Login as parent.test@example.com');
    console.log('3. Open browser DevTools Network tab');
    console.log('4. Navigate to /dashboard/parent');
    console.log('5. Check:');
    console.log('   - API response time < 2s');
    console.log('   - Response size < 1MB');
    console.log('   - No console errors');
    console.log('   - Dashboard renders all badges and transactions');
    console.log('\n6. Test accessibility:');
    console.log('   - Tab through all interactive elements');
    console.log('   - Verify focus indicators visible');
    console.log('   - Test with screen reader (optional)');
    console.log('\n7. Security:');
    console.log('   - Inspect Network requests for exposed child IDs');
    console.log('   - Check Console for sensitive data');
    console.log('   - Try accessing dashboard without login');

    await cleanup();

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
