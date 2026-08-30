import { auth } from '@/auth';
import { POST } from '@/app/api/aria/chat/route';
import { buildAriaConversationContext } from '@/lib/aria/application/conversation/public';
import { executeAriaConversationJson } from '@/lib/aria/orchestration';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/conversation/public', () => ({
  buildAriaConversationContext: jest.fn(),
}));
jest.mock('@/lib/aria/orchestration', () => ({
  executeAriaConversationJson: jest.fn(),
  streamAriaConversation: jest.fn(),
}));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
}));

function request(body: unknown) {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    signal: new AbortController().signal,
  } as never;
}

describe('ARIA student-facing auth envelope', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['PARENT', 'COACH', 'ADMIN', 'ASSISTANTE'])('refuses %s before context resolution', async (role) => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'other-user', role } });
    const response = await POST(request({
      courseKey: 'eds-maths-premiere',
      content: 'Question',
    }));
    expect(response.status).toBe(401);
    expect(buildAriaConversationContext).not.toHaveBeenCalled();
  });

  it('rejects studentId, grade, track and entitlement injection', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user', role: 'ELEVE' } });
    for (const injected of [
      { studentId: 'other-student' },
      { gradeLevel: 'TERMINALE' },
      { academicTrack: 'STMG' },
      { entitlement: { globalAccess: true } },
    ]) {
      const response = await POST(request({
        courseKey: 'eds-maths-premiere',
        content: 'Question',
        ...injected,
      }));
      expect(response.status).toBe(400);
    }
    expect(buildAriaConversationContext).not.toHaveBeenCalled();
  });

  it('passes only the authenticated actor and branded context to orchestration', async () => {
    const context = Object.freeze({ courseKey: 'eds-maths-premiere' });
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'student-user', role: 'ELEVE' } });
    (buildAriaConversationContext as jest.Mock).mockResolvedValue(context);
    (executeAriaConversationJson as jest.Mock).mockResolvedValue({
      conversationId: 'conversation-1',
      messageId: 'message-1',
      fullText: 'Réponse',
      citations: [],
      newBadges: [],
    });

    const response = await POST(request({
      courseKey: 'eds-maths-premiere',
      content: 'Question',
    }));
    expect(response.status).toBe(200);
    expect(buildAriaConversationContext).toHaveBeenCalledWith(expect.objectContaining({
      actor: { userId: 'student-user', role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
    }));
    expect(executeAriaConversationJson).toHaveBeenCalledWith(expect.objectContaining({
      context,
      message: 'Question',
    }));
    expect(executeAriaConversationJson).not.toHaveBeenCalledWith(
      expect.objectContaining({ studentId: expect.anything() }),
    );
  });
});
