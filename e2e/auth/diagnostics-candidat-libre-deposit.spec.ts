/**
 * Real HTTP-boundary regression proof for the candidat-libre diagnostics
 * deposit route (mission: "pérenniser le test de dépôt"), reusing this
 * job's existing disposable Core v2 stack — no new E2E infrastructure.
 *
 * This exercises the REAL route handler behind a REAL multipart upload,
 * through the REAL standalone artifact this job already starts
 * (`.next/standalone/server.js`), with a real signed-in candidate session
 * (real NextAuth credentials form, never a fabricated session). It is the
 * exact boundary a Node-version mismatch broke in the private preview
 * (`ReferenceError: File is not defined` — Node 18 lacked the global
 * `File` that Node 22, this job's pinned version, and Jest's own runtime
 * all provide) and that no test previously exercised.
 *
 * PROOF TIER, stated explicitly and never merged with another one: this
 * runs with DIAGNOSTIC_AV_MODE=disabled (this job's own server env). It
 * proves the real multipart→formData→File→pipeline HTTP path. It does NOT
 * exercise a real antivirus engine — that remains the separate, manual
 * rehearsal against the real preview with a real ClamAV daemon.
 *
 * The instrument fixture uses AUTHORIZED status on obviously-synthetic,
 * disposable-only content — never real bank content, never touching
 * DEMO_FIXTURE's own demo-scope allowlist (which stays reserved for the
 * actual demo student flow).
 */
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { expect, test, type Page } from '@playwright/test';
import { PrismaClient } from '@/core-v2/generated/client';
import { diagnosticInstrumentSubjectRelativePath, writeDiagnosticStorageFixture } from '@/lib/core-v2/diagnostics/storage';
import { gotoSignInForm, logoutUser } from '../helpers/auth';
import { resetDisposableE2ERateLimits } from '../helpers/rate-limit';

test.describe.configure({ mode: 'serial' });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
// `|| ''` (not a top-level throw), same convention as session-revocation.spec.ts:
// `npx playwright test --list` (used by scripts/testing/check-ci-test-lane-coverage.mjs
// to enumerate this suite) loads every spec file's module scope without any env set —
// a throw here breaks listing for the WHOLE suite, not just this file.
const coreV2DatabaseUrl = process.env.CORE_V2_DATABASE_URL || '';
const prisma = new PrismaClient({ datasources: { db: { url: coreV2DatabaseUrl } } });

const nonce = Date.now();
const E2E_KNOWN_SECRET = `E2eDeposit.${nonce}.Aa1`;
const studentEmail = `e2e-deposit-student-${nonce}@example.test`;

let instrumentId = '';
let assignmentId = '';

const SYNTHETIC_PDF = (marker: string) =>
  Buffer.from(`%PDF-1.0\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n${marker}-${nonce}`);

test.beforeAll(async () => {
  const subjectPdf = SYNTHETIC_PDF('e2e-deposit-subject');
  const subjectSha256 = createHash('sha256').update(subjectPdf).digest('hex');
  const instrumentKey = `E2E-DEPOSIT-${nonce}`;
  const instrument = await prisma.diagnosticInstrumentRef.create({
    data: {
      instrumentKey,
      version: '1.0.0',
      title: 'E2E deposit regression fixture',
      subject: 'Test',
      level: 'Toutes',
      targetSession: 'E2E',
      form: 'FORM_E2E',
      durationMinutes: 10,
      modalities: 'E2E regression fixture — jamais un instrument réel.',
      catalogStatus: 'AUTHORIZED',
      manifestChecksum: createHash('sha256').update(`${instrumentKey}@1.0.0`).digest('hex'),
      manifestVersion: 'e2e/1.0',
      subjectSha256,
    },
  });
  instrumentId = instrument.id;
  await writeDiagnosticStorageFixture(diagnosticInstrumentSubjectRelativePath(instrument.id), subjectPdf);

  const household = await prisma.household.create({
    data: {
      parents: {
        create: { user: { create: { email: `e2e-deposit-parent-${nonce}@example.test`, role: 'PARENT', accountStatus: 'ACTIVE', activatedAt: new Date() } }, isPrimaryContact: true },
      },
    },
  });
  const studentUser = await prisma.user.create({
    data: {
      email: studentEmail,
      role: 'ELEVE',
      firstName: 'E2eDeposit',
      lastName: 'Student',
      password: await bcrypt.hash(E2E_KNOWN_SECRET, 4),
      accountStatus: 'ACTIVE',
      activatedAt: new Date(),
    },
  });
  const student = await prisma.student.create({
    data: { userId: studentUser.id, householdId: household.id },
  });

  const assignment = await prisma.diagnosticAssignment.create({
    data: {
      studentId: student.id,
      instrumentRefId: instrument.id,
      instrumentKeySnapshot: instrument.instrumentKey,
      instrumentVersionSnapshot: instrument.version,
      formSnapshot: instrument.form,
      manifestChecksumSnapshot: instrument.manifestChecksum,
      subjectSha256Snapshot: instrument.subjectSha256,
      studentProfileSnapshot: { available: false },
      assignedById: null,
    },
  });
  assignmentId = assignment.id;
});

test.afterAll(async () => {
  await prisma.diagnosticSubmission.deleteMany({ where: { assignmentId } }).catch(() => undefined);
  await prisma.diagnosticAssignment.deleteMany({ where: { id: assignmentId } }).catch(() => undefined);
  await prisma.diagnosticInstrumentRef.deleteMany({ where: { id: instrumentId } }).catch(() => undefined);
  await prisma.$disconnect();
});

async function loginAsStudent(page: Page): Promise<void> {
  await resetDisposableE2ERateLimits();
  await gotoSignInForm(page);
  await page.locator('#email').fill(studentEmail);
  await page.locator('#password').fill(E2E_KNOWN_SECRET);
  await Promise.all([
    page.waitForURL((url) => url.pathname.startsWith('/dashboard'), { timeout: 30_000 }),
    page.getByTestId('btn-signin').click(),
  ]);
}

test('real multipart deposit against the real standalone route succeeds and persists', async ({ page }) => {
  await loginAsStudent(page);

  const subjectLinkHref = await page.request
    .get(`${BASE_URL}/api/v2/student/diagnostics/assignments/${assignmentId}/subject`)
    .then((r) => r.status());
  expect(subjectLinkHref).toBe(200);

  const bytes = SYNTHETIC_PDF('e2e-deposit-answer');
  const response = await page.request.post(`${BASE_URL}/api/v2/student/diagnostics/assignments/${assignmentId}/submissions`, {
    multipart: { file: { name: 'reponse.pdf', mimeType: 'application/pdf', buffer: bytes } },
  });
  const envelope = await response.json();
  expect(response.status(), JSON.stringify(envelope)).toBe(201);
  expect(envelope.ok).toBe(true);
  expect(envelope.data.version).toBe(1);

  const row = await prisma.diagnosticSubmission.findUniqueOrThrow({ where: { id: envelope.data.submissionId } });
  expect(row.status).toBe('RECEIVED');
  expect(row.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));

  await logoutUser(page);
});
