import assert from 'node:assert/strict'

import { createClient } from 'redis'

import { RedisStore } from '../../lib/rate-limit/redis-store'

async function main() {
  const url = process.env.REDIS_URL
  assert(url, 'REDIS_URL_REQUIRED')

  const admin = createClient({ url })
  admin.on('error', () => undefined)
  await admin.connect()
  await admin.flushDb()

  const first = new RedisStore(url)
  const second = new RedisStore(url)
  const sharedKey = 'rl:v1:test:ip:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

  for (let index = 0; index < 4; index += 1) {
    const result = await (index % 2 === 0 ? first : second).increment(sharedKey, 4, 60_000)
    assert.equal(result.success, true)
  }
  assert.equal((await second.increment(sharedKey, 4, 60_000)).success, false)

  const concurrentKeys: string[] = []
  const roundResults: Array<{ accepted: number; rejected: number }> = []
  for (let round = 0; round < 3; round += 1) {
    const concurrentKey = `rl:v1:test:identity:concurrency-${round}`
    concurrentKeys.push(concurrentKey)
    const results = await Promise.all(Array.from({ length: 160 }, (_, index) =>
      (index % 2 === 0 ? first : second).increment(concurrentKey, 20, 60_000)))
    const accepted = results.filter((result) => result.success).length
    assert.equal(accepted, 20)
    roundResults.push({ accepted, rejected: results.length - accepted })
  }

  const ttl = await admin.pTTL(concurrentKeys[0])
  assert(ttl > 0 && ttl <= 60_000)

  const expiringKey = 'rl:v1:test:ip:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
  await first.increment(expiringKey, 1, 100)
  await new Promise((resolve) => setTimeout(resolve, 180))
  assert.equal(await admin.exists(expiringKey), 0)

  const keys = await admin.keys('rl:*')
  assert(keys.every((key) => !/@|example|127\.0\.0\.1|198\.51\.100/.test(key)))

  await Promise.all([first.destroy(), second.destroy()])
  await admin.quit()
  process.stdout.write(JSON.stringify({
    atomicSharedLimit: true,
    concurrentRequestsPerRound: 160,
    concurrencyRounds: roundResults,
    ttlCleanup: true,
    rawPiiKeys: 0,
  }) + '\n')
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'REDIS_RATE_LIMIT_TEST_FAILED'}\n`)
  process.exitCode = 1
})
