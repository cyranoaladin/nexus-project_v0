/**
 * Real ADMIN-browser counter-example for the Core v2 candidat-libre queue.
 *
 * This spec owns its synthetic Core v2 fixture and never relies on a
 * production seed. The auth user is still the real Core v1 ADMIN seeded by
 * scripts/seed-e2e-db.ts and mirrored into Core v2 by
 * scripts/core-v2/seed-e2e-staff-actors.ts, exactly like the auth E2E CI lane.
 *
 * The fixture deliberately contains:
 * - one assignment with v1 RECEIVED then v2 RECEIVED: only v2 may be an
 *   operational queue action;
 * - one assignment with v1 RECEIVED then v2 REJECTED: the canonical latest
 *   usable submission remains v1;
 * - a unique confidential sentinel in a real draft human-review field and
 *   extracted academic content. Neither may cross the queue boundary.
 */
import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { PrismaClient, Prisma } from "@/core-v2/generated/client";
import { loginViaSigninForm } from "../helpers/auth";

test.describe.configure({ mode: "serial" });

const coreV2DatabaseUrl = process.env.CORE_V2_DATABASE_URL || "";
const prisma = new PrismaClient({
  datasources: { db: { url: coreV2DatabaseUrl } },
});
const nonce = Date.now();
const fixturePrefix = `e2e-diagnostics-queue-${nonce}`;
const CONFIDENTIAL_SENTINEL = `CONFIDENTIAL-ACADEMIC-DRAFT-${nonce}-MUST-NOT-LEAK`;

const fixture = {
  householdId: `${fixturePrefix}-household`,
  instrumentId: `${fixturePrefix}-instrument`,
  currentUserId: `${fixturePrefix}-current-user`,
  currentStudentId: `${fixturePrefix}-current-student`,
  currentAssignmentId: `${fixturePrefix}-current-assignment`,
  currentV1Id: `${fixturePrefix}-current-v1`,
  currentV2Id: `${fixturePrefix}-current-v2`,
  currentProcessingId: `${fixturePrefix}-processing`,
  currentExtractionId: `${fixturePrefix}-extraction`,
  currentDraftId: `${fixturePrefix}-draft`,
  rejectedUserId: `${fixturePrefix}-rejected-user`,
  rejectedStudentId: `${fixturePrefix}-rejected-student`,
  rejectedAssignmentId: `${fixturePrefix}-rejected-assignment`,
  rejectedFallbackV1Id: `${fixturePrefix}-rejected-fallback-v1`,
  rejectedV2Id: `${fixturePrefix}-rejected-v2`,
} as const;

type QueueItem = {
  submissionId: string;
  candidate: unknown;
  submission: { version: number; status: string };
};

function asQueueItems(body: unknown): QueueItem[] {
  const envelope = body as { ok?: unknown; data?: { items?: unknown } };
  expect(envelope.ok).toBe(true);
  expect(Array.isArray(envelope.data?.items)).toBe(true);
  return envelope.data?.items as QueueItem[];
}

async function cleanupFixture(): Promise<void> {
  await prisma.diagnosticBilanDraft.deleteMany({
    where: { id: fixture.currentDraftId },
  });
  await prisma.diagnosticSubmissionExtraction.deleteMany({
    where: { id: fixture.currentExtractionId },
  });
  await prisma.diagnosticSubmissionProcessing.deleteMany({
    where: { id: fixture.currentProcessingId },
  });
  await prisma.diagnosticSubmission.deleteMany({
    where: {
      assignmentId: {
        in: [fixture.currentAssignmentId, fixture.rejectedAssignmentId],
      },
    },
  });
  await prisma.diagnosticAssignment.deleteMany({
    where: {
      id: { in: [fixture.currentAssignmentId, fixture.rejectedAssignmentId] },
    },
  });
  await prisma.student.deleteMany({
    where: {
      id: { in: [fixture.currentStudentId, fixture.rejectedStudentId] },
    },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [fixture.currentUserId, fixture.rejectedUserId] } },
  });
  await prisma.household.deleteMany({ where: { id: fixture.householdId } });
  await prisma.diagnosticInstrumentRef.deleteMany({
    where: { id: fixture.instrumentId },
  });
}

async function waitForQueueResponse(page: Page): Promise<APIResponse> {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      url.pathname === "/api/v2/staff/diagnostics/submissions" &&
      url.searchParams.get("status") === "ACTION_REQUIRED"
    );
  });
}

test.beforeAll(async () => {
  if (!coreV2DatabaseUrl) {
    throw new Error(
      "CORE_V2_DATABASE_URL is required. Run this spec with the disposable two-database HYBRID auth harness.",
    );
  }

  await cleanupFixture();

  const v1CreatedAt = new Date("2026-09-23T08:00:00.000Z");
  const v2CreatedAt = new Date("2026-09-23T09:00:00.000Z");

  await prisma.household.create({ data: { id: fixture.householdId } });
  await prisma.diagnosticInstrumentRef.create({
    data: {
      id: fixture.instrumentId,
      instrumentKey: `E2E-QUEUE-${nonce}`,
      version: "1.0.0",
      title: "Diagnostic synthétique de file",
      subject: "Fixture E2E",
      level: "Toutes",
      targetSession: "E2E",
      form: "FORM_E2E",
      durationMinutes: 10,
      modalities: "Fixture E2E uniquement.",
      catalogStatus: "DEMO_FIXTURE",
      manifestChecksum: `manifest-${nonce}`,
      manifestVersion: "e2e/1",
      subjectSha256: "a".repeat(64),
    },
  });

  await prisma.user.createMany({
    data: [
      {
        id: fixture.currentUserId,
        email: `queue-current-${nonce}@confidential.example.test`,
        phone: "+21600000001",
        role: "ELEVE",
        firstName: "QueueCurrent",
        lastName: "Candidate",
        accountStatus: "ACTIVE",
        activatedAt: new Date("2026-09-01T10:00:00.000Z"),
      },
      {
        id: fixture.rejectedUserId,
        email: `queue-rejected-${nonce}@confidential.example.test`,
        phone: "+21600000002",
        role: "ELEVE",
        firstName: "QueueRejectedFallback",
        lastName: "Candidate",
        accountStatus: "ACTIVE",
        activatedAt: new Date("2026-09-01T10:00:00.000Z"),
      },
    ],
  });
  await prisma.student.createMany({
    data: [
      {
        id: fixture.currentStudentId,
        userId: fixture.currentUserId,
        householdId: fixture.householdId,
      },
      {
        id: fixture.rejectedStudentId,
        userId: fixture.rejectedUserId,
        householdId: fixture.householdId,
      },
    ],
  });

  const assignmentSnapshot = {
    instrumentRefId: fixture.instrumentId,
    instrumentKeySnapshot: `E2E-QUEUE-${nonce}`,
    instrumentVersionSnapshot: "1.0.0",
    formSnapshot: "FORM_E2E",
    manifestChecksumSnapshot: `manifest-${nonce}`,
    subjectSha256Snapshot: "a".repeat(64),
    studentProfileSnapshot: { available: false },
    status: "SUBMITTED" as const,
  };
  await prisma.diagnosticAssignment.createMany({
    data: [
      {
        id: fixture.currentAssignmentId,
        studentId: fixture.currentStudentId,
        ...assignmentSnapshot,
      },
      {
        id: fixture.rejectedAssignmentId,
        studentId: fixture.rejectedStudentId,
        ...assignmentSnapshot,
      },
    ],
  });

  await prisma.diagnosticSubmission.createMany({
    data: [
      {
        id: fixture.currentV1Id,
        assignmentId: fixture.currentAssignmentId,
        version: 1,
        storageKey: `${fixturePrefix}/current-v1.pdf`,
        originalFilename: "current-v1.pdf",
        mimeType: "application/pdf",
        sizeBytes: 101,
        sha256: "1".repeat(64),
        status: "RECEIVED",
        submittedById: fixture.currentUserId,
        createdAt: v1CreatedAt,
        updatedAt: v1CreatedAt,
      },
      {
        id: fixture.currentV2Id,
        assignmentId: fixture.currentAssignmentId,
        version: 2,
        storageKey: `${fixturePrefix}/current-v2.pdf`,
        originalFilename: "current-v2.pdf",
        mimeType: "application/pdf",
        sizeBytes: 202,
        sha256: "2".repeat(64),
        status: "RECEIVED",
        submittedById: fixture.currentUserId,
        reviewNote:
          "Note interne de fixture — ne doit jamais sortir dans la file.",
        createdAt: v2CreatedAt,
        updatedAt: v2CreatedAt,
      },
      {
        id: fixture.rejectedFallbackV1Id,
        assignmentId: fixture.rejectedAssignmentId,
        version: 1,
        storageKey: `${fixturePrefix}/rejected-fallback-v1.pdf`,
        originalFilename: "rejected-fallback-v1.pdf",
        mimeType: "application/pdf",
        sizeBytes: 303,
        sha256: "3".repeat(64),
        status: "RECEIVED",
        submittedById: fixture.rejectedUserId,
        createdAt: v1CreatedAt,
        updatedAt: v1CreatedAt,
      },
      {
        id: fixture.rejectedV2Id,
        assignmentId: fixture.rejectedAssignmentId,
        version: 2,
        storageKey: `${fixturePrefix}/rejected-v2.pdf`,
        originalFilename: "rejected-v2.pdf",
        mimeType: "application/pdf",
        sizeBytes: 404,
        sha256: "4".repeat(64),
        status: "REJECTED",
        submittedById: fixture.rejectedUserId,
        reviewNote: "Version rejetée : conserver le dernier dépôt utilisable.",
        createdAt: v2CreatedAt,
        updatedAt: v2CreatedAt,
      },
    ],
  });

  await prisma.diagnosticSubmissionProcessing.create({
    data: {
      id: fixture.currentProcessingId,
      submissionId: fixture.currentV2Id,
      submissionSha256Snapshot: "2".repeat(64),
      submissionVersionSnapshot: 2,
      subjectVersionSnapshot: "1.0.0",
      status: "EXTRACTED",
    },
  });
  await prisma.diagnosticSubmissionExtraction.create({
    data: {
      id: fixture.currentExtractionId,
      processingId: fixture.currentProcessingId,
      revision: 1,
      status: "SUCCEEDED",
      extractedText: `Contenu académique confidentiel ${CONFIDENTIAL_SENTINEL}`,
      characterCount: 60 + CONFIDENTIAL_SENTINEL.length,
      durationMs: 1,
      totalCharacterCount: 60 + CONFIDENTIAL_SENTINEL.length,
    },
  });
  await prisma.diagnosticBilanDraft.create({
    data: {
      id: fixture.currentDraftId,
      processingId: fixture.currentProcessingId,
      revision: 1,
      extractionId: fixture.currentExtractionId,
      extractionRevisionSnapshot: 1,
      extractionTruncatedSnapshot: false,
      deterministicResults: [] as unknown as Prisma.InputJsonValue,
      humanReview: {
        note: `Note pédagogique interne ${CONFIDENTIAL_SENTINEL}`,
        itemCorrections: [],
      } as Prisma.InputJsonValue,
      status: "DRAFT",
    },
  });
});

test.afterAll(async () => {
  await cleanupFixture().catch(() => undefined);
  await prisma.$disconnect();
});

test("ADMIN sees only each assignment current usable submission, with a PII-minimal queue payload, and opens the canonical detail", async ({
  page,
}) => {
  await loginViaSigninForm(page, "admin");

  const queueResponsePromise = waitForQueueResponse(page);
  await page
    .getByRole("link", { name: "Diagnostics candidats libres", exact: true })
    .click();
  const queueResponse = await queueResponsePromise;
  expect(queueResponse.status()).toBe(200);

  const queueBody: unknown = await queueResponse.json();
  const items = asQueueItems(queueBody);
  const submissionIds = items.map((item) => item.submissionId);

  // These assertions are deliberately soft so the initial RED captures the
  // complete superseded/rejected counter-example in one real browser run.
  expect.soft(submissionIds).not.toContain(fixture.currentV1Id);
  expect.soft(submissionIds).toContain(fixture.currentV2Id);
  expect.soft(submissionIds).toContain(fixture.rejectedFallbackV1Id);
  expect.soft(submissionIds).not.toContain(fixture.rejectedV2Id);

  const currentItem = items.find(
    (item) => item.submissionId === fixture.currentV2Id,
  );
  expect(
    currentItem,
    "the current RECEIVED v2 must be the operational row",
  ).toBeDefined();
  if (!currentItem) throw new Error("CURRENT_V2_MISSING_FROM_QUEUE");
  expect.soft(currentItem.candidate).toEqual({
    id: fixture.currentStudentId,
    firstName: "QueueCurrent",
    lastName: "Candidate",
  });

  const rejectedFallbackItem = items.find(
    (item) => item.submissionId === fixture.rejectedFallbackV1Id,
  );
  expect(
    rejectedFallbackItem,
    "a later REJECTED submission must not supplant the last usable version",
  ).toBeDefined();
  if (!rejectedFallbackItem)
    throw new Error("REJECTED_FALLBACK_V1_MISSING_FROM_QUEUE");
  expect.soft(rejectedFallbackItem.candidate).toEqual({
    id: fixture.rejectedStudentId,
    firstName: "QueueRejectedFallback",
    lastName: "Candidate",
  });

  const serializedQueue = JSON.stringify(queueBody);
  expect.soft(serializedQueue).not.toContain(CONFIDENTIAL_SENTINEL);
  for (const forbiddenKey of [
    "reviewNote",
    "extractedText",
    "deterministicResults",
    "aiProposal",
    "aiProvenance",
    "humanReview",
    "publishedContent",
    "email",
    "phone",
    "accountStatus",
    "activatedAt",
    "sessionVersion",
    "password",
  ]) {
    expect
      .soft(serializedQueue, `queue payload must omit ${forbiddenKey}`)
      .not.toContain(`"${forbiddenKey}"`);
  }

  const actionRequired = page.getByRole("button", {
    name: "Action requise",
    exact: true,
  });
  await expect(actionRequired).toBeVisible();
  await actionRequired.click();
  await expect(actionRequired).toHaveAttribute("aria-pressed", "true");

  // The confidential sentinel belongs to the detail/draft only, never to
  // the operational list, and no historical/rejected version gets a link.
  await expect(
    page.getByText(CONFIDENTIAL_SENTINEL, { exact: false }),
  ).toHaveCount(0);
  await expect
    .soft(page.locator(`a[href$="/${fixture.currentV1Id}"]`))
    .toHaveCount(0);
  await expect
    .soft(page.locator(`a[href$="/${fixture.rejectedV2Id}"]`))
    .toHaveCount(0);

  const currentV2Link = page.locator(
    `a[href="/dashboard/admin/diagnostics-candidat-libre/${fixture.currentV2Id}"]`,
  );
  await expect(currentV2Link).toBeVisible();
  const currentV2Row = currentV2Link.locator("xpath=ancestor::tr");
  await expect(
    currentV2Row.getByText("QueueCurrent Candidate", { exact: true }),
  ).toBeVisible();
  await expect(currentV2Row.getByText("v2", { exact: true })).toBeVisible();

  const rejectedFallbackLink = page.locator(
    `a[href="/dashboard/admin/diagnostics-candidat-libre/${fixture.rejectedFallbackV1Id}"]`,
  );
  await expect(rejectedFallbackLink).toBeVisible();
  await expect(
    rejectedFallbackLink
      .locator("xpath=ancestor::tr")
      .getByText("v1", { exact: true }),
  ).toBeVisible();

  await currentV2Link.click();
  await expect(page).toHaveURL(
    new RegExp(
      `/dashboard/admin/diagnostics-candidat-libre/${fixture.currentV2Id}$`,
    ),
  );
  await expect(
    page.getByRole("heading", { name: "Bilan — candidat libre", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Brouillon", { exact: true })).toBeVisible();
});
