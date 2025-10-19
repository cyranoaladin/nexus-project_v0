import { POST } from '@/app/api/aria/chat/route';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'stu-user-1', role: 'ELEVE' } })
}));

jest.mock('@/lib/aria', () => ({
  generateAriaResponse: jest.fn().mockResolvedValue('Réponse ARIA test'),
  saveAriaConversation: jest.fn().mockResolvedValue({ conversation: { id: 'conv1', subject: 'MATHEMATIQUES', title: 'Test...' }, ariaMessage: { id: 'msg1', createdAt: new Date().toISOString() } })
}));
jest.mock('@/lib/badges', () => ({
  checkAndAwardBadges: jest.fn().mockResolvedValue([])
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: jest.fn().mockResolvedValue({ id: 'stu1', subscriptions: [{ ariaSubjects: 'MATHEMATIQUES' }] }) },
    ariaMessage: { findMany: jest.fn().mockResolvedValue([]) }
  }
}));

describe('ARIA Chat API', () => {
  it('returns assistant message content', async () => {
    const req = new NextRequest('http://localhost/api/aria/chat', {
      method: 'POST',
      body: JSON.stringify({ conversationId: undefined, subject: 'MATHEMATIQUES', content: 'Bonjour' })
    } as any);

    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message.content).toContain('Réponse ARIA test');
  });
});
