const { spawn } = require('child_process')

const BASE_URL = 'http://localhost:3000'

class CookieJar {
  constructor() {
    this.cookies = new Map()
  }

  add(setCookieHeaders) {
    if (!setCookieHeaders) return
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]
    for (const header of headers) {
      if (!header) continue
      const [cookiePart] = header.split(';')
      const [name, ...rest] = cookiePart.split('=')
      if (!name) continue
      this.cookies.set(name.trim(), rest.join('='))
    }
  }

  header() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  } catch (error) {
    json = text
  }
  return { response, json }
}

async function login(email, password) {
  const jar = new CookieJar()

  const csrfResult = await fetchJson(`${BASE_URL}/api/auth/csrf`)
  const csrfCookies = csrfResult.response.headers.raw()['set-cookie']
  jar.add(csrfCookies)
  const csrfToken = csrfResult.json?.csrfToken
  if (!csrfToken) {
    throw new Error(`Unable to retrieve CSRF token for ${email}`)
  }

  const form = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: BASE_URL,
    json: 'true'
  })

  const loginResult = await fetchJson(`${BASE_URL}/api/auth/callback/credentials?json=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.header()
    },
    body: form,
    redirect: 'manual'
  })

  const loginCookies = loginResult.response.headers.raw()['set-cookie']
  jar.add(loginCookies)

  if (loginResult.response.status >= 400) {
    throw new Error(`Login failed for ${email}: ${loginResult.response.status} ${JSON.stringify(loginResult.json)}`)
  }

  return { jar, login: loginResult.json }
}

async function apiRequest(jar, method, path, body) {
  const options = {
    method,
    headers: {
      Cookie: jar.header(),
      Accept: 'application/json'
    }
  }

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  const result = await fetchJson(`${BASE_URL}${path}`, options)
  return {
    status: result.response.status,
    data: result.json
  }
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['dev'], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? 'development' },
      stdio: ['inherit', 'pipe', 'pipe']
    })

    let resolved = false

    const handleReady = (chunk) => {
      const text = chunk.toString()
      process.stdout.write(text)
      if (!resolved && text.includes('Local:        http://localhost:3000')) {
        resolved = true
        resolve({
          stop: () => new Promise((stopResolve) => {
            child.once('exit', () => stopResolve())
            child.kill('SIGINT')
          })
        })
      }
    }

    child.stdout.on('data', handleReady)
    child.stderr.on('data', chunk => process.stderr.write(chunk.toString()))

    child.on('exit', (code) => {
      if (!resolved) {
        reject(new Error(`Next.js dev server exited before becoming ready (code ${code})`))
      }
    })
  })
}

async function main() {
  const summary = {}

  const server = await startServer()

  try {
    // Student journey: activate freemium and consume one token via ARIA chat
    const studentAuth = await login('student@test.local', 'password')
    const studentJar = studentAuth.jar

    summary.studentFreemiumBefore = await apiRequest(studentJar, 'GET', '/api/aria/freemium')

    summary.studentFreemiumActivation = await apiRequest(studentJar, 'POST', '/api/aria/freemium', {})

    summary.studentChat = await apiRequest(studentJar, 'POST', '/api/aria/chat', {
      subject: 'MATHEMATIQUES',
      content: 'Bonjour ARIA, peux-tu me rappeler les formules de dérivation principales ?'
    })

    summary.studentFreemiumAfter = await apiRequest(studentJar, 'GET', '/api/aria/freemium')

    // Parent submits subscription request
    const parentAuth = await login('parent@example.com', 'admin123')
    const parentJar = parentAuth.jar

    summary.parentSubscriptionsBefore = await apiRequest(parentJar, 'GET', '/api/parent/subscriptions')
    const firstChild = summary.parentSubscriptionsBefore.data?.children?.[0]
    if (!firstChild) {
      throw new Error('No child found for parent@example.com')
    }

    const subscriptionRequestPayload = {
      studentId: firstChild.id,
      requestType: 'PLAN_CHANGE',
      planName: 'HYBRIDE',
      monthlyPrice: 450,
      reason: 'Migration vers offre Hybride (test)'
    }

    summary.parentSubscriptionRequest = await apiRequest(parentJar, 'POST', '/api/parent/subscription-requests', subscriptionRequestPayload)
    const requestId = summary.parentSubscriptionRequest.data?.requestId || summary.parentSubscriptionRequest.data?.request?.id
    if (!requestId) {
      throw new Error('Failed to create subscription request')
    }

    // Assistant approves the subscription request
    const assistantAuth = await login('assistante@nexus-reussite.com', 'assist123')
    const assistantJar = assistantAuth.jar

    summary.assistantRequests = await apiRequest(assistantJar, 'GET', '/api/assistant/subscription-requests')

    summary.assistantApproval = await apiRequest(assistantJar, 'PATCH', '/api/assistant/subscription-requests', {
      requestId,
      action: 'APPROVED',
      notes: 'Validation automatique QA'
    })

    // Parent snapshot after approval
    summary.parentSubscriptionsAfter = await apiRequest(parentJar, 'GET', '/api/parent/subscriptions')

    // Student attempts freemium again after premium activation
    summary.studentFreemiumPostPremium = await apiRequest(studentJar, 'POST', '/api/aria/freemium', {})

    console.log(JSON.stringify(summary, null, 2))
  } finally {
    await server.stop()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
