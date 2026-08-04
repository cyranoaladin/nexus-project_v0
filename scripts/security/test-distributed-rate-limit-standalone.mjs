import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const primary = process.env.S3_PRIMARY_BASE_URL
const secondary = process.env.S3_SECONDARY_BASE_URL
const phase = process.env.S3_TEST_PHASE
assert(primary && secondary, 'S3_STANDALONE_BASE_URLS_REQUIRED')
assert(phase === 'prime' || phase === 'verify', 'S3_TEST_PHASE_INVALID')

const routeCookie = process.env.S3_ROUTE_COOKIE
const browser = await chromium.launch({ headless: true })
try {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  if (routeCookie) {
    await contextA.addCookies([{ name: routeCookie, value: 'one', url: primary }])
    await contextB.addCookies([{ name: routeCookie, value: 'two', url: secondary }])
  }
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()
  await pageA.goto(`${primary}/auth/signin`)
  await pageB.goto(`${secondary}/auth/signin`)

  const submit = async (page) => page.evaluate(async () => {
    const response = await fetch('/api/auth/resend-activation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'distributed-rate-limit@example.test' }),
    })
    return {
      status: response.status,
      cacheControl: response.headers.get('cache-control'),
      retryAfter: response.headers.get('retry-after'),
    }
  })

  if (phase === 'prime') {
    const results = [await submit(pageA), await submit(pageB), await submit(pageA)]
    assert(results.every((result) => result.status === 200), JSON.stringify(results))
    process.stdout.write(JSON.stringify({ phase, allowedAcrossInstances: 3 }) + '\n')
  } else {
    const result = await submit(pageB)
    assert.equal(result.status, 429)
    assert.match(result.cacheControl ?? '', /private/)
    assert.match(result.cacheControl ?? '', /no-store/)
    assert(Number(result.retryAfter) > 0)
    process.stdout.write(JSON.stringify({ phase, sharedLimitPersistedAfterRestart: true }) + '\n')
  }
} finally {
  await browser.close()
}
