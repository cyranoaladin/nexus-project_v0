import { getRateLimitRuntimeMode } from '@/lib/rate-limit'
import { deriveRateLimitKey } from '@/lib/rate-limit/keys'
import { SENSITIVE_RATE_LIMIT_POLICIES } from '@/lib/rate-limit/sensitive'

const ORIGINAL_ENV = { ...process.env }

function setNodeEnv(value: string) {
  Object.defineProperty(process.env, 'NODE_ENV', {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}

describe('S3 final distributed rate-limit contract', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  test('requires an explicit backend instead of inferring it from credentials', () => {
    setNodeEnv('production')
    delete process.env.RATE_LIMIT_BACKEND
    process.env.REDIS_URL = 'redis://127.0.0.1:6379'
    expect(getRateLimitRuntimeMode()).toBe('invalid')

    process.env.RATE_LIMIT_BACKEND = 'upstash'
    expect(getRateLimitRuntimeMode()).toBe('invalid')

    process.env.RATE_LIMIT_BACKEND = 'redis'
    expect(getRateLimitRuntimeMode()).toBe('redis')
  })

  test('isolates versioned HMAC keys by environment namespace', () => {
    setNodeEnv('production')
    process.env.RATE_LIMIT_KEY_SECRET = 'rate-limit-final-contract-secret-32-bytes'
    process.env.RATE_LIMIT_KEY_NAMESPACE = 'production'
    const production = deriveRateLimitKey('parent-signup', 'identity', 'parent@example.test')
    process.env.RATE_LIMIT_KEY_NAMESPACE = 'preview'
    const preview = deriveRateLimitKey('parent-signup', 'identity', 'parent@example.test')

    expect(production).toMatch(/^rl:v1:production:parent-signup:identity:[a-f0-9]{64}$/)
    expect(preview).toMatch(/^rl:v1:preview:parent-signup:identity:[a-f0-9]{64}$/)
    expect(preview).not.toBe(production)
  })

  test('centralizes every protected operation and its dimensions', () => {
    const expectedScopes = [
      'parent-signup', 'parent-activation', 'parent-phone-reservation-release',
      'parent-whatsapp-manual-invitation',
      'parent-registration', 'student-activation', 'activation-resend',
      'credentials-login', 'password-reset-request', 'password-reset-confirm',
      'sessions-revoke', 'child-create', 'child-activation', 'test-email',
      'contact-submit', 'newsletter-subscribe', 'stage-registration',
      'assessment-submit', 'reservation-submit', 'notification-email',
      'quotes-pdf', 'bilan-pallier2', 'admin-stats', 'admin-recompute',
      'session-video-ip', 'session-video-user', 'session-book', 'session-cancel',
      'admin-users-read', 'admin-users-create', 'student-credits', 'student-sessions',
      'programme-rag-v2',
      'candidate-diagnostic-create', 'candidate-diagnostic-final-submit',
      'candidate-module-draft', 'candidate-module-submit',
      'candidate-parent-draft', 'candidate-parent-submit', 'bilan-share-consult',
      'bilan-share-consent',
      'candidate-document-upload',
      'quotes-recommend', 'quotes-create', 'quotes-public-read', 'quotes-send', 'quotes-accept',
      'quotes-lead-search', 'quotes-history-read',
      'candidate-profile-create', 'candidate-profile-read', 'candidate-profile-update',
    ]
    expectedScopes.push('family-create');
    expect(SENSITIVE_RATE_LIMIT_POLICIES['family-create']).toEqual({ ipPreset: 'writeIp', identityPreset: 'writeIdentity' });
    expect(Object.keys(SENSITIVE_RATE_LIMIT_POLICIES).sort()).toEqual(expectedScopes.sort())
    expect(SENSITIVE_RATE_LIMIT_POLICIES['parent-phone-reservation-release']).toEqual({
      ipPreset: 'writeIp', identityPreset: 'writeIdentity', resourcePreset: 'resourceWrite',
    })
    expect(SENSITIVE_RATE_LIMIT_POLICIES['parent-whatsapp-manual-invitation']).toEqual({
      ipPreset: 'writeIp', identityPreset: 'writeIdentity', resourcePreset: 'resourceWrite',
    })
    expect(SENSITIVE_RATE_LIMIT_POLICIES['programme-rag-v2']).toEqual({
      ipPreset: 'expensiveIp', identityPreset: 'expensiveIdentity',
    })
    for (const policy of Object.values(SENSITIVE_RATE_LIMIT_POLICIES)) {
      expect(
        'ipPreset' in policy || 'identityPreset' in policy || 'resourcePreset' in policy,
      ).toBe(true)
    }
  })
})
