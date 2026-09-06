import { expect, test } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { assertDisposableE2eDatabase } from '../helpers/disposable-database'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''
const mailpitBaseUrl = process.env.MAILPIT_API_URL || 'http://127.0.0.1:8025'
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })

function assertIsolatedDatabase() {
  assertDisposableE2eDatabase(databaseUrl)
}

async function activationUrl(recipient: string) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const list = await fetch(`${mailpitBaseUrl}/api/v1/messages`)
    const payload = await list.json() as { messages?: Array<{ ID?: string; To?: Array<{ Address?: string }> }> }
    const summary = (payload.messages ?? []).find((message) =>
      (message.To ?? []).some(({ Address }) => Address === recipient),
    )
    if (summary?.ID) {
      const detail = await fetch(`${mailpitBaseUrl}/api/v1/message/${summary.ID}`)
      const message = await detail.json() as { Text?: string; HTML?: string }
      const content = `${message.Text ?? ''}\n${message.HTML ?? ''}`.replaceAll('&amp;', '&')
      const match = content.match(/https?:\/\/[^\s"'<>]+\/auth\/activate\?token=[A-Za-z0-9_-]+&purpose=parent/)
      if (match) return match[0]
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('ACTIVATION_EMAIL_NOT_RECEIVED')
}

async function signIn(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/auth/signin')
  await page.getByRole('textbox', { name: 'Téléphone WhatsApp ou email', exact: true }).fill(email)
  await page.getByLabel(/^mot de passe$/i).fill(password)
  await page.getByRole('button', { name: /accéder à mon espace/i }).click()
}

async function revokeCurrentSession(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/auth/sessions/revoke', { method: 'POST' })
    return { status: response.status, body: await response.json() }
  })
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

test.describe('S1 versioned JWT revocation', () => {
  test.beforeAll(async () => {
    assertIsolatedDatabase()
    await fetch(`${mailpitBaseUrl}/api/v1/messages`, { method: 'DELETE' })
  })

  test.afterAll(async () => {
    await fetch(`${mailpitBaseUrl}/api/v1/messages`, { method: 'DELETE' })
    await prisma.$disconnect()
  })

  test('revokes Parent and Student sessions without exposing their JWT', async ({ page }) => {
    const nonce = Date.now()
    const parentEmail = `s1-parent-${nonce}@example.test`
    const parentPassword = 'ParentSynthetic!2026'
    const childPassword = 'ChildSynthetic!2026'

    await page.goto('/bilan-gratuit')
    const form = page.locator('form').filter({
      has: page.getByRole('button', { name: /créer mon espace/i }),
    })
    await form.getByRole('textbox', { name: 'Prénom du parent' }).fill('Parent')
    await form.getByRole('textbox', { name: 'Nom du parent', exact: true }).fill('Session')
    await form.getByRole('textbox', { name: 'Email', exact: true }).fill(parentEmail)
    await form.getByRole('textbox', { name: 'Téléphone' }).fill('+21699000007')
    await form.getByRole('textbox', { name: /prénom de l’élève/i }).fill('Élève')
    await form.getByRole('combobox', { name: 'Classe' }).selectOption('seconde')
    await form.getByRole('checkbox', { name: /j’accepte d’être contacté/i }).check()
    await form.getByRole('button', { name: /créer mon espace/i }).click()

    const url = await activationUrl(parentEmail)
    await page.goto(url)
    await page.getByLabel(/^mot de passe$/i).fill(parentPassword)
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(parentPassword)
    await page.getByRole('button', { name: /activer mon compte/i }).click()
    await signIn(page, parentEmail, parentPassword)
    await expect(page).toHaveURL(/\/dashboard\/parent/)

    expect(await revokeCurrentSession(page)).toEqual({ status: 200, body: { success: true } })
    await page.goto('/dashboard/parent')
    await expect(page).toHaveURL(/\/auth\/signin/)
    await signIn(page, parentEmail, parentPassword)
    await expect(page).toHaveURL(/\/dashboard\/parent/)

    const parent = await prisma.user.findUniqueOrThrow({
      where: { email: parentEmail },
      include: { parentProfile: { include: { children: { include: { user: true } } } } },
    })
    const child = parent.parentProfile?.children[0]
    expect(child).toBeDefined()
    await page.goto(`/dashboard/parent/enfant/${child!.id}`)
    await page.getByRole('checkbox', { name: /consentement explicite/i }).check()
    await page.getByRole('button', { name: /confirmer le rattachement/i }).click()
    await page.goto('/dashboard/parent')
    await page.getByRole('button', { name: /activer le compte élève/i }).click()
    const identifier = (await page.getByText(/^[a-z0-9.]+@nexus-student\.local$/).textContent())!
    const childUrl = await page.getByRole('link', { name: /ouvrir l.activation/i }).getAttribute('href')
    expect(childUrl).toBeTruthy()
    await signOutAndVerifyCookieDeletion(page)
    await page.goto(childUrl!)
    await page.getByLabel(/^mot de passe$/i).fill(childPassword)
    await page.getByLabel('Confirmer le mot de passe', { exact: true }).fill(childPassword)
    await page.getByRole('button', { name: /activer mon compte/i }).click()
    await signIn(page, identifier, childPassword)
    await expect(page).toHaveURL(/\/dashboard\/eleve/)

    expect(await revokeCurrentSession(page)).toEqual({ status: 200, body: { success: true } })
    await page.goto('/dashboard/eleve')
    await expect(page).toHaveURL(/\/auth\/signin/)
    await signIn(page, identifier, childPassword)
    await expect(page).toHaveURL(/\/dashboard\/eleve/)
  })
})

test.describe('legacy JWT transition', () => {
  test('rejects an unversioned browser JWT without a loop and preserves normal reauthentication', async ({ page, context }, testInfo) => {
    const [{ PrismaClient }, bcrypt, jwt, crypto] = await Promise.all([
      import('@prisma/client'),
      import('bcryptjs'),
      import('next-auth/jwt'),
      import('node:crypto'),
    ])
    const database = new PrismaClient()
    const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
    const email = `legacy-session-${unique}@example.test`
    const password = `Synthetic-${unique}!Aa9`
    const baseURL = String(testInfo.project.use.baseURL)
    const cookieName = new URL(baseURL).protocol === 'https:'
      ? '__Secure-authjs.session-token'
      : 'authjs.session-token'
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
    expect(secret).toBeTruthy()

    const user = await database.user.create({
      data: {
        email,
        firstName: 'Parent',
        lastName: 'LegacySynthetic',
        role: 'PARENT',
        password: await bcrypt.hash(password, 12),
        activatedAt: new Date(),
        parentProfile: { create: {} },
      },
      select: { id: true },
    })

    try {
      const legacyCookie = await jwt.encode({
        secret: secret!,
        salt: cookieName,
        maxAge: 60 * 60,
        token: {
          sub: user.id,
          id: user.id,
          role: 'PARENT',
          email,
          name: 'Parent LegacySynthetic',
        },
      })
      const legacyFingerprint = crypto.createHash('sha256').update(legacyCookie).digest('hex')
      await context.addCookies([{
        name: cookieName,
        value: legacyCookie,
        url: baseURL,
        httpOnly: true,
        sameSite: 'Lax',
      }])

      await page.goto('/dashboard/parent', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/auth\/signin(?:\?|$)/)
      const deniedCookies = await context.cookies(baseURL)
      const deniedSessionCookie = deniedCookies.find((cookie) => cookie.name === cookieName)
      if (deniedSessionCookie) {
        expect(crypto.createHash('sha256').update(deniedSessionCookie.value).digest('hex')).toBe(legacyFingerprint)
      }

      await signIn(page, email, password)
      await expect(page).toHaveURL(/\/dashboard\/parent(?:\/|\?|$)/)

      const authenticatedCookies = await context.cookies(baseURL)
      const versionedCookie = authenticatedCookies.find((cookie) => cookie.name === cookieName)
      expect(versionedCookie).toBeDefined()
      const decoded = await jwt.decode({
        secret: secret!,
        salt: cookieName,
        token: versionedCookie!.value,
      })
      expect(decoded?.sessionVersion).toBe(0)

      const publicSessionResponse = await page.request.get('/api/auth/session')
      expect(publicSessionResponse.ok()).toBe(true)
      expect(publicSessionResponse.headers()['cache-control']).toContain('no-store')
      const publicSession = await publicSessionResponse.json()
      expect(publicSession.user).not.toHaveProperty('sessionVersion')

      await context.clearCookies()
      await context.addCookies([{
        name: cookieName,
        value: legacyCookie,
        url: baseURL,
        httpOnly: true,
        sameSite: 'Lax',
      }])
      await page.goto('/dashboard/parent', { waitUntil: 'domcontentloaded' })
      await expect(page).toHaveURL(/\/auth\/signin(?:\?|$)/)
    } finally {
      await database.user.delete({ where: { id: user.id } }).catch(() => undefined)
      await database.$disconnect()
    }
  })
})
