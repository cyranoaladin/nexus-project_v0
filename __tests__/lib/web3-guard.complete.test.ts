/**
 * Web3 Guard — Complete Test Suite
 *
 * Tests: hasWeb3Extension, getSafeEthereum (server-side behavior)
 * Note: useWeb3Guard is a React hook and requires React testing library (skipped here)
 *
 * Source: lib/web3-guard.ts
 */

import { hasWeb3Extension, getSafeEthereum } from '@/lib/web3-guard';

// ─── hasWeb3Extension (server-side) ──────────────────────────────────────────

describe('hasWeb3Extension', () => {
  it('should return false in server environment (no window)', () => {
    expect(hasWeb3Extension()).toBe(false);
  });
});

// ─── getSafeEthereum (server-side) ───────────────────────────────────────────

describe('getSafeEthereum', () => {
  it('should return null in server environment (no window)', () => {
    expect(getSafeEthereum()).toBeNull();
  });
});
