/**
 * Characterization — parent manual-WhatsApp channel stays correct and stays
 * isolated from student email activation.
 *
 * This suite makes NO production change. It exists because Task 5
 * ("Neutralize generic and stage family writers") touched two email-based
 * activation paths (`app/api/stages/.../confirm/route.ts` and
 * `lib/services/student-activation.service.ts`) that share the same
 * `JobOutbox` table as the WhatsApp channel. It pins down, against the
 * current (already correct) code:
 *
 *  - the parent's identity in WhatsApp mode is their verified phone number,
 *    never an email/password pair the family-creation route makes up;
 *  - staff never sets a parent password;
 *  - manual delivery mode (the default) writes zero WhatsApp/Meta outbox
 *    rows and never calls the WhatsApp invitation enqueue helper;
 *  - the punctual staff-facing wa.me link is `no-store` and returned once
 *    (already exhaustively covered by
 *    `__tests__/api/parent-whatsapp-manual-invitation.route.test.ts` --
 *    referenced, not duplicated, here);
 *  - activation (phone challenge consumption) -> phone login composes
 *    end-to-end through the real production functions;
 *  - the email-based student activation paths touched by Task 5 carry no
 *    reference to the WhatsApp channel at all.
 */

jest.mock('@/lib/email/outbox', () => ({
  enqueueEmailIntent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/whatsapp/invitation-outbox', () => ({
  ...jest.requireActual('@/lib/whatsapp/invitation-outbox'),
  enqueueParentWhatsAppInvitation: jest.fn(),
}));

jest.mock('@/lib/bilans/parent-student-consent', () => ({
  createParentStudentConsentContext: jest.fn(() => ({
    preparePending: jest.fn().mockResolvedValue({ id: 'link-1', state: 'PENDING' }),
  })),
}));

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFamily, inviteParentToComplete } from '@/lib/families/create-family';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { enqueueParentWhatsAppInvitation } from '@/lib/whatsapp/invitation-outbox';
import { consumeParentPhoneChallenge, hashParentPhoneToken, issueParentPhoneChallenge } from '@/lib/auth/parent-phone';
import { authorizeCredentials } from '@/lib/auth/credentials-authorize';
import { prisma } from '@/lib/prisma';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const savedEnv = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...savedEnv };
  delete process.env.WHATSAPP_SEND_ENABLED;
  delete process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY;
});

afterAll(() => {
  process.env = savedEnv;
});

function fakePhoneTransaction(userOverrides: Record<string, unknown> = {}) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'parent-1',
        role: 'PARENT',
        mergedIntoUserId: null,
        phoneNormalized: '99123456',
        parentPhoneVersion: 0,
        parentPhoneState: 'NONE',
        activatedAt: null,
        ...userOverrides,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    parentPhoneChallenge: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'challenge-1', ...data })),
    },
    jobOutbox: { create: jest.fn() },
  };
}

describe('parent manual-WhatsApp channel — identity and outbox isolation', () => {
  it('never enqueues a WhatsApp/Meta outbox row in manual delivery mode (the default)', async () => {
    const tx = fakePhoneTransaction();

    const result = await inviteParentToComplete(tx as any, 'parent-1', new Date('2026-01-01T00:00:00.000Z'));

    expect(result).toEqual({ queued: false, required: true });
    expect(enqueueParentWhatsAppInvitation).not.toHaveBeenCalled();
    expect(tx.jobOutbox.create).not.toHaveBeenCalled();
  });

  it('does queue a WhatsApp outbox row when automatic delivery is explicitly opted into (contrast case)', async () => {
    process.env.WHATSAPP_SEND_ENABLED = 'true';
    process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY = 'x'.repeat(32);
    (enqueueParentWhatsAppInvitation as jest.Mock).mockImplementation(
      jest.requireActual('@/lib/whatsapp/invitation-outbox').enqueueParentWhatsAppInvitation,
    );
    const tx = fakePhoneTransaction();

    const result = await inviteParentToComplete(tx as any, 'parent-1', new Date('2026-01-01T00:00:00.000Z'));

    expect(result).toEqual({ queued: true, required: true });
    expect(tx.jobOutbox.create).toHaveBeenCalledTimes(1);
    expect(tx.jobOutbox.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ jobType: 'WHATSAPP_SEND' }),
    }));
  });

  it('returns early (no reservation, no outbox) for an already-activated parent', async () => {
    const tx = fakePhoneTransaction({ activatedAt: new Date('2025-01-01T00:00:00.000Z') });

    const result = await inviteParentToComplete(tx as any, 'parent-1', new Date('2026-01-01T00:00:00.000Z'));

    expect(result).toEqual({ queued: false, required: false });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.jobOutbox.create).not.toHaveBeenCalled();
  });
});

describe('createFamily() in WHATSAPP mode — phone identity, no staff-set password, no email channel', () => {
  function fakeFamilyTransaction() {
    return {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => ({ id: 'parent-user-1', ...data })),
      },
      parentProfile: { create: jest.fn(async () => ({ id: 'parent-profile-1' })) },
      student: { create: jest.fn(async ({ data }: any) => ({ id: 'student-1', ...data })) },
    };
  }

  const children = [{
    firstName: 'Inès',
    lastName: 'Bernard',
    grade: 'Terminale',
    level: 'TERMINALE',
    track: 'EDS_GENERALE',
  }] as any;

  it("creates the parent with a phone identity and password: null -- staff never sets or sees a password", async () => {
    const tx = fakeFamilyTransaction();

    const result = await createFamily(tx as any, {
      input: { parentFirstName: 'Claire', parentLastName: 'Bernard' } as any,
      children,
      parentEmail: null,
      parentPhone: { display: '99 12 34 56', normalized: '99123456' } as any,
      now: new Date('2026-01-01T00:00:00.000Z'),
      mode: 'WHATSAPP',
      createdByUserId: 'staff-1',
    });

    expect(result.parentCreated).toBe(true);
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        role: 'PARENT',
        email: null,
        phone: '99 12 34 56',
        phoneNormalized: '99123456',
        password: null,
        activatedAt: null,
        activationToken: null,
        activationExpiry: null,
      }),
    }));
  });

  it('never touches the email outbox for the parent or the child in WHATSAPP mode, even with an email supplied', async () => {
    const tx = fakeFamilyTransaction();

    await createFamily(tx as any, {
      input: { parentFirstName: 'Claire', parentLastName: 'Bernard' } as any,
      children,
      parentEmail: 'claire@example.test',
      parentPhone: { display: '99 12 34 56', normalized: '99123456' } as any,
      now: new Date('2026-01-01T00:00:00.000Z'),
      mode: 'WHATSAPP',
      createdByUserId: 'staff-1',
    });

    expect(enqueueEmailIntent).not.toHaveBeenCalled();
    // The child's account is created inactive with no activation token either:
    // WHATSAPP mode never issues an email-based activation link.
    const childCreateCall = tx.user.create.mock.calls.find(([args]: any) => args.data.role === 'ELEVE');
    expect(childCreateCall?.[0].data).toEqual(expect.objectContaining({
      password: null,
      activatedAt: null,
      activationToken: null,
      activationExpiry: null,
    }));
  });
});

describe('email-based student activation (Task 5) stays fully isolated from the WhatsApp channel', () => {
  it('app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts never imports or mentions whatsapp', () => {
    const source = read('app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts');
    expect(source.toLowerCase()).not.toContain('whatsapp');
  });

  it('lib/services/student-activation.service.ts never imports or mentions whatsapp', () => {
    const source = read('lib/services/student-activation.service.ts');
    expect(source.toLowerCase()).not.toContain('whatsapp');
  });

  it('app/api/assistante/activate-student/route.ts never imports or mentions whatsapp', () => {
    const source = read('app/api/assistante/activate-student/route.ts');
    expect(source.toLowerCase()).not.toContain('whatsapp');
  });
});

describe('end-to-end: phone challenge consumption -> phone login', () => {
  it('a parent who sets their own password via the WhatsApp-delivered link can then log in by phone', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const record = {
      id: 'parent-1',
      role: 'PARENT',
      mergedIntoUserId: null,
      phoneNormalized: '99123456',
      parentPhoneVersion: 0,
      parentPhoneState: 'NONE',
      activatedAt: null,
    };
    const issueTx = fakePhoneTransaction(record);
    const challenge = await issueParentPhoneChallenge(issueTx as any, {
      userId: 'parent-1',
      purpose: 'ACTIVATION',
      now,
    });

    // Consuming the challenge: the PARENT supplies their own password here --
    // staff is not in this call path at all.
    let storedPasswordHash: string | undefined;
    const consumeDb = {
      $transaction: jest.fn(async (fn: any) => fn({
        parentPhoneChallenge: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'challenge-1',
            userId: 'parent-1',
            tokenHash: hashParentPhoneToken(challenge.rawToken),
            phoneNormalized: '99123456',
            phoneVersion: 0,
            purpose: 'ACTIVATION',
            expiresAt: new Date(now.getTime() + 3600_000),
            revokedAt: null,
            consumedAt: null,
            user: { ...record, parentPhoneState: 'RESERVED' },
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        user: {
          updateMany: jest.fn().mockImplementation(async ({ data }: any) => {
            storedPasswordHash = data.password;
            return { count: 1 };
          }),
        },
      })),
    };

    const consumeResult = await consumeParentPhoneChallenge(
      challenge.rawToken,
      'MyOwnPassword123!',
      { prisma: consumeDb as any, now },
    );

    expect(consumeResult.success).toBe(true);
    expect(storedPasswordHash).toBeDefined();
    expect(storedPasswordHash).not.toBe('MyOwnPassword123!');

    // Phone login: the same canonical phone number, now VERIFIED, authorizes
    // via the real credentials-authorize path (bcrypt is not mocked here).
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{
      id: 'parent-1',
      email: null,
      role: 'PARENT',
      password: storedPasswordHash,
      activatedAt: now,
      phoneNormalized: '99123456',
      parentPhoneState: 'VERIFIED',
      phoneVerifiedAt: now,
      mergedIntoUserId: null,
      sessionVersion: 1,
    }]);

    const session = await authorizeCredentials({ identifier: '99 12 34 56', password: 'MyOwnPassword123!' });
    expect(session).toEqual(expect.objectContaining({ id: 'parent-1', email: null, role: 'PARENT' }));
  });
});
