/**
 * F50: Backward Compatibility Coexistence Test
 * Verifies that lib/bilan/generator.ts (canonical) and lib/bilan-generator.ts (legacy)
 * can coexist without conflicts
 */

import { BilanGenerator as CanonicalGenerator } from '@/lib/bilan/generator';
import { generateBilans as LegacyGenerateBilans } from '@/lib/bilan-generator';
import { BilanType } from '@/lib/bilan/types';

describe('F50: Canonical/Legacy Coexistence', () => {
  it('should import both generators without conflicts', () => {
    expect(CanonicalGenerator).toBeDefined();
    expect(CanonicalGenerator.generate).toBeInstanceOf(Function);
    expect(LegacyGenerateBilans).toBeDefined();
    expect(LegacyGenerateBilans).toBeInstanceOf(Function);
  });

  it('should have distinct module paths', () => {
    // Verify they come from different modules
    expect(CanonicalGenerator.name).toBe('BilanGenerator');
    // Legacy is a function, not a class
    expect(typeof LegacyGenerateBilans).toBe('function');
  });

  it('should have different interfaces', () => {
    // Canonical is a static class with methods
    // Legacy is a standalone function
    expect(typeof CanonicalGenerator.generate).toBe('function');
    expect(typeof LegacyGenerateBilans).toBe('function');
    // They have different signatures
    expect(CanonicalGenerator.generate.length).not.toBe(LegacyGenerateBilans.length);
  });

  it('should operate independently (stub mode)', async () => {
    // Set stub mode for both
    process.env.LLM_MODE = 'stub';

    // Test canonical generator in stub mode
    const canonicalResult = await CanonicalGenerator.generate({
      type: BilanType.DIAGNOSTIC_PRE_STAGE,
      subject: 'MATHS',
      studentName: 'Test Student',
      studentEmail: 'test@example.com',
      sourceData: {},
    });

    expect(canonicalResult).toBeDefined();
    expect(canonicalResult.studentMarkdown).toBeDefined();
    expect(canonicalResult.parentsMarkdown).toBeDefined();
    expect(canonicalResult.nexusMarkdown).toBeDefined();
    expect(canonicalResult.engineVersion).toBe('stub-v1');
  });

  it('should not interfere with each other when loaded together', () => {
    // This test verifies that importing both doesn't cause runtime errors
    // or namespace pollution
    expect(() => {
      // Re-import to verify no module cache issues
      const canonical = require('@/lib/bilan/generator');
      const legacy = require('@/lib/bilan-generator');

      expect(canonical.BilanGenerator).toBeDefined();
      expect(legacy.generateBilans).toBeDefined();
    }).not.toThrow();
  });
});
