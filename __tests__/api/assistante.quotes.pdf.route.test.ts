jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/quote/pdf', () => ({
  renderQuotePDF: jest.fn().mockResolvedValue(Buffer.from('%PDF-quote-server')),
}));

import { NextRequest } from 'next/server';

import { POST } from '@/app/api/assistante/quotes/pdf/route';
import { auth } from '@/auth';
import { renderQuotePDF } from '@/lib/quote/pdf';

const mockAuth = auth as jest.Mock;
const mockRenderQuotePDF = renderQuotePDF as jest.Mock;

const quotePayload = {
  quoteNumber: 'NX-20260614-0001',
  generatedAt: '14 juin 2026',
  validUntil: '21 juin 2026',
  studentName: 'Élève Premium PDF',
  parentName: 'Parent Premium PDF',
  whatsapp: '+216 99 192 829',
  email: 'parent.pdf@nexus-reussite.test',
  advisor: 'Assistante Nexus',
  level: 'Terminale',
  status: 'Scolarisé',
  establishment: 'Lycée test homologué',
  languages: 'Anglais / Espagnol',
  currentLevel: 'Solide',
  specialites: ['Maths', 'Physique-Chimie'],
  options: [],
  modalite: 'Non applicable',
  objectif: 'Dossier sélectif',
  budget: 'Standard',
  mode: 'Présentiel',
  reduction: '0%',
  reductionLabels: [],
  hasDirectionOverride: false,
  offer: {
    label: 'Excellence Terminale',
    desc: 'Deux spécialités + Mathématiques expertes.',
    annualDisplay: '9 594 TND / an',
    inc: ['Deux spécialités + Maths expertes'],
    ech: [{ label: 'Réservation', amount: 1500 }],
  },
  alternatives: [],
};

function makeRequest(body: unknown = quotePayload) {
  return new NextRequest('http://localhost:3000/api/assistante/quotes/pdf', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/assistante/quotes/pdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when anonymous', async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(mockRenderQuotePDF).not.toHaveBeenCalled();
  });

  it('returns 403 for non assistant roles', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'student-1', email: 'student@test.tn', role: 'ELEVE' },
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    expect(mockRenderQuotePDF).not.toHaveBeenCalled();
  });

  it('streams a PDF for assistant users', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'assistant-1', email: 'assistante@nexus-reussite.com', role: 'ASSISTANTE' },
    });

    const response = await POST(makeRequest());
    const body = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('Devis-Nexus-Eleve-Premium-PDF-NX-20260614-0001.pdf');
    expect(body.toString()).toBe('%PDF-quote-server');
    expect(mockRenderQuotePDF).toHaveBeenCalledWith(expect.objectContaining({
      quoteNumber: 'NX-20260614-0001',
      studentName: 'Élève Premium PDF',
      offer: expect.objectContaining({ label: 'Excellence Terminale' }),
    }));
  });
});
