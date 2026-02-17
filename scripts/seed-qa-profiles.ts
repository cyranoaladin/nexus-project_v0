/**
 * QA Seed Script — Idempotent creation of all test profiles
 *
 * Profiles created:
 * 1. admin@nexus-reussite.com (ADMIN, activated)
 * 2. parent@example.com (PARENT, activated, 1 child)
 * 3. student@example.com (ELEVE, activated, linked to parent, entitlements + subscription)
 * 4. qa-inactive@nexus-test.local (ELEVE, NOT activated — tests login block)
 * 5. qa-no-entitlement@nexus-test.local (ELEVE, activated, NO entitlements — tests access denied)
 * 6. qa-coach@nexus-reussite.com (COACH, activated)
 * 7. qa-parent-nochild@nexus-test.local (PARENT, activated, NO children)
 *
 * Usage: npx tsx scripts/seed-qa-profiles.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

const QA_PASSWORD = 'admin123';
const QA_PASSWORD_HASH = bcrypt.hashSync(QA_PASSWORD, 10);

/** Hash an activation token for safe storage (mirrors student-activation.service.ts) */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function main() {
  console.log('🧪 QA Seed: Creating test profiles...\n');

  // ─── 1. Admin ────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@nexus-reussite.com' },
    update: { activatedAt: new Date() },
    create: {
      email: 'admin@nexus-reussite.com',
      password: QA_PASSWORD_HASH,
      firstName: 'Admin',
      lastName: 'Nexus',
      role: 'ADMIN',
      activatedAt: new Date(),
    },
  });
  console.log(`✅ Admin: ${admin.email} (${admin.id})`);

  // ─── 2. Parent (activated, with child) ───────────────────────────────
  const parentUser = await prisma.user.upsert({
    where: { email: 'parent@example.com' },
    update: { activatedAt: new Date() },
    create: {
      email: 'parent@example.com',
      password: QA_PASSWORD_HASH,
      firstName: 'Parent',
      lastName: 'Test',
      role: 'PARENT',
      activatedAt: new Date(),
    },
  });
  const parentProfile = await prisma.parentProfile.upsert({
    where: { userId: parentUser.id },
    update: {},
    create: {
      userId: parentUser.id,
      address: '123 Rue de la Paix, Tunis',
      city: 'Tunis',
      country: 'Tunisie',
    },
  });
  console.log(`✅ Parent: ${parentUser.email} (${parentUser.id})`);

  // ─── 3. Student (activated, linked to parent, entitlements) ──────────
  const studentUser = await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: { activatedAt: new Date() },
    create: {
      email: 'student@example.com',
      password: QA_PASSWORD_HASH,
      firstName: 'Étudiant',
      lastName: 'Test',
      role: 'ELEVE',
      activatedAt: new Date(),
    },
  });
  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      userId: studentUser.id,
      parentId: parentProfile.id,
      grade: 'Terminale',
      school: 'Lycée Pilote',
      credits: 10,
      totalSessions: 0,
      completedSessions: 0,
    },
  });

  // Entitlements for student
  const entitlementData = [
    { id: 'ent-qa-maths', productCode: 'ARIA_ADDON_MATHS', label: 'ARIA Maths QA' },
    { id: 'ent-qa-hybride', productCode: 'ABONNEMENT_HYBRIDE', label: 'Abonnement Hybride QA' },
  ];
  for (const ent of entitlementData) {
    await prisma.entitlement.upsert({
      where: { id: ent.id },
      update: {},
      create: {
        id: ent.id,
        userId: studentUser.id,
        productCode: ent.productCode,
        label: ent.label,
        status: 'ACTIVE',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // Subscription for student (required by ARIA route)
  await prisma.subscription.upsert({
    where: { id: 'sub-qa-student' },
    update: {},
    create: {
      id: 'sub-qa-student',
      studentId: student.id,
      planName: 'Hybride',
      monthlyPrice: 350,
      creditsPerMonth: 8,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      ariaCost: 50,
      ariaSubjects: ['MATHEMATIQUES', 'NSI'],
    },
  });
  console.log(`✅ Student: ${studentUser.email} (${studentUser.id}) — 2 entitlements + subscription`);

  // ─── 4. Inactive student (NOT activated — tests login block) ─────────
  const inactiveToken = 'act_qa_test_token_inactive_12345';
  const inactiveUser = await prisma.user.upsert({
    where: { email: 'qa-inactive@nexus-test.local' },
    update: {
      activatedAt: null,
      activationToken: hashToken(inactiveToken),
      activationExpiry: new Date(Date.now() + 72 * 60 * 60 * 1000),
    },
    create: {
      email: 'qa-inactive@nexus-test.local',
      password: null, // No password — requires activation
      firstName: 'Inactive',
      lastName: 'Student',
      role: 'ELEVE',
      activatedAt: null,
      activationToken: hashToken(inactiveToken),
      activationExpiry: new Date(Date.now() + 72 * 60 * 60 * 1000),
    },
  });
  // Ensure student record exists for inactive user
  await prisma.student.upsert({
    where: { userId: inactiveUser.id },
    update: {},
    create: {
      userId: inactiveUser.id,
      parentId: parentProfile.id,
      grade: 'Première',
      credits: 0,
      totalSessions: 0,
      completedSessions: 0,
    },
  });
  console.log(`✅ Inactive student: ${inactiveUser.email} (token: ${inactiveToken})`);

  // ─── 5. Student with no entitlements (activated, but no ARIA access) ─
  const noEntUser = await prisma.user.upsert({
    where: { email: 'qa-no-entitlement@nexus-test.local' },
    update: { activatedAt: new Date() },
    create: {
      email: 'qa-no-entitlement@nexus-test.local',
      password: QA_PASSWORD_HASH,
      firstName: 'NoAccess',
      lastName: 'Student',
      role: 'ELEVE',
      activatedAt: new Date(),
    },
  });
  await prisma.student.upsert({
    where: { userId: noEntUser.id },
    update: {},
    create: {
      userId: noEntUser.id,
      parentId: parentProfile.id,
      grade: 'Seconde',
      credits: 0,
      totalSessions: 0,
      completedSessions: 0,
    },
  });
  console.log(`✅ No-entitlement student: ${noEntUser.email}`);

  // ─── 6. Coach (activated) ────────────────────────────────────────────
  const coachUser = await prisma.user.upsert({
    where: { email: 'qa-coach@nexus-reussite.com' },
    update: { activatedAt: new Date() },
    create: {
      email: 'qa-coach@nexus-reussite.com',
      password: QA_PASSWORD_HASH,
      firstName: 'QA',
      lastName: 'Coach',
      role: 'COACH',
      activatedAt: new Date(),
    },
  });
  await prisma.coachProfile.upsert({
    where: { userId: coachUser.id },
    update: {},
    create: {
      userId: coachUser.id,
      title: 'Professeur QA',
      pseudonym: 'QA Coach',
      tag: '🧪 QA',
      description: 'Coach de test QA',
      subjects: ['MATHEMATIQUES'],
      availableOnline: true,
      availableInPerson: false,
    },
  });
  console.log(`✅ Coach: ${coachUser.email}`);

  // ─── 7. Parent with no children ──────────────────────────────────────
  const loneParent = await prisma.user.upsert({
    where: { email: 'qa-parent-nochild@nexus-test.local' },
    update: { activatedAt: new Date() },
    create: {
      email: 'qa-parent-nochild@nexus-test.local',
      password: QA_PASSWORD_HASH,
      firstName: 'Lone',
      lastName: 'Parent',
      role: 'PARENT',
      activatedAt: new Date(),
    },
  });
  await prisma.parentProfile.upsert({
    where: { userId: loneParent.id },
    update: {},
    create: {
      userId: loneParent.id,
    },
  });
  console.log(`✅ Parent (no child): ${loneParent.email}`);

  console.log('\n🎉 QA Seed complete. All 7 profiles ready.');
  console.log('\n📋 Credentials (all use password: admin123):');
  console.log('  admin@nexus-reussite.com          → ADMIN');
  console.log('  parent@example.com                → PARENT (1 child)');
  console.log('  student@example.com               → ELEVE (activated, entitlements)');
  console.log('  qa-inactive@nexus-test.local      → ELEVE (NOT activated, has token)');
  console.log('  qa-no-entitlement@nexus-test.local→ ELEVE (activated, NO entitlements)');
  console.log('  qa-coach@nexus-reussite.com       → COACH');
  console.log('  qa-parent-nochild@nexus-test.local→ PARENT (no children)');
}

main()
  .catch((e) => {
    console.error('❌ QA Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
