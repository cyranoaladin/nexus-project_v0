/**
 * P0-D Parent onboarding against isolated PostgreSQL 15 and a real local SMTP server.
 * The raw activation token is obtained only from the captured email.
 *
 * Amendement 7 (Task 4): `POST /api/bilan-gratuit` only captures a
 * `FamilyRequest` now -- it creates no account and sends no e-mail. The real
 * SMTP delivery, reissue and failure-recovery semantics this suite protects
 * only happen once a staff (ADMIN/ASSISTANTE) member converts that request
 * via `POST /api/assistante/family-requests/[requestId]/convert`, which
 * calls `createFamily()`. Every assertion below about delivery, token
 * hashing, reissue invalidation and crash-recovery still applies to that
 * real account and its real e-mail -- only the step that creates the
 * account (submit, then convert) changed.
 */

jest.unmock('@/lib/prisma')
jest.unmock('@/lib/email/mailer')
jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardRateLimit: jest.fn().mockReturnValue(null),
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
  hashForKey: jest.fn(() => 'synthetic-account-hash'),
}))

import { createHash } from 'node:crypto'

import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'

import { POST as resendActivation } from '@/app/api/auth/resend-activation/route'
import { POST as registerBilan } from '@/app/api/bilan-gratuit/route'
import { POST as convertFamilyRequest } from '@/app/api/assistante/family-requests/[requestId]/convert/route'
import { POST as activateAccount } from '@/app/api/auth/activate/route'
import { auth } from '@/auth'
import { resetTransporter } from '@/lib/email/mailer'
import { drainEmailOutbox } from '@/lib/email/outbox-worker'
import { prisma } from '@/lib/prisma'
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres'

const PREFIX = 'p0d-real-parent-'
const mailpitBaseUrl = process.env.MAILPIT_API_URL || 'http://127.0.0.1:8025'
const configuredSmtpPort = process.env.SMTP_PORT || '1025'

let staffUserId: string

type MailpitAddress = { Address?: string; address?: string }
type MailpitMessage = {
  ID?: string
  id?: string
  To?: MailpitAddress[]
  From?: MailpitAddress
  Subject?: string
  Text?: string
  HTML?: string
  MessageID?: string
  Bcc?: MailpitAddress[]
}

function assertIsolatedDatabase(): void {
  const target = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''
  assertDisposablePostgresUrl(target)
}

function secureHeaders(response: Response): void {
  expect(response.headers.get('Cache-Control')).toContain('no-store')
  expect(response.headers.get('Pragma')).toBe('no-cache')
  expect(response.headers.get('Expires')).toBe('0')
}

function registrationRequest(email: string, suffix: string): NextRequest {
  return new NextRequest('http://localhost:3211/api/bilan-gratuit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3211',
      Host: 'attacker.example',
      'X-Forwarded-Host': 'attacker.example',
    },
    body: JSON.stringify({
      parentFirstName: 'Parent',
      parentLastName: `Synthetique ${suffix}`,
      parentEmail: email,
      parentPhone: '+21699000005',
      studentFirstName: 'Eleve',
      studentLastName: `Synthetique ${suffix}`,
      studentGrade: 'Seconde',
      studentSchool: 'Etablissement synthetique',
      subjects: ['MATHEMATIQUES'],
      objectives: 'Prouver le transport SMTP reel dans un environnement isole.',
      acceptTerms: true,
    }),
  })
}

function convertRequest(requestId: string): NextRequest {
  return new NextRequest(`http://localhost:3211/api/assistante/family-requests/${requestId}/convert`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:3211' },
  })
}

function resendRequest(email: string): NextRequest {
  return new NextRequest('http://attacker.example/api/auth/resend-activation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Host: 'attacker.example',
      'X-Forwarded-Host': 'attacker.example',
    },
    body: JSON.stringify({ email }),
  })
}

function activationRequest(token: string, password: string): NextRequest {
  return new NextRequest('http://localhost:3211/api/auth/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purpose: 'parent', token, password }),
  })
}

async function clearMailbox(): Promise<void> {
  const response = await fetch(`${mailpitBaseUrl}/api/v1/messages`, { method: 'DELETE' })
  expect([200, 204]).toContain(response.status)
}

async function listMessages(): Promise<MailpitMessage[]> {
  const response = await fetch(`${mailpitBaseUrl}/api/v1/messages`)
  expect(response.status).toBe(200)
  const payload = await response.json() as { messages?: MailpitMessage[] }
  return payload.messages ?? []
}

// Le sujet distingue l'e-mail d'activation PARENT ("Activez votre espace
// parent...", envoyé une seule fois par createFamily() au moment de la
// conversion) de l'e-mail d'activation ÉLÈVE que la même conversion envoie
// -- au même destinataire, faute d'adresse dédiée pour un enfant mineur
// (voir createChildren() dans lib/families/create-family.ts, sujet
// générique "Activation de votre compte..."). Sans ce filtre, une conversion
// qui vient de créer le foyer laisse deux messages dans la même boîte, et le
// premier arrivé n'est pas garanti être celui du parent.
const PARENT_ACTIVATION_SUBJECT = 'espace parent'

async function waitForMessage(
  recipient: string,
  minimumCount = 1,
  subjectContains?: string,
): Promise<MailpitMessage> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const messages = await listMessages()
    const matching = messages.filter((message) =>
      (message.To ?? []).some((address) => (address.Address ?? address.address) === recipient)
      && (subjectContains === undefined || (message.Subject ?? '').includes(subjectContains))
    )
    if (matching.length >= minimumCount) {
      const selected = matching[0]
      const id = selected.ID ?? selected.id
      if (!id) throw new Error('MAILPIT_MESSAGE_ID_MISSING')
      const detail = await fetch(`${mailpitBaseUrl}/api/v1/message/${encodeURIComponent(id)}`)
      expect(detail.status).toBe(200)
      return await detail.json() as MailpitMessage
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('MAILPIT_MESSAGE_NOT_RECEIVED')
}

function activationTokenFromMessage(message: MailpitMessage): string {
  const content = `${message.Text ?? ''}\n${message.HTML ?? ''}`.replaceAll('&amp;', '&')
  const match = content.match(/https?:\/\/[^\s"'<>]+\/auth\/activate\?token=([A-Za-z0-9_-]+)/)
  if (!match?.[1]) throw new Error('ACTIVATION_LINK_MISSING_FROM_EMAIL')
  return match[1]
}

async function resetDatabase(): Promise<void> {
  // canonical_job_outbox has no FK to users, so truncating users alone
  // leaves behind any job enqueued by a previous run that was never
  // drained (e.g. before EMAIL_OUTBOX_WORKER_ENABLED was set here). Since
  // these tests reuse fixed email addresses across runs, a stale leftover
  // job would be drained alongside the fresh one and Mailpit would receive
  // an extra message with an outdated activation token.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "canonical_job_outbox" RESTART IDENTITY CASCADE')
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "family_requests" RESTART IDENTITY CASCADE')
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" RESTART IDENTITY CASCADE')
}

/**
 * Soumet un bilan gratuit public (Amendement 7 : ne crée qu'une
 * FamilyRequest) puis la fait convertir par le staff -- c'est cette
 * conversion qui crée réellement le compte parent+enfant et enqueue l'e-mail
 * d'activation parent, exactement comme le faisait autrefois l'inscription
 * directe.
 */
async function registerAndConvert(email: string, suffix: string): Promise<Response> {
  (auth as jest.Mock).mockResolvedValue(null)
  const registration = await registerBilan(registrationRequest(email, suffix))
  if (registration.status !== 200) return registration

  const familyRequest = await prisma.familyRequest.findFirstOrThrow({
    where: { contactEmail: email, status: 'SUBMITTED' },
    orderBy: { createdAt: 'desc' },
  })
  ;(auth as jest.Mock).mockResolvedValue({ user: { id: staffUserId, role: 'ASSISTANTE' } })
  const conversion = await convertFamilyRequest(
    convertRequest(familyRequest.id),
    { params: Promise.resolve({ requestId: familyRequest.id }) },
  )
  expect(conversion.status).toBe(200)
  return registration
}

describe('P0-D Parent onboarding with real PostgreSQL and SMTP', () => {
  // waitForMessage() polls Mailpit for up to 10s per call, and several tests
  // below call it multiple times in sequence -- comfortably above jest's
  // default 5s per-test timeout, which is why every test here always timed
  // out (masked until now by the database-naming gate blocking this file
  // from ever actually running).
  jest.setTimeout(30_000)

  beforeAll(async () => {
    assertIsolatedDatabase()
    process.env.NEXTAUTH_URL = 'http://127.0.0.1:3211'
    process.env.MAIL_DISABLED = 'false'
    process.env.SMTP_HOST = '127.0.0.1'
    process.env.SMTP_PORT = configuredSmtpPort
    process.env.SMTP_SECURE = 'false'
    process.env.MAIL_FROM = 'Nexus Test <no-reply@p0d.invalid>'
    // registerAndConvert()'s conversion step only *enqueues* the activation
    // email (see enqueueEmailIntent in createFamily(),
    // lib/families/create-family.ts) -- actual SMTP delivery only happens if
    // kickEmailOutboxDrain() finds the worker enabled
    // (lib/email/outbox-scheduler.ts). Without this, the job sits in the
    // outbox forever and Mailpit never receives anything, which is why
    // every test below always timed out waiting for a message that was
    // never going to be sent.
    process.env.EMAIL_OUTBOX_WORKER_ENABLED = 'true'
    resetTransporter()
    await resetDatabase()
    await clearMailbox()
    const staff = await prisma.user.create({
      data: { role: 'ASSISTANTE', firstName: 'StaffActor', lastName: 'OnboardingSuite' },
      select: { id: true },
    })
    staffUserId = staff.id
  })

  beforeEach(async () => {
    await clearMailbox()
  })

  afterAll(async () => {
    await resetDatabase()
    await clearMailbox()
    resetTransporter()
    await prisma.$disconnect()
  })

  it('delivers, activates once, hashes the password and creates no duplicate or bilan job', async () => {
    const email = `${PREFIX}nominal@example.test`
    const password = 'ParentSynthetic!2026'
    const before = {
      users: await prisma.user.count(),
      students: await prisma.student.count(),
      attempts: await prisma.canonicalAssessmentAttempt.count(),
      outbox: await prisma.jobOutbox.count(),
    }

    const registration = await registerAndConvert(email, 'Nominal')
    const publicBody = await registration.json()
    expect(registration.status).toBe(200)
    expect(publicBody).toEqual(expect.objectContaining({ success: true }))
    expect(publicBody).not.toHaveProperty('parentId')
    expect(publicBody).not.toHaveProperty('studentId')
    expect(JSON.stringify(publicBody)).not.toContain('token')
    secureHeaders(registration)

    const message = await waitForMessage(email, 1, PARENT_ACTIVATION_SUBJECT)
    const token = activationTokenFromMessage(message)
    expect(message.Subject).toBeTruthy()
    expect(message.MessageID).toBeTruthy()
    expect((message.To ?? []).map((item) => item.Address ?? item.address)).toEqual([email])
    expect(message.Bcc ?? []).toHaveLength(0)
    expect(message.Text).toBeTruthy()
    expect(message.HTML).toBeTruthy()
    expect(`${message.Text ?? ''}${message.HTML ?? ''}`).not.toMatch(/mot de passe temporaire/i)
    expect(`${message.Text ?? ''}${message.HTML ?? ''}`).not.toContain('attacker.example')

    const parent = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { parentProfile: { include: { children: true } } },
    })
    expect(parent.role).toBe('PARENT')
    expect(parent.activatedAt).toBeNull()
    expect(parent.password).toBeNull()
    expect(parent.activationToken).toBe(createHash('sha256').update(token).digest('hex'))
    expect(parent.activationToken).not.toContain(token)
    expect(parent.parentProfile?.children).toHaveLength(1)
    expect(await prisma.user.count({ where: { email } })).toBe(1)

    // Une resoumission du même bilan gratuit capture une seconde
    // FamilyRequest (Amendement 7 : chaque soumission est préservée pour le
    // staff), mais tant qu'elle n'est pas convertie, elle ne crée ni compte
    // ni élève supplémentaire -- la garantie « pas de doublon sur simple
    // resoumission » tient toujours, à l'entrée publique.
    const duplicate = await registerBilan(registrationRequest(email, 'Nominal'))
    expect(duplicate.status).toBe(200)
    expect(await duplicate.json()).toEqual(publicBody)
    expect(await prisma.user.count({ where: { email } })).toBe(1)
    expect(await prisma.student.count()).toBe(before.students + 1)

    const [first, second] = await Promise.all([
      activateAccount(activationRequest(token, password)),
      activateAccount(activationRequest(token, password)),
    ])
    expect([first.status, second.status].sort()).toEqual([200, 400])
    for (const response of [first, second]) secureHeaders(response)

    const activated = await prisma.user.findUniqueOrThrow({ where: { email } })
    expect(activated.activatedAt).toBeInstanceOf(Date)
    expect(activated.activationToken).toBeNull()
    expect(activated.activationExpiry).toBeNull()
    expect(await bcrypt.compare(password, activated.password!)).toBe(true)
    expect(activated.password).not.toBe(password)
    expect((await activateAccount(activationRequest(token, password))).status).toBe(400)
    expect(await prisma.canonicalAssessmentAttempt.count()).toBe(before.attempts)
    // The registration+conversion above enqueues exactly two email jobs --
    // one parent-activation job and one student-activation job for the
    // single child created alongside the parent (see createChildren() inside
    // createFamily(), lib/families/create-family.ts) -- and a COMPLETED job
    // is kept as an audit record rather than deleted -- only
    // maintainEmailOutbox()'s retention sweep (run on a long interval, see
    // lib/email/outbox-scheduler.ts) removes it. So the correct expectation
    // right after delivery is +2, never back to the baseline.
    expect(await prisma.jobOutbox.count()).toBe(before.outbox + 2)
    expect(await prisma.user.count()).toBe(before.users + 2)
  })

  it('revokes the old token on reissue and permits one concurrent delivery', async () => {
    const email = `${PREFIX}reissue@example.test`
    await registerAndConvert(email, 'Reissue')
    const original = activationTokenFromMessage(await waitForMessage(email, 1, PARENT_ACTIVATION_SUBJECT))
    await clearMailbox()

    const responses = await Promise.all([
      resendActivation(resendRequest(email)),
      resendActivation(resendRequest(email)),
    ])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    // kickEmailOutboxDrain() is fire-and-forget (see
    // lib/email/outbox-scheduler.ts) -- the route responds before SMTP
    // delivery necessarily completes, so the message must be *waited for*,
    // never snapshotted synchronously right after the requests resolve.
    // Exactly one of the two concurrent resends wins the optimistic-
    // concurrency update in the route (the other's updateMany matches zero
    // rows and never enqueues), so once the winner's message has arrived,
    // no second one is ever coming.
    const replacement = activationTokenFromMessage(await waitForMessage(email))
    expect(replacement).not.toBe(original)
    const messages = await listMessages()
    expect(messages.filter((message) =>
      (message.To ?? []).some((address) => (address.Address ?? address.address) === email)
    )).toHaveLength(1)
    await clearMailbox()
    expect((await resendActivation(resendRequest(email))).status).toBe(200)
    const finalToken = activationTokenFromMessage(await waitForMessage(email))
    expect(finalToken).not.toBe(replacement)
    expect((await activateAccount(activationRequest(original, 'ParentSynthetic!2026'))).status).toBe(400)
    expect((await activateAccount(activationRequest(replacement, 'ParentSynthetic!2026'))).status).toBe(400)
    expect((await activateAccount(activationRequest(finalToken, 'ParentSynthetic!2026'))).status).toBe(200)
  })

  it('keeps a failed SMTP registration pending and recovers by reissue without duplication', async () => {
    const email = `${PREFIX}smtp-recovery@example.test`
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    process.env.SMTP_PORT = '1'
    process.env.SMTP_CONNECTION_TIMEOUT_MS = '300'
    resetTransporter()

    ;(auth as jest.Mock).mockResolvedValue(null)
    const registration = await registerBilan(registrationRequest(email, 'Recovery'))
    expect(registration.status).toBe(200)
    const familyRequest = await prisma.familyRequest.findFirstOrThrow({
      where: { contactEmail: email, status: 'SUBMITTED' },
      orderBy: { createdAt: 'desc' },
    })
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: staffUserId, role: 'ASSISTANTE' } })
    const conversion = await convertFamilyRequest(
      convertRequest(familyRequest.id),
      { params: Promise.resolve({ requestId: familyRequest.id }) },
    )
    // The account graph is created atomically by createFamily() -- entirely
    // independent of, and committed before, any SMTP attempt -- so the
    // conversion itself always succeeds even though delivery is about to
    // fail.
    expect(conversion.status).toBe(200)
    // The conversion route's own kickEmailOutboxDrain() is fire-and-forget,
    // so without waiting for it here the "0 messages" check below would
    // only prove delivery hasn't happened *yet*, not that it genuinely
    // failed -- and the still in-flight attempt could later resolve
    // concurrently with the resend's own drain, racing to deliver this
    // job's pre-reissue token instead of (or alongside) the resend's fresh
    // one. Draining synchronously here forces the failed attempt to fully
    // settle (job A -> RETRY_SCHEDULED, several seconds in the future)
    // before the resend ever creates job B, so the two can never overlap.
    await drainEmailOutbox()
    const pending = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { parentProfile: { include: { children: true } } },
    })
    expect(pending.activatedAt).toBeNull()
    expect(pending.parentProfile?.children).toHaveLength(1)
    expect((await listMessages()).filter((message) =>
      (message.To ?? []).some((address) => (address.Address ?? address.address) === email)
    )).toHaveLength(0)
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(email)

    process.env.SMTP_PORT = configuredSmtpPort
    delete process.env.SMTP_CONNECTION_TIMEOUT_MS
    resetTransporter()
    await resendActivation(resendRequest(email))
    // Job A (the failed conversion's activation attempt) is now
    // RETRY_SCHEDULED with availableAt several seconds out (see
    // retryDelayMs in lib/email/outbox-worker.ts), so this drain can only
    // ever claim job B (the resend) -- it cannot race with or resurrect job
    // A's now-revoked token.
    await drainEmailOutbox()
    const token = activationTokenFromMessage(await waitForMessage(email))
    expect((await activateAccount(activationRequest(token, 'ParentSynthetic!2026'))).status).toBe(200)
    expect(await prisma.user.count({ where: { email } })).toBe(1)
    consoleError.mockRestore()
  })
})
