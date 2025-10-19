import { POST } from '@/app/api/bilan-gratuit/generate/route';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'assistant-1', role: 'ASSISTANTE' } })
}));

jest.mock('@/lib/bilan', () => ({
  generateBilan: jest.fn().mockResolvedValue('Contenu de bilan généré (test)')
}));

describe('Bilan Gratuit Generate API', () => {
  it('returns generated bilan content', async () => {
    const body = {
      audience: 'PARENT',
      studentName: 'Marie Dupont',
      level: 'Terminale',
      context: 'Souhaite améliorer les résultats en maths et physique',
      subjects: [
        {
          name: 'MATHEMATIQUES',
          strengths: ['logique'],
          weaknesses: ['méthodologie'],
          goals: ['+3 points au prochain devoir']
        }
      ]
    };
    const req = new NextRequest('http://localhost/api/bilan-gratuit/generate', {
      method: 'POST',
      body: JSON.stringify(body)
    } as any);

    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.content).toContain('bilan');
  });
});

