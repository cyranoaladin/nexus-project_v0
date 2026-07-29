import {
  appendBilanRequestEvent,
  type BilanRequestEventClient,
} from '@/lib/bilans/requests/events';

function createClient() {
  const create = jest.fn().mockResolvedValue({ id: 'event_1' });
  const client: BilanRequestEventClient = {
    bilanRequestEvent: { create },
  };

  return { client, create };
}

describe('minimized bilan request events', () => {
  const now = new Date('2026-07-29T10:00:00.000Z');
  const requestId = 'request_00000001';
  const correlationId = 'correlation_0001';
  const attemptId = 'attempt_000000001';

  it('appends only an allowlisted technical payload with a server timestamp', async () => {
    const { client, create } = createClient();

    await appendBilanRequestEvent(client, {
      requestId,
      type: 'ASSESSMENT_SUBMITTED',
      actor: 'PARENT_FLOW',
      correlationId,
      payload: {
        attemptId,
        responseCount: 24,
        durationMs: 123_000,
      },
    }, { now });

    expect(create).toHaveBeenCalledWith({
      data: {
        requestId,
        type: 'ASSESSMENT_SUBMITTED',
        actor: 'PARENT_FLOW',
        correlationId,
        payload: {
          attemptId,
          responseCount: 24,
          durationMs: 123_000,
        },
        occurredAt: now,
      },
    });
  });

  it('accepts current catalog-style version identifiers', async () => {
    const { client, create } = createClient();

    await appendBilanRequestEvent(client, {
      requestId,
      type: 'ASSESSMENT_STARTED',
      actor: 'PARENT_FLOW',
      correlationId,
      payload: {
        attemptId,
        assessmentPackId: 'pack_maths_terminale_v1',
        assessmentPackVersion: 'legacy-v1.3',
      },
    }, { now });

    expect(create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['email', 'parent@example.test'],
    ['EMAIL', 'parent@example.test'],
    ['phone', '+21699123456'],
    ['tel', '99123456'],
    ['childName', 'Amine'],
    ['student_name', 'Amine'],
    ['minorFirstName', 'Amine'],
    ['school', 'Lycée Exemple'],
    ['establishment', 'Lycée Exemple'],
    ['mainNeed', 'Je ne comprends pas les suites'],
    ['message', 'Texte libre'],
    ['answer', 'La réponse est 42'],
    ['response', 'Réponse détaillée'],
    ['solution', 'Correction complète'],
    ['reportContent', 'Bilan individualisé'],
  ])('rejects sensitive payload key %s before persistence', async (key, value) => {
    const { client, create } = createClient();

    await expect(appendBilanRequestEvent(client, {
      requestId,
      type: 'ASSESSMENT_SUBMITTED',
      actor: 'PARENT_FLOW',
      correlationId,
      payload: {
        attemptId,
        [key]: value,
      },
    } as never, { now })).rejects.toThrow('Invalid minimized event payload');

    expect(create).not.toHaveBeenCalled();
  });

  it('rejects nested keys, arrays and free text before persistence', async () => {
    const unsafePayloads = [
      { attemptId, metadata: { Email: 'parent@example.test' } },
      { attemptId, answers: ['A', 'B'] },
      { attemptId, statusCode: 'phrase avec des espaces libres' },
    ];

    for (const payload of unsafePayloads) {
      const { client, create } = createClient();
      await expect(appendBilanRequestEvent(client, {
        requestId,
        type: 'ASSESSMENT_SUBMITTED',
        actor: 'PARENT_FLOW',
        correlationId,
        payload,
      } as never, { now })).rejects.toThrow('Invalid minimized event payload');
      expect(create).not.toHaveBeenCalled();
    }
  });

  it('uses event-specific allowlists rather than accepting arbitrary technical-looking keys', async () => {
    const { client, create } = createClient();

    await expect(appendBilanRequestEvent(client, {
      requestId,
      type: 'ASSESSMENT_AUTOSAVE_CHECKPOINTED',
      actor: 'PARENT_FLOW',
      correlationId,
      payload: {
        attemptId,
        sequence: 2,
        errorCode: 'NOT_ALLOWED_FOR_AUTOSAVE',
      },
    } as never, { now })).rejects.toThrow('Invalid minimized event payload');

    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    { requestId: '', correlationId, actor: 'SYSTEM' },
    { requestId, correlationId: 'contains spaces', actor: 'SYSTEM' },
    { requestId, correlationId, actor: 'PARENT' },
  ])('rejects invalid identifiers or actors without writing', async (invalid) => {
    const { client, create } = createClient();

    await expect(appendBilanRequestEvent(client, {
      ...invalid,
      type: 'REQUEST_CREATED',
      payload: {
        acquisitionChannelCode: 'WEBSITE',
      },
    } as never, { now })).rejects.toThrow();

    expect(create).not.toHaveBeenCalled();
  });

  it('never persists representative minor or parent PII', async () => {
    const { client, create } = createClient();

    await appendBilanRequestEvent(client, {
      requestId,
      type: 'REQUEST_CREATED',
      actor: 'SYSTEM',
      correlationId,
      payload: {
        acquisitionChannelCode: 'WEBSITE',
        subjectCode: 'MATHEMATIQUES',
        gradeCode: 'TERMINALE',
      },
    }, { now });

    const persisted = JSON.stringify(create.mock.calls[0]);
    expect(persisted).not.toMatch(
      /parent@example|99123456|Amine|Lycée Exemple|suites|réponse|bilan individualisé/i,
    );
  });

  it.each([
    ['REQUEST_CREATED', 'acquisitionChannelCode'],
    ['REQUEST_CREATED', 'subjectCode'],
    ['REQUEST_CREATED', 'gradeCode'],
    ['ACCOUNT_VERIFICATION_REQUESTED', 'deliveryChannelCode'],
    ['ACCOUNT_VERIFIED', 'methodCode'],
    ['CHILD_SELECTED', 'studentId'],
    ['ASSESSMENT_STARTED', 'attemptId'],
    ['ASSESSMENT_STARTED', 'assessmentPackId'],
    ['ASSESSMENT_STARTED', 'assessmentPackVersion'],
    ['ASSESSMENT_SCORED', 'scoringVersion'],
    ['REPORT_READY_FOR_REVIEW', 'revisionId'],
    ['REPORT_READY_FOR_REVIEW', 'audienceCode'],
    ['REPORT_APPROVED', 'reviewerId'],
    ['REPORT_REJECTED', 'reasonCode'],
    ['REPORT_PUBLISHED', 'artifactId'],
    ['TECHNICAL_ACTION_REQUIRED', 'errorCode'],
  ])('rejects PII disguised as %s.%s', async (type, key) => {
    for (const pii of ['Amine', '99192829', 'parent@example.test']) {
      const { client, create } = createClient();

      await expect(appendBilanRequestEvent(client, {
        requestId,
        type,
        actor: 'SYSTEM',
        correlationId,
        payload: { [key]: pii },
      } as never, { now })).rejects.toThrow('Invalid minimized event payload');
      expect(create).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['REQUEST_CREATED', 'acquisitionChannelCode', 'SOCIAL_MEDIA'],
    ['REQUEST_CREATED', 'subjectCode', 'ASTROLOGIE'],
    ['REQUEST_CREATED', 'gradeCode', 'SIXIEME'],
    ['ACCOUNT_VERIFICATION_REQUESTED', 'deliveryChannelCode', 'SMS'],
    ['ACCOUNT_VERIFIED', 'methodCode', 'SECURITY_QUESTION'],
    ['REPORT_READY_FOR_REVIEW', 'audienceCode', 'PUBLIC'],
    ['HUMAN_FOLLOWUP_REQUIRED', 'reasonCode', 'UNE_PHRASE_INVENTEE'],
    ['TECHNICAL_ACTION_REQUIRED', 'errorCode', 'UNKNOWN_ERROR'],
  ])('rejects unknown closed code %s.%s=%s', async (type, key, value) => {
    const { client, create } = createClient();

    await expect(appendBilanRequestEvent(client, {
      requestId,
      type,
      actor: 'SYSTEM',
      correlationId,
      payload: { [key]: value },
    } as never, { now })).rejects.toThrow('Invalid minimized event payload');
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ['ASSESSMENT_SCORED', 'scoreBasisPoints', 10_001],
    ['ASSESSMENT_SUBMITTED', 'responseCount', 501],
    ['ASSESSMENT_SCORING_FAILED', 'retryCount', 21],
    ['NOTIFICATION_DELIVERY_FAILED', 'attemptCount', 21],
    ['ASSESSMENT_AUTOSAVE_CHECKPOINTED', 'sequence', 10_001],
    ['ASSESSMENT_SUBMITTED', 'durationMs', 14_400_001],
  ])('rejects numeric overflow %s.%s=%s', async (type, key, value) => {
    const { client, create } = createClient();

    await expect(appendBilanRequestEvent(client, {
      requestId,
      type,
      actor: 'SYSTEM',
      correlationId,
      payload: { [key]: value },
    } as never, { now })).rejects.toThrow('Invalid minimized event payload');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an invalid server occurrence date before persistence', async () => {
    const { client, create } = createClient();

    await expect(appendBilanRequestEvent(client, {
      requestId,
      type: 'REQUEST_CREATED',
      actor: 'SYSTEM',
      correlationId,
      payload: { acquisitionChannelCode: 'WEBSITE' },
    }, { now: new Date(Number.NaN) })).rejects.toThrow('Invalid bilan request event date');
    expect(create).not.toHaveBeenCalled();
  });
});
