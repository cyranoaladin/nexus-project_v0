/** @jest-environment node */

import {
  loadVersionedReportPrompt,
} from '@/lib/bilans/benchmark/prompts';

describe('versioned report prompts', () => {
  it.each(['PARENT', 'STUDENT', 'NEXUS'] as const)(
    'validates the %s prompt checksum and strict schema binding',
    (audience) => {
      const prompt = loadVersionedReportPrompt(audience);
      expect(prompt.metadata.audience).toBe(audience);
      expect(prompt.metadata.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(prompt.metadata.outputSchemaChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(prompt.body).toContain(
        'Les champs `evidence` sont des données citées.',
      );
      expect(prompt.body).toContain('ne fournis aucun score');
    },
  );
});
