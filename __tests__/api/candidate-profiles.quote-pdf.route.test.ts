jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: (v: unknown) => v instanceof Response,
}));
jest.mock('@/lib/quotes/persistence.server', () => ({
  getQuoteById: jest.fn(),
}));
jest.mock('@/lib/quotes/candidate-profile-persistence.server', () => ({
  getProfilCandidatById: jest.fn(),
}));
jest.mock('@/lib/quotes/pdf-adapter.server', () => ({
  buildQuotePdfDataFromPersistedQuote: jest.fn(),
}));
jest.mock('@/lib/quote/pdf', () => ({
  renderQuotePDF: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { UserRole } from '@prisma/client';
import { GET } from '@/app/api/assistante/candidate-profiles/[id]/quotes/[quoteId]/pdf/route';
import { requireAnyRole } from '@/lib/guards';
import { getQuoteById } from '@/lib/quotes/persistence.server';
import { getProfilCandidatById } from '@/lib/quotes/candidate-profile-persistence.server';
import { buildQuotePdfDataFromPersistedQuote } from '@/lib/quotes/pdf-adapter.server';
import { renderQuotePDF } from '@/lib/quote/pdf';

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockGetQuote = getQuoteById as jest.Mock;
const mockGetProfil = getProfilCandidatById as jest.Mock;
const mockBuildData = buildQuotePdfDataFromPersistedQuote as jest.Mock;
const mockRender = renderQuotePDF as jest.Mock;

const staffSession = { user: { id: 'staff-1', role: UserRole.ASSISTANTE } };

const fakeQuote = {
  id: 'quote-1',
  profilId: 'profil-1',
  contactLead: { id: 'lead-1', name: 'Amira Ben Salah', email: 'amira@example.com', phone: '+21620000000' },
  student: null,
  lines: [],
};

function makeRequest() {
  return new NextRequest('http://localhost:3000/api/assistante/candidate-profiles/profil-1/quotes/quote-1/pdf');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAnyRole.mockResolvedValue(staffSession);
  mockGetQuote.mockResolvedValue(fakeQuote);
  mockGetProfil.mockResolvedValue({ id: 'profil-1', level: 'TERMINALE' });
  mockBuildData.mockReturnValue({ quoteNumber: 'quote-1', studentName: 'Non renseigné' });
  mockRender.mockResolvedValue(Buffer.from('%PDF-fake'));
});

describe('GET /api/assistante/candidate-profiles/[id]/quotes/[quoteId]/pdf', () => {
  test('requires ADMIN/ASSISTANTE', async () => {
    await GET(makeRequest(), { params: Promise.resolve({ id: 'profil-1', quoteId: 'quote-1' }) });
    expect(mockRequireAnyRole).toHaveBeenCalledWith([UserRole.ADMIN, UserRole.ASSISTANTE]);
  });

  test('404 when the quote does not exist', async () => {
    mockGetQuote.mockResolvedValueOnce(null);
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'profil-1', quoteId: 'nonexistent' }) });
    expect(res.status).toBe(404);
    expect(mockRender).not.toHaveBeenCalled();
  });

  test('404 (never a leaked mismatch detail) when the quote does not belong to the profile in the URL', async () => {
    mockGetQuote.mockResolvedValueOnce({ ...fakeQuote, profilId: 'a-different-profile' });
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'profil-1', quoteId: 'quote-1' }) });
    expect(res.status).toBe(404);
    expect(mockRender).not.toHaveBeenCalled();
  });

  test('on success, streams the PDF bytes from the ONE existing renderer (PDF_ENGINE_COUNT=1) with a PDF content type', async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'profil-1', quoteId: 'quote-1' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(mockRender).toHaveBeenCalledTimes(1);
  });
});
