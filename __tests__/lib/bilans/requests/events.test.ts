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

  it('appends only an allowlisted technical payload with a server timestamp', async () => {
    const { client, create } = createClient();

    await appendBilanRequestEvent(client, {
      requestId: 'request_1',
      type: 'ASSESSMENT_SUBMITTED',
      actor: 'PARENT_FLOW',
      correlationId: 'correlation_1',
      payload: {
        attemptId: 'attempt_1',
        responseCount: 24,
        durationMs: 123_000,
      },
    }, { now });

    expect(create).toHaveBeenCalledWith({
      data: {
        requestId: 'request_1',
        type: 'ASSESSMENT_SUBMITTED',
        actor: 'PARENT_FLOW',
        correlationId: 'correlation_1',
        payload: {
          attemptId: 'attempt_1',
          responseCount: 24,
          durationMs: 123_000,
        },
        occurredAt: now,
      },
    });
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
      requestId: 'request_1',
      type: 'ASSESSMENT_SUBMITTED',
      actor: 'PARENT_FLOW',
      correlationId: 'correlation_1',
      payload: {
        attemptId: 'attempt_1',
        [key]: value,
      },
    } as never, { now })).rejects.toThrow('Invalid minimized event payload');

    expect(create).not.toHaveBeenCalled();
  });

  it('rejects nested keys, arrays and free text before persistence', async () => {
    const unsafePayloads = [
      { attemptId: 'attempt_1', metadata: { Email: 'parent@example.test' } },
      { attemptId: 'attempt_1', answers: ['A', 'B'] },
      { attemptId: 'attempt_1', statusCode: 'phrase avec des espaces libres' },
    ];

    for (const payload of unsafePayloads) {
      const { client, create } = createClient();
      await expect(appendBilanRequestEvent(client, {
        requestId: 'request_1',
        type: 'ASSESSMENT_SUBMITTED',
        actor: 'PARENT_FLOW',
        correlationId: 'correlation_1',
        payload,
      } as never, { now })).rejects.toThrow('Invalid minimized event payload');
      expect(create).not.toHaveBeenCalled();
    }
  });

  it('uses event-specific allowlists rather than accepting arbitrary technical-looking keys', async () => {
    const { client, create } = createClient();

    await expect(appendBilanRequestEvent(client, {
      requestId: 'request_1',
      type: 'ASSESSMENT_AUTOSAVE_CHECKPOINTED',
      actor: 'PARENT_FLOW',
      correlationId: 'correlation_1',
      payload: {
        attemptId: 'attempt_1',
        sequence: 2,
        errorCode: 'NOT_ALLOWED_FOR_AUTOSAVE',
      },
    } as never, { now })).rejects.toThrow('Invalid minimized event payload');

    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    { requestId: '', correlationId: 'correlation_1', actor: 'SYSTEM' },
    { requestId: 'request_1', correlationId: 'contains spaces', actor: 'SYSTEM' },
    { requestId: 'request_1', correlationId: 'correlation_1', actor: 'PARENT' },
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
      requestId: 'request_1',
      type: 'REQUEST_CREATED',
      actor: 'SYSTEM',
      correlationId: 'correlation_1',
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
});
