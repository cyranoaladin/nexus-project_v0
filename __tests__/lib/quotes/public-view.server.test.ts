jest.mock('@/lib/quotes/persistence.server', () => ({
  getQuoteByPublicToken: jest.fn(),
  transitionQuoteStatus: jest.fn(),
}));

import { getQuoteForFamilyView } from '@/lib/quotes/public-view.server';
import { getQuoteByPublicToken, transitionQuoteStatus } from '@/lib/quotes/persistence.server';

const mockLookup = getQuoteByPublicToken as jest.Mock;
const mockTransition = transitionQuoteStatus as jest.Mock;

describe('getQuoteForFamilyView', () => {
  beforeEach(() => jest.clearAllMocks());

  test('marks a sent quote as consulted on the family HTML/API read path', async () => {
    const quote = { id: 'quote-1', status: 'DEVIS_ENVOYE', lines: [] };
    mockLookup.mockResolvedValue({ quote });
    mockTransition.mockResolvedValue({ ...quote, status: 'DEVIS_CONSULTE' });

    const result = await getQuoteForFamilyView('family-token');

    expect(result.quote).toBe(quote);
    expect(mockTransition).toHaveBeenCalledWith({ quoteId: 'quote-1', toStatus: 'DEVIS_CONSULTE' });
  });

  test('keeps the family read available when the best-effort transition fails', async () => {
    const quote = { id: 'quote-1', status: 'DEVIS_ENVOYE', lines: [] };
    mockLookup.mockResolvedValue({ quote });
    mockTransition.mockRejectedValue(new Error('transition unavailable'));

    await expect(getQuoteForFamilyView('family-token')).resolves.toEqual({ quote });
  });

  test('does not transition an invalid or already consulted quote', async () => {
    mockLookup.mockResolvedValueOnce({ quote: null, reason: 'NOT_FOUND' });
    await expect(getQuoteForFamilyView('missing')).resolves.toEqual({ quote: null, reason: 'NOT_FOUND' });

    const quote = { id: 'quote-2', status: 'DEVIS_CONSULTE', lines: [] };
    mockLookup.mockResolvedValueOnce({ quote });
    await expect(getQuoteForFamilyView('already-consulted')).resolves.toEqual({ quote });

    expect(mockTransition).not.toHaveBeenCalled();
  });
});
