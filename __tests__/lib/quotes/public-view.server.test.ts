jest.mock('@/lib/quotes/persistence.server', () => ({
  getQuoteByPublicToken: jest.fn(),
  markQuoteConsultedIfSent: jest.fn(),
}));

import { getQuoteForFamilyView } from '@/lib/quotes/public-view.server';
import { getQuoteByPublicToken, markQuoteConsultedIfSent } from '@/lib/quotes/persistence.server';

const mockLookup = getQuoteByPublicToken as jest.Mock;
const mockMarkConsulted = markQuoteConsultedIfSent as jest.Mock;

describe('getQuoteForFamilyView', () => {
  beforeEach(() => jest.clearAllMocks());

  test('marks a sent quote as consulted on the family HTML/API read path', async () => {
    const quote = { id: 'quote-1', status: 'DEVIS_ENVOYE', lines: [] };
    mockLookup.mockResolvedValue({ quote });
    const consultedAt = new Date('2027-01-02T03:04:05.000Z');
    mockMarkConsulted.mockResolvedValue(consultedAt);

    const result = await getQuoteForFamilyView('family-token');

    expect(result.quote).toEqual({ ...quote, status: 'DEVIS_CONSULTE', consultedAt });
    expect(mockMarkConsulted).toHaveBeenCalledWith('quote-1');
  });

  test('keeps the family read available when the best-effort transition fails', async () => {
    const quote = { id: 'quote-1', status: 'DEVIS_ENVOYE', lines: [] };
    mockLookup.mockResolvedValue({ quote });
    mockMarkConsulted.mockRejectedValue(new Error('transition unavailable'));

    await expect(getQuoteForFamilyView('family-token')).resolves.toEqual({ quote });
  });

  test('returns the original snapshot when a concurrent staff transition wins', async () => {
    const quote = { id: 'quote-1', status: 'DEVIS_ENVOYE', lines: [] };
    mockLookup.mockResolvedValue({ quote });
    mockMarkConsulted.mockResolvedValue(null);

    await expect(getQuoteForFamilyView('family-token')).resolves.toEqual({ quote });
  });

  test('does not transition an invalid, already consulted, or staff-follow-up quote', async () => {
    mockLookup.mockResolvedValueOnce({ quote: null, reason: 'NOT_FOUND' });
    await expect(getQuoteForFamilyView('missing')).resolves.toEqual({ quote: null, reason: 'NOT_FOUND' });

    const quote = { id: 'quote-2', status: 'DEVIS_CONSULTE', lines: [] };
    mockLookup.mockResolvedValueOnce({ quote });
    await expect(getQuoteForFamilyView('already-consulted')).resolves.toEqual({ quote });

    const followUpQuote = { id: 'quote-3', status: 'A_RAPPELER', lines: [] };
    mockLookup.mockResolvedValueOnce({ quote: followUpQuote });
    await expect(getQuoteForFamilyView('follow-up')).resolves.toEqual({ quote: followUpQuote });

    expect(mockMarkConsulted).not.toHaveBeenCalled();
  });
});
