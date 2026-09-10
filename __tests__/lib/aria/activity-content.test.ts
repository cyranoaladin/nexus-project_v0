import { AriaError } from '@/lib/aria/kernel/errors';
import { parseActivityContent, parseActivityResponsePayload } from '@/lib/aria/domain/practice/activity-content';

const MCQ_CONTENT = Object.freeze({
  prompt: {
    questionText: 'Quelle est la dérivée de x² ?',
    options: [
      { id: 'a', label: '2x' },
      { id: 'b', label: 'x' },
      { id: 'c', label: 'x²' },
    ],
  },
  expectedAnswerShape: { field: 'selectedOptionId', type: 'string' },
  correctionRubric: { correctOptionId: 'a' },
});

const SHORT_ANSWER_CONTENT = Object.freeze({
  prompt: { questionText: 'Quelle est la formule de la dérivée de x^n ?' },
  expectedAnswerShape: { field: 'answerText', type: 'string' },
  correctionRubric: { acceptableAnswers: ['n*x^(n-1)', 'nx^(n-1)'], caseSensitive: false },
});

describe('parseActivityContent', () => {
  it('accepts well-formed MCQ content', () => {
    expect(parseActivityContent('MCQ', MCQ_CONTENT)).toEqual(MCQ_CONTENT);
  });

  it('accepts well-formed SHORT_ANSWER content', () => {
    expect(parseActivityContent('SHORT_ANSWER', SHORT_ANSWER_CONTENT)).toEqual(SHORT_ANSWER_CONTENT);
  });

  it('rejects MCQ content with fewer than 2 options', () => {
    expect(() => parseActivityContent('MCQ', {
      ...MCQ_CONTENT,
      prompt: { questionText: 'x', options: [{ id: 'a', label: 'only one' }] },
    })).toThrow(AriaError);
  });

  it('rejects MCQ content with an unknown extra field (strict schema)', () => {
    expect(() => parseActivityContent('MCQ', {
      ...MCQ_CONTENT,
      prompt: { ...MCQ_CONTENT.prompt, extraField: 'not allowed' },
    })).toThrow(AriaError);
  });

  it('rejects a malformed correctionRubric', () => {
    expect(() => parseActivityContent('MCQ', {
      ...MCQ_CONTENT,
      correctionRubric: { wrongField: 'a' },
    })).toThrow(AriaError);
  });

  it('rejects SHORT_ANSWER content with zero acceptable answers', () => {
    expect(() => parseActivityContent('SHORT_ANSWER', {
      ...SHORT_ANSWER_CONTENT,
      correctionRubric: { acceptableAnswers: [], caseSensitive: false },
    })).toThrow(AriaError);
  });

  it.each(['STRUCTURED_RESPONSE', 'PROBLEM', 'DOCUMENT_ANALYSIS', 'CODE'] as const)(
    'fails closed on the reserved, not-yet-implemented type %s',
    (activityType) => {
      try {
        parseActivityContent(activityType, MCQ_CONTENT);
        throw new Error('expected parseActivityContent to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(AriaError);
        expect((error as AriaError).code).toBe('UNSUPPORTED');
      }
    },
  );
});

describe('parseActivityResponsePayload', () => {
  it('accepts a well-formed MCQ response payload', () => {
    expect(parseActivityResponsePayload('MCQ', { selectedOptionId: 'a' }))
      .toEqual({ selectedOptionId: 'a' });
  });

  it('accepts a well-formed SHORT_ANSWER response payload', () => {
    expect(parseActivityResponsePayload('SHORT_ANSWER', { answerText: 'n*x^(n-1)' }))
      .toEqual({ answerText: 'n*x^(n-1)' });
  });

  it('rejects an MCQ response payload missing selectedOptionId', () => {
    expect(() => parseActivityResponsePayload('MCQ', {})).toThrow(AriaError);
  });

  it('rejects a response payload for a reserved type', () => {
    try {
      parseActivityResponsePayload('CODE', { code: 'print(1)' });
      throw new Error('expected parseActivityResponsePayload to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AriaError);
      expect((error as AriaError).code).toBe('UNSUPPORTED');
    }
  });
});
