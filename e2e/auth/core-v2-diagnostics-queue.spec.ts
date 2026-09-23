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
import {
  expect,
  test,
  type Page,
  type Response as PlaywrightResponse,
} from "@playwright/test";
import { PrismaClient, Prisma } from "@/core-v2/generated/client";
import { z } from "zod";
import { loginViaSigninForm } from "../helpers/auth";

test.describe.configure({ mode: "serial" });

function requireDisposableCoreV2DatabaseUrl(): string {
  if (process.env.E2E_DISPOSABLE_STACK !== "1") {
    throw new Error(
      "CORE_V2_QUEUE_E2E_REFUSED: E2E_DISPOSABLE_STACK=1 is required",
    );
  }

  const rawUrl = process.env.CORE_V2_DATABASE_URL;
  if (!rawUrl) {
    throw new Error(
      "CORE_V2_QUEUE_E2E_REFUSED: CORE_V2_DATABASE_URL is required",
    );
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new Error(
      "CORE_V2_QUEUE_E2E_REFUSED: CORE_V2_DATABASE_URL must be a PostgreSQL URL",
    );
  }

  if (
    target.protocol !== "postgresql:" ||
    target.hostname !== "localhost" ||
    target.port !== "5435" ||
    target.pathname !== "/core_v2_e2e"
  ) {
    throw new Error(
      "CORE_V2_QUEUE_E2E_REFUSED: expected disposable postgresql://localhost:5435/core_v2_e2e target",
    );
  }

  return rawUrl;
}

const coreV2DatabaseUrl = requireDisposableCoreV2DatabaseUrl();
const prisma = new PrismaClient({
  datasources: { db: { url: coreV2DatabaseUrl } },
});
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3002";
const nonce = Date.now();
const fixturePrefix = `e2e-diagnostics-queue-${nonce}`;
const CONFIDENTIAL_SENTINEL = `CONFIDENTIAL-ACADEMIC-DRAFT-${nonce}-MUST-NOT-LEAK`;
const FILLER_COUNT = 21;
const fillerFixtures = Array.from({ length: FILLER_COUNT }, (_, index) => ({
  userId: `${fixturePrefix}-filler-user-${index}`,
  studentId: `${fixturePrefix}-filler-student-${index}`,
  assignmentId: `${fixturePrefix}-filler-assignment-${index}`,
  submissionId: `${fixturePrefix}-filler-submission-${index}`,
  firstName: `QueueFiller${index}`,
}));

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

const queueCandidateSchema = z
  .object({
    id: z.string().min(1),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  })
  .strict();

type QueueCandidate = z.infer<typeof queueCandidateSchema>;

const queueItemSchema = z
  .object({
    submissionId: z.string().min(1),
    state: z.enum([
      "NOT_PROCESSED",
      "PROCESSING",
      "READY_FOR_REVIEW",
      "VALIDATED_UNPUBLISHED",
      "PUBLISHED",
      "FAILED",
    ]),
    candidate: queueCandidateSchema,
    instrument: z
      .object({
        instrumentKey: z.string(),
        version: z.string(),
        title: z.string(),
      })
      .strict(),
    submission: z
      .object({
        version: z.number().int().positive(),
        status: z.enum(["RECEIVED", "READABLE", "ANALYZED", "REJECTED"]),
        createdAt: z.string().datetime({ offset: true }),
      })
      .strict(),
    processingStatus: z
      .enum([
        "QUEUED",
        "EXTRACTING",
        "EXTRACTED",
        "NO_EXTRACTABLE_TEXT",
        "EXTRACTION_FAILED",
      ])
      .nullable(),
    draftStatus: z.enum(["DRAFT", "VALIDATED", "PUBLISHED"]).nullable(),
    lastActivityAt: z.string().datetime({ offset: true }),
  })
  .strict();

const queuePageSchema = z
  .object({
    items: z.array(queueItemSchema),
    nextCursor: z.string().min(1).nullable(),
    listChanged: z.boolean().optional(),
  })
  .strict();

const queueEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    data: queuePageSchema,
  })
  .strict();

type QueueItem = z.infer<typeof queueItemSchema>;
type QueuePage = z.infer<typeof queuePageSchema>;

function parseQueuePage(body: unknown): QueuePage {
  return queueEnvelopeSchema.parse(body).data;
}

async function cleanupFixture(): Promise<void> {
  const assignmentIds = [
    fixture.currentAssignmentId,
    fixture.rejectedAssignmentId,
    ...fillerFixtures.map((item) => item.assignmentId),
  ];
  const studentIds = [
    fixture.currentStudentId,
    fixture.rejectedStudentId,
    ...fillerFixtures.map((item) => item.studentId),
  ];
  const userIds = [
    fixture.currentUserId,
    fixture.rejectedUserId,
    ...fillerFixtures.map((item) => item.userId),
  ];

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
    where: { assignmentId: { in: assignmentIds } },
  });
  await prisma.diagnosticAssignment.deleteMany({
    where: { id: { in: assignmentIds } },
  });
  await prisma.student.deleteMany({
    where: { id: { in: studentIds } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });
  await prisma.household.deleteMany({ where: { id: fixture.householdId } });
  await prisma.diagnosticInstrumentRef.deleteMany({
    where: { id: fixture.instrumentId },
  });
}

async function waitForQueueResponse(
  page: Page,
  status: "ACTION_REQUIRED" | "ALL",
  cursor: string | null = null,
): Promise<PlaywrightResponse> {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      url.pathname === "/api/v2/staff/diagnostics/submissions" &&
      url.searchParams.get("status") === status &&
      url.searchParams.get("cursor") === cursor
    );
  });
}

async function parseSuccessfulQueueResponse(
  response: PlaywrightResponse,
): Promise<QueuePage> {
  expect(response.status()).toBe(200);
  return parseQueuePage(await response.json());
}

async function collectAllActionRequiredPages(
  page: Page,
  firstPage: QueuePage,
): Promise<QueueItem[]> {
  const items: QueueItem[] = [];
  const seenIds = new Set<string>();
  const seenCursors = new Set<string>();
  let currentPage = firstPage;

  for (;;) {
    expect(currentPage.listChanged).not.toBe(true);
    for (const item of currentPage.items) {
      expect(
        seenIds.has(item.submissionId),
        `duplicate queue id across pages: ${item.submissionId}`,
      ).toBe(false);
      seenIds.add(item.submissionId);
      items.push(item);
    }

    const cursor = currentPage.nextCursor;
    if (!cursor) break;
    expect(
      seenCursors.has(cursor),
      "queue pagination must not repeat a cursor",
    ).toBe(false);
    seenCursors.add(cursor);

    const params = new URLSearchParams({
      status: "ACTION_REQUIRED",
      limit: "20",
      cursor,
    });
    const response = await page.request.get(
      `${BASE_URL}/api/v2/staff/diagnostics/submissions?${params.toString()}`,
    );
    expect(response.status()).toBe(200);
    currentPage = parseQueuePage(await response.json());
  }

  return items;
}

test.beforeAll(async () => {
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
      ...fillerFixtures.map((item, index) => ({
        id: item.userId,
        email: `queue-filler-${nonce}-${index}@confidential.example.test`,
        phone: `+2160001${String(index).padStart(4, "0")}`,
        role: "ELEVE" as const,
        firstName: item.firstName,
        lastName: "Candidate",
        accountStatus: "ACTIVE" as const,
        activatedAt: new Date("2026-09-01T10:00:00.000Z"),
      })),
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
      ...fillerFixtures.map((item) => ({
        id: item.studentId,
        userId: item.userId,
        householdId: fixture.householdId,
      })),
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
      ...fillerFixtures.map((item) => ({
        id: item.assignmentId,
        studentId: item.studentId,
        ...assignmentSnapshot,
      })),
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
      ...fillerFixtures.map((item, index) => {
        const createdAt = new Date(v1CreatedAt.getTime() + index * 60_000);
        return {
          id: item.submissionId,
          assignmentId: item.assignmentId,
          version: 1,
          storageKey: `${fixturePrefix}/filler-${index}.pdf`,
          originalFilename: `filler-${index}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: 500 + index,
          sha256: String((index % 9) + 1).repeat(64),
          status: "RECEIVED" as const,
          submittedById: item.userId,
          createdAt,
          updatedAt: createdAt,
        };
      }),
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
  try {
    await cleanupFixture();
  } finally {
    await prisma.$disconnect();
  }
});

test("ADMIN sees only each assignment current usable submission, with a PII-minimal queue payload, and opens the canonical detail", async ({
  page,
}) => {
  await loginViaSigninForm(page, "admin");

  const initialQueueResponsePromise = waitForQueueResponse(
    page,
    "ACTION_REQUIRED",
  );
  await page
    .getByRole("link", { name: "Diagnostics candidats libres", exact: true })
    .click();
  const initialQueueResponse = await initialQueueResponsePromise;
  expect(initialQueueResponse.status()).toBe(200);

  const allResponsePromise = waitForQueueResponse(page, "ALL");
  await page.getByRole("button", { name: "Tous", exact: true }).click();
  const allResponse = await allResponsePromise;
  expect(allResponse.status()).toBe(200);
  await expect(
    page.getByRole("button", { name: "Tous", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  const actionRequired = page.getByRole("button", {
    name: "Action requise",
    exact: true,
  });
  const queueResponsePromise = waitForQueueResponse(page, "ACTION_REQUIRED");
  await actionRequired.click();
  const queueResponse = await queueResponsePromise;
  await expect(actionRequired).toHaveAttribute("aria-pressed", "true");

  // Validate every field of every returned item. All nested objects are
  // strict, so adding storage metadata, submitter ids, hashes, filenames or
  // any other unapproved field fails this boundary proof immediately.
  parseQueuePage(await initialQueueResponse.json());
  parseQueuePage(await allResponse.json());
  const firstActionRequiredPage = await parseSuccessfulQueueResponse(
    queueResponse,
  );
  const items = await collectAllActionRequiredPages(
    page,
    firstActionRequiredPage,
  );
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
  const expectedCurrentCandidate: QueueCandidate = {
    id: fixture.currentStudentId,
    firstName: "QueueCurrent",
    lastName: "Candidate",
  };
  expect.soft(currentItem.candidate).toEqual(expectedCurrentCandidate);

  const rejectedFallbackItem = items.find(
    (item) => item.submissionId === fixture.rejectedFallbackV1Id,
  );
  expect(
    rejectedFallbackItem,
    "a later REJECTED submission must not supplant the last usable version",
  ).toBeDefined();
  if (!rejectedFallbackItem)
    throw new Error("REJECTED_FALLBACK_V1_MISSING_FROM_QUEUE");
  const expectedRejectedFallbackCandidate: QueueCandidate = {
    id: fixture.rejectedStudentId,
    firstName: "QueueRejectedFallback",
    lastName: "Candidate",
  };
  expect
    .soft(rejectedFallbackItem.candidate)
    .toEqual(expectedRejectedFallbackCandidate);

  const serializedQueue = JSON.stringify(items);
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

  // Exercise the client's own pagination too. The fixture has more than the
  // UI page size, so at least one real "Afficher plus" request is mandatory.
  let uiCursor = firstActionRequiredPage.nextCursor;
  const seenUiCursors = new Set<string>();
  let uiAdditionalPageCount = 0;
  while (uiCursor) {
    expect(
      seenUiCursors.has(uiCursor),
      "UI queue pagination must not repeat a cursor",
    ).toBe(false);
    seenUiCursors.add(uiCursor);

    const loadMore = page.getByRole("button", {
      name: "Afficher plus",
      exact: true,
    });
    await expect(loadMore).toBeVisible();
    const nextUiResponsePromise = waitForQueueResponse(
      page,
      "ACTION_REQUIRED",
      uiCursor,
    );
    await loadMore.click();
    const nextUiPage = await parseSuccessfulQueueResponse(
      await nextUiResponsePromise,
    );
    expect(nextUiPage.listChanged).not.toBe(true);
    uiCursor = nextUiPage.nextCursor;
    uiAdditionalPageCount += 1;
  }
  expect(uiAdditionalPageCount).toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "Afficher plus", exact: true }),
  ).toHaveCount(0);

  const detailLinks = page.locator(
    'a[href^="/dashboard/admin/diagnostics-candidat-libre/"]',
  );
  const uiSubmissionIds = (await detailLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")?.split("/").pop() ?? ""),
  )).filter(Boolean);
  expect(new Set(uiSubmissionIds).size).toBe(uiSubmissionIds.length);
  expect([...uiSubmissionIds].sort()).toEqual([...submissionIds].sort());

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
