import { AriaError } from '@/lib/aria/kernel/errors';
import { parseModelCorrectionJson, parseModelCorrectionOutput } from '@/lib/aria/domain/practice/correction-feedback';

const WELL_FORMED = Object.freeze({
  outcome: 'PARTIALLY_CORRECT',
  summary: 'Bon raisonnement, erreur de calcul en fin de résolution.',
  strengths: ['Méthode correcte', 'Notation rigoureuse'],
  improvements: ['Vérifier le calcul final'],
});

describe('parseModelCorrectionOutput', () => {
  it('accepts a well-formed correction', () => {
    expect(parseModelCorrectionOutput(WELL_FORMED)).toEqual(WELL_FORMED);
  });

  it('accepts empty strengths/improvements arrays', () => {
    const value = { ...WELL_FORMED, strengths: [], improvements: [] };
    expect(parseModelCorrectionOutput(value)).toEqual(value);
  });

  it('rejects an unknown outcome value', () => {
    expect(() => parseModelCorrectionOutput({ ...WELL_FORMED, outcome: 'ALMOST' }))
      .toThrow(AriaError);
  });

  it('rejects a missing summary', () => {
    const { summary: _summary, ...rest } = WELL_FORMED;
    expect(() => parseModelCorrectionOutput(rest)).toThrow(AriaError);
  });

  it('rejects an empty summary', () => {
    expect(() => parseModelCorrectionOutput({ ...WELL_FORMED, summary: '' })).toThrow(AriaError);
  });

  it('rejects a non-array strengths field', () => {
    expect(() => parseModelCorrectionOutput({ ...WELL_FORMED, strengths: 'good job' }))
      .toThrow(AriaError);
  });

  it('rejects an unknown extra field (strict schema)', () => {
    expect(() => parseModelCorrectionOutput({ ...WELL_FORMED, confidence: 0.9 }))
      .toThrow(AriaError);
  });

  it('rejects a non-object value entirely', () => {
    expect(() => parseModelCorrectionOutput('not an object')).toThrow(AriaError);
    expect(() => parseModelCorrectionOutput(null)).toThrow(AriaError);
  });

  it('the thrown error carries the real reason code and Zod issues', () => {
    try {
      parseModelCorrectionOutput({ ...WELL_FORMED, summary: '' });
      throw new Error('expected parseModelCorrectionOutput to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AriaError);
      const ariaError = error as AriaError;
      expect(ariaError.code).toBe('INTERNAL_ERROR');
      expect((ariaError.internalDetails as { reasonCode: string }).reasonCode)
        .toBe('ARIA_CORRECTION_OUTPUT_INVALID');
    }
  });
});

describe('parseModelCorrectionJson', () => {
  it('parses and validates well-formed JSON text', () => {
    expect(parseModelCorrectionJson(JSON.stringify(WELL_FORMED))).toEqual(WELL_FORMED);
  });

  it('fails closed on text that is not valid JSON at all', () => {
    try {
      parseModelCorrectionJson('this is not { json');
      throw new Error('expected parseModelCorrectionJson to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AriaError);
      const ariaError = error as AriaError;
      expect((ariaError.internalDetails as { reasonCode: string }).reasonCode)
        .toBe('ARIA_CORRECTION_OUTPUT_NOT_JSON');
    }
  });

  it('fails closed on valid JSON that does not match the feedback schema', () => {
    expect(() => parseModelCorrectionJson(JSON.stringify({ hello: 'world' }))).toThrow(AriaError);
  });
});
