import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

import { loadBilanPack, loadValidatedPack } from '../../lib/bilans/catalog/load-pack'
import {
  computePromptChecksums,
  derivePackApproval,
  loadReviewRegistry,
  sha256,
} from '../../lib/bilans/catalog/review-registry'
import { loadWaveManifest, repositoryPath } from '../../lib/bilans/catalog/wave-manifest'
import { packFeatureFlagName } from '../../lib/bilans/api/pack-access'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''
const mailpitBaseUrl = process.env.MAILPIT_API_URL || 'http://127.0.0.1:8025'
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const packSlug = 'entree-seconde-maths-v1'
const manifestPath = 'data/bilans/banks/wave1.manifest.json'

type MailpitMessage = {
  ID?: string
  id?: string
  To?: Array<{ Address?: string; address?: string }>
  Text?: string
  HTML?: string
}

function assertIsolatedDatabase(): void {
  expect(databaseUrl).toMatch(/(?:localhost|127\.0\.0\.1)/)
  expect(databaseUrl).toMatch(/nexus_p0d_parent_test/)
  expect(databaseUrl).not.toMatch(/nexus_prod|production/i)
}

async function clearMailbox(): Promise<void> {
  const response = await fetch(`${mailpitBaseUrl}/api/v1/messages`, { method: 'DELETE' })
  expect([200, 204]).toContain(response.status)
}

async function waitForActivationUrl(recipient: string): Promise<string> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const response = await fetch(`${mailpitBaseUrl}/api/v1/messages`)
    if (response.ok) {
      const payload = await response.json() as { messages?: MailpitMessage[] }
      const summary = (payload.messages ?? []).find((message) =>
        (message.To ?? []).some((address) => (address.Address ?? address.address) === recipient)
      )
      const id = summary?.ID ?? summary?.id
      if (id) {
        const detailResponse = await fetch(`${mailpitBaseUrl}/api/v1/message/${encodeURIComponent(id)}`)
        const detail = await detailResponse.json() as MailpitMessage
        const content = `${detail.Text ?? ''}\n${detail.HTML ?? ''}`.replaceAll('&amp;', '&')
        const match = content.match(/https?:\/\/[^\s"'<>]+\/auth\/activate\?token=[A-Za-z0-9_-]+&purpose=parent/)
        if (match?.[0]) return match[0]
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('ACTIVATION_EMAIL_NOT_RECEIVED')
}

async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" RESTART IDENTITY CASCADE')
}

async function prepareCanonicalSignedPackReviewer(): Promise<void> {
  const manifest = loadWaveManifest(manifestPath)
  expect(manifest.banks).toHaveLength(manifest.expectedActiveBanks)
  const entry = manifest.banks.find(({ slug }) => slug === packSlug)
  if (!entry) throw new Error('SIGNED_E2E_PACK_NOT_IN_MANIFEST')

  const registry = loadReviewRegistry(packSlug)
  if (!registry) throw new Error('SIGNED_E2E_PACK_REGISTRY_MISSING')
  const sourceChecksum = sha256(readFileSync(repositoryPath(entry.source), 'utf8'))
  const promptChecksums = computePromptChecksums(entry.promptDirectory)

  expect(registry.sourceChecksum).toBe(sourceChecksum)
  expect(registry.promptChecksums).toEqual(promptChecksums)

  await prisma.user.create({
    data: {
      id: 'p0d-e2e-signed-reviewer-user',
      email: 'p0d-signed-reviewer@example.test',
      role: 'COACH',
      activatedAt: new Date(registry.validatedAt),
      coachProfile: {
        create: {
          id: registry.validatedBy,
          pseudonym: 'Reviewer P0D E2E',
          title: registry.qualification,
          subjects: ['MATHEMATIQUES'],
        },
      },
    },
  })

  const resolvedReviewer = await prisma.coachProfile.findUnique({
    where: { id: registry.validatedBy },
    select: { id: true },
  })
  const approval = derivePackApproval({
    slug: packSlug,
    packVersion: registry.packVersion,
    sourceChecksum,
    promptChecksums,
    registry,
    resolvedReviewerIds: new Set(resolvedReviewer ? [resolvedReviewer.id] : []),
  })
  const pack = loadBilanPack(entry.output)
  const validatedPack = loadValidatedPack(entry.output)

  expect(approval.status).toBe('VALIDATED')
  expect(pack.review).toEqual(approval.review)
  expect(validatedPack.review.validatedBy).toBe(registry.validatedBy)
  expect(process.env[packFeatureFlagName(packSlug)]).toBe('true')
}

async function signIn(page: import('@playwright/test').Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/signin')
  await page.getByRole('textbox', { name: 'Adresse Email' }).fill(email)
  await page.getByLabel(/^mot de passe$/i).fill(password)
  await page.getByRole('button', { name: /accéder à mon espace/i }).click()
}

async function signOutAndVerifyCookieDeletion(page: import('@playwright/test').Page): Promise<void> {
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/auth/signout') && response.request().method() === 'POST'
  )
  await page.getByRole('button', { name: 'Se déconnecter de votre compte' }).click()
  const response = await responsePromise
  expect(response.status()).toBe(200)
  expect((await response.headersArray()).some(({ name, value }) =>
    name.toLowerCase() === 'set-cookie' && /authjs\.session-token=;/.test(value)
  )).toBe(true)
  await page.waitForURL((url) => ['/auth/signin', '/'].includes(url.pathname))
  await expect.poll(async () =>
    (await page.context().cookies()).some(({ name }) => name === 'authjs.session-token')
  ).toBe(false)
}

test.describe('P0-D Parent onboarding without direct database bootstrap', () => {
  test.beforeAll(async () => {
    assertIsolatedDatabase()
    await resetDatabase()
    await prepareCanonicalSignedPackReviewer()
    await clearMailbox()
  })

  test.afterAll(async () => {
    await resetDatabase()
    await clearMailbox()
    await prisma.$disconnect()
  })

  test('registers, receives SMTP activation, authenticates Parent and preserves P0-A/B/C', async ({ page }) => {
    const nonce = Date.now()
    const parentEmail = `p0d-browser-parent-${nonce}@example.test`
    const parentPassword = 'ParentSynthetic!2026'
    const childPassword = 'ChildSynthetic!2026'

    await page.goto('/bilan-gratuit')
    const signupForm = page.locator('form').filter({
      has: page.getByRole('button', { name: /lancer le bilan diagnostic/i }),
    })
    await signupForm.getByRole('textbox', { name: 'Prénom du parent' }).fill('Parent')
    await signupForm.getByRole('textbox', { name: 'Nom du parent', exact: true }).fill('Synthétique')
    await signupForm.getByRole('textbox', { name: 'Email', exact: true }).fill(parentEmail)
    await signupForm.getByRole('textbox', { name: 'Téléphone' }).fill('+21699000006')
    await signupForm.getByRole('textbox', { name: /prénom de l’élève/i }).fill('Élève')
    await signupForm.getByRole('combobox', { name: 'Classe' }).selectOption('seconde')
    await signupForm.getByRole('textbox', { name: 'Établissement' }).fill('Établissement synthétique')
    await signupForm.getByRole('checkbox', { name: 'Mathématiques' }).check()
    await signupForm.getByRole('textbox', { name: 'Besoin principal' }).fill('Prouver le parcours Parent sans bootstrap direct en base.')
    await signupForm.getByRole('checkbox', { name: /j’accepte d’être contacté/i }).check()
    await signupForm.getByRole('button', { name: /lancer le bilan diagnostic/i }).click()
    await expect(page).toHaveURL(/\/bilan-gratuit\/confirmation/)

    const parentBeforeActivation = await prisma.user.findUniqueOrThrow({ where: { email: parentEmail } })
    expect(parentBeforeActivation.password).toBeNull()
    expect(parentBeforeActivation.activatedAt).toBeNull()
    const storedHash = parentBeforeActivation.activationToken
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/)

    await signIn(page, parentEmail, parentPassword)
    await expect(page).toHaveURL(/\/auth\/signin/)
    const pendingSession = await page.request.get('/api/auth/session')
    const pendingSessionBody = await pendingSession.json() as { user?: unknown } | null
    expect(pendingSessionBody === null || pendingSessionBody.user == null).toBe(true)

    const parentActivationUrl = await waitForActivationUrl(parentEmail)
    const parentToken = new URL(parentActivationUrl).searchParams.get('token')
    if (!parentToken) throw new Error('PARENT_TOKEN_MISSING')
    expect(createHash('sha256').update(parentToken).digest('hex')).toBe(storedHash)

    await page.goto(parentActivationUrl)
    await expect(page.getByRole('heading', { name: 'Activer votre espace parent' })).toBeVisible()
    await page.getByLabel(/^mot de passe$/i).fill(parentPassword)
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(parentPassword)
    await page.getByRole('button', { name: /activer mon compte/i }).click()
    await expect(page.getByRole('heading', { name: /compte activé/i })).toBeVisible()
    await expect(page).toHaveURL(/\/auth\/signin\?activated=true/, { timeout: 10_000 })

    await page.goto(parentActivationUrl)
    await expect(page.getByRole('heading', { name: /lien invalide/i })).toBeVisible()
    await signIn(page, parentEmail, parentPassword)
    await expect(page).toHaveURL(/\/dashboard\/parent/)

    const parent = await prisma.user.findUniqueOrThrow({
      where: { email: parentEmail },
      include: { parentProfile: { include: { children: { include: { user: true } } } } },
    })
    const child = parent.parentProfile?.children[0]
    expect(child).toBeDefined()
    expect(parent.activatedAt).not.toBeNull()
    expect(parent.activationToken).toBeNull()

    await page.goto(`/dashboard/parent/enfant/${child!.id}`)
    await page.getByRole('checkbox', { name: /consentement explicite/i }).check()
    await page.getByRole('button', { name: /confirmer le rattachement/i }).click()
    await expect(page.getByText(/rattachement vérifié/i)).toBeVisible()

    await page.goto('/dashboard/parent')
    await page.getByRole('button', { name: /activer le compte élève/i }).click()
    const childIdentifier = (await page.getByText(/^[a-z0-9.]+@nexus-student\.local$/).textContent())!
    const childActivationUrl = await page.getByRole('link', { name: /ouvrir l.activation/i }).getAttribute('href')
    if (!childActivationUrl) throw new Error('CHILD_ACTIVATION_LINK_MISSING')
    expect(new URL(childActivationUrl, page.url()).pathname).toBe('/auth/activate')
    await signOutAndVerifyCookieDeletion(page)
    await page.goto(childActivationUrl)
    await expect(page.getByRole('heading', { name: 'Activer votre espace élève' })).toBeVisible()
    await page.getByLabel(/^mot de passe$/i).fill(childPassword)
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(childPassword)
    await page.getByRole('button', { name: /activer mon compte/i }).click()
    await expect(page).toHaveURL(/\/auth\/signin\?activated=true/, { timeout: 10_000 })

    await signIn(page, childIdentifier, childPassword)
    await expect(page).toHaveURL(/\/dashboard\/eleve/)
    expect((await page.request.get('/api/student/dashboard')).status()).toBe(200)
    const attempt = await page.request.post('/api/bilans/attempts', {
      headers: { 'idempotency-key': `p0d-browser-${nonce}` },
      data: { packSlug },
    })
    expect(attempt.status()).toBe(201)
    await signOutAndVerifyCookieDeletion(page)

    await signIn(page, parentEmail, parentPassword)
    await expect(page).toHaveURL(/\/dashboard\/parent/)
    await page.goto(`/dashboard/parent/enfant/${child!.id}`)
    const statusResponse = await page.request.get(`/api/parent/children/${child!.id}/bilans`)
    expect(statusResponse.status()).toBe(200)
    expect(statusResponse.headers()['cache-control']).toContain('no-store')
    const statusBody = await statusResponse.json() as {
      bilans?: Array<{ level?: string; subject?: string; title?: string; status?: string }>
    }
    expect(statusBody.bilans).toEqual([
      expect.objectContaining({
        level: 'SECONDE',
        subject: 'MATHS',
        title: 'Mathématiques · Seconde',
        status: 'DRAFT',
      }),
    ])
    expect(JSON.stringify(statusBody)).not.toContain('/api/student/')

    await signOutAndVerifyCookieDeletion(page)
    const refused = await page.request.get(`/api/parent/children/${child!.id}/bilans`)
    expect(refused.status()).toBe(404)
  })
})
