// Only wired by Jest configurations, never application startup. Each isolated
// test process gets a dedicated synthetic key unless both values are supplied.
import { randomBytes } from 'node:crypto';
const currentName = 'CORE_V2_ACCOUNT_TOKEN_HMAC_CURRENT_KEY_ID';
const keysName = 'CORE_V2_ACCOUNT_TOKEN_HMAC_KEYS';
if (!process.env[currentName] && !process.env[keysName]) {
  process.env[currentName] = 'test-key';
  process.env[keysName] = JSON.stringify({ 'test-key': randomBytes(32).toString('hex') });
}
// Core issuance now persists an encrypted mail handoff. This isolated test
// configuration supplies a synthetic key; it is never application startup.
process.env.EMAIL_OUTBOX_ENCRYPTION_KEY ??= randomBytes(32).toString('hex');
