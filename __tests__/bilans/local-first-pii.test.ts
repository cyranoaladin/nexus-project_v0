import {
  bindPiiScanResultToPayload,
  piiScanResultMatchesPayload,
  scanPiiFields,
  validatePiiScanResultChecksum,
} from '@/lib/bilans/local-first/pii';

describe('bilan PII boundary', () => {
  it('binds a clean scan cryptographically to the exact payload', () => {
    const scan = scanPiiFields([{ path: '$.student.alias', text: 'ELEVE_A', source: 'STRUCTURAL_METADATA' }]);
    const bound = bindPiiScanResultToPayload(scan.result, { student: { alias: 'ELEVE_A' } });

    expect(bound.status).toBe('CLEAN');
    expect(validatePiiScanResultChecksum(bound)).toBe(true);
    expect(piiScanResultMatchesPayload(bound, { student: { alias: 'ELEVE_A' } })).toBe(true);
    expect(piiScanResultMatchesPayload(bound, { student: { alias: 'ELEVE_B' } })).toBe(false);
  });

  it('redacts deterministic identifiers without retaining their values', () => {
    const scan = scanPiiFields([{
      path: '$.texte',
      text: 'Contact: eleve.synthetic@example.invalid',
      source: 'LLM_GENERATED_TEXT',
    }]);

    expect(scan.result.status).toBe('REDACTED');
    expect(JSON.stringify(scan)).not.toContain('eleve.synthetic@example.invalid');
  });

  it('blocks ambiguous identity content fail-closed', () => {
    const scan = scanPiiFields([{
      path: '$.texte',
      text: 'Nom : Camille Exemple',
      source: 'LLM_GENERATED_TEXT',
    }]);

    expect(scan.result.status).toBe('BLOCKED');
    expect(scan.sanitizedFields).toEqual({});
  });
});
