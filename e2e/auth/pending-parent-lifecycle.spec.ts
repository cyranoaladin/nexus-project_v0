import { createHash } from 'node:crypto'

import { expect, test } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

import {
  inventoryPendingParentAccounts,
  processPendingParentPlan,
  type PendingLifecycleAction,
} from '../../lib/auth/pending-account-lifecycle'
import { assertDisposableE2eDatabase } from '../helpers/disposable-database'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? ''
const mailpitBaseUrl = process.env.MAILPIT_API_URL ?? 'http://127.0.0.1:8025'
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const planSecret = 's2-e2e-plan-secret-at-least-32-bytes-long'
const environmentId = 's2-e2e'

function assertIsolatedDatabase() {
  assertDisposableE2eDatabase(databaseUrl)
}

async function clearMailbox() {
  await fetch(`${mailpitBaseUrl}/api/v1/messages`, { method: 'DELETE' })
}

async function receivedActivationUrls(recipient: string): Promise<readonly string[]> {
  const response = await fetch(`${mailpitBaseUrl}/api/v1/messages`)
  const payload = await response.json() as { messages?: Array<{ ID?: string; To?: Array<{ Address?: string }> }> }
  const urls: string[] = []
  for (const summary of payload.messages ?? []) {
    if (!summary.ID || !(summary.To ?? []).some(({ Address }) => Address === recipient)) continue
    const detail = await fetch(`${mailpitBaseUrl}/api/v1/message/${summary.ID}`)
    const message = await detail.json() as { Text?: string; HTML?: string }
    const content = `${message.Text ?? ''}\n${message.HTML ?? ''}`.replaceAll('&amp;', '&')
    const match = content.match(/https?:\/\/[^\s"'<>]+\/auth\/activate\?token=[A-Za-z0-9_-]+&purpose=parent/)
    if (match) urls.push(match[0])
  }
  return urls
}

async function waitForActivationUrls(recipient: string, expected: number): Promise<readonly string[]> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const urls = await receivedActivationUrls(recipient)
    if (urls.length >= expected) return urls
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('ACTIVATION_EMAIL_NOT_RECEIVED')
}

async function submitPublicSignup(page: import('@playwright/test').Page, email: string) {
  await page.goto('/bilan-gratuit')
  const form = page.locator('form').filter({
    has: page.getByRole('button', { name: /créer mon espace/i }),
  })
  await form.getByRole('textbox', { name: 'Prénom du parent' }).fill('Parent')
  await form.getByRole('textbox', { name: 'Nom du parent', exact: true }).fill('Lifecycle')
  await form.getByRole('textbox', { name: 'Email', exact: true }).fill(email)
  await form.getByRole('textbox', { name: 'Téléphone' }).fill('+21699000008')
  await form.getByRole('textbox', { name: /prénom de l’élève/i }).fill('Élève')
  await form.getByRole('combobox', { name: 'Classe' }).selectOption('seconde')
  await form.getByRole('checkbox', { name: /j’accepte d’être contacté/i }).check()
  await form.getByRole('button', { name: /créer mon espace/i }).click()
  await expect(page).toHaveURL(/\/bilan-gratuit\/confirmation/)
}

async function applyLifecycleAction(action: PendingLifecycleAction, now = new Date()) {
  const context = { now, batchSize: 100, planSecret, environmentId }
  const inventory = await inventoryPendingParentAccounts(prisma, context)
  const plan = inventory.plans.find((candidate) => candidate.action === action)
  if (!plan) throw new Error(`PENDING_PLAN_NOT_FOUND_${action}`)
  return processPendingParentPlan(prisma, { ...context, plan })
}

test.describe('S2 pending Parent lifecycle', () => {
  test.beforeAll(async () => {
    assertIsolatedDatabase()
    await clearMailbox()
  })

  test.afterAll(async () => {
    await clearMailbox()
    await prisma.$disconnect()
  })

  test('reconciles legacy ownership, refuses protected purge and activates through a reissued email', async ({ page }) => {
    const nonce = Date.now()
    const email = `s2-browser-${nonce}@example.test`
    const password = 'ParentSynthetic!2026'
    await submitPublicSignup(page, email)

    const [firstUrl] = await waitForActivationUrls(email, 1)
    expect(firstUrl).toBeTruthy()
    const firstToken = new URL(firstUrl!).searchParams.get('token')!
    const parent = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { parentProfile: { include: { children: true } } },
    })
    const student = parent.parentProfile!.children[0]!

    await prisma.parentStudentLink.deleteMany({ where: { parentUserId: parent.id, studentId: student.id } })
    const reconciliation = await applyLifecycleAction('RECONCILE_LINK')
    expect(reconciliation.reconciledLinks).toBe(1)
    expect(await prisma.parentStudentLink.count({ where: { parentUserId: parent.id, studentId: student.id } })).toBe(1)

    const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000)
    await prisma.user.update({
      where: { id: parent.id },
      data: { createdAt: oldDate, activationExpiry: new Date(Date.now() - 60_000) },
    })
    await prisma.canonicalAssessmentAttempt.create({
      data: {
        studentId: student.id,
        seed: 's2-browser-seed', expiresAt: new Date(Date.now() + 60_000),
        subject: 'MATHEMATIQUES', gradeLevel: 'SECONDE', answers: {},
        curriculumId: 's2', curriculumVersion: '1', assessmentPackId: 's2-pack',
        assessmentPackVersion: '1', assessmentPackChecksum: 's2-checksum',
        scoringPolicyId: 's2-score', scoringPolicyVersion: '1',
      },
    })
    const attemptsBefore = await prisma.canonicalAssessmentAttempt.count({ where: { studentId: student.id } })
    const refusedPurge = await inventoryPendingParentAccounts(prisma, {
      now: new Date(), batchSize: 100, planSecret, environmentId,
    })
    expect(refusedPurge.decisions.HUMAN_REVIEW_REQUIRED).toBeGreaterThanOrEqual(1)
    expect(await prisma.user.findUnique({ where: { id: parent.id } })).not.toBeNull()
    expect(await prisma.canonicalAssessmentAttempt.count({ where: { studentId: student.id } })).toBe(attemptsBefore)

    await page.goto('/auth/signin')
    const resend = await page.evaluate(async (recipient) => {
      const response = await fetch('/api/auth/resend-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recipient }),
      })
      return { status: response.status, body: await response.json() }
    }, email)
    expect(resend.status).toBe(200)
    expect(JSON.stringify(resend.body)).not.toMatch(/token|\/auth\/activate/i)

    const urls = await waitForActivationUrls(email, 2)
    const secondUrl = urls.find((url) => url !== firstUrl)
    expect(secondUrl).toBeTruthy()
    const secondToken = new URL(secondUrl!).searchParams.get('token')!
    const pending = await prisma.user.findUniqueOrThrow({ where: { id: parent.id } })
    expect(pending.activationToken).toBe(createHash('sha256').update(secondToken).digest('hex'))
    expect(pending.activationToken).not.toBe(createHash('sha256').update(firstToken).digest('hex'))

    await page.goto(firstUrl!)
    await expect(page.getByRole('heading', { name: /lien invalide/i })).toBeVisible()
    await page.goto(secondUrl!)
    await page.getByLabel(/^mot de passe$/i).fill(password)
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(password)
    await page.getByRole('button', { name: /activer mon compte/i }).click()
    await expect(page).toHaveURL(/\/auth\/signin\?activated=true/)

    await page.getByRole('textbox', { name: 'Adresse Email' }).fill(email)
    await page.getByLabel(/^mot de passe$/i).fill(password)
    await page.getByRole('button', { name: /accéder à mon espace/i }).click()
    await expect(page).toHaveURL(/\/dashboard\/parent/)
    await expect(page.getByText(/Élève/).first()).toBeVisible()
  })
})
