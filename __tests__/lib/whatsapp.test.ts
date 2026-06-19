import { buildWhatsAppUrl, getWhatsAppNumber } from '@/lib/whatsapp';

describe('lib/whatsapp', () => {
  describe('buildWhatsAppUrl', () => {
    it('returns a wa.me URL with the default number', () => {
      const url = buildWhatsAppUrl();
      expect(url).toMatch(/^https:\/\/wa\.me\/21699192829\?text=/);
    });

    it('includes a generic greeting when no context is given', () => {
      const url = buildWhatsAppUrl();
      expect(decodeURIComponent(url)).toContain(
        "j'ai une question sur l'accompagnement"
      );
    });

    it('includes contextual text when context is given', () => {
      const url = buildWhatsAppUrl("l'offre Terminale Duo");
      expect(decodeURIComponent(url)).toContain(
        "j'ai une question sur l'offre Terminale Duo"
      );
    });
  });

  describe('getWhatsAppNumber', () => {
    it('returns the number as a string', () => {
      expect(getWhatsAppNumber()).toBe('21699192829');
    });
  });
});
