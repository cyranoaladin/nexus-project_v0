import {
  buildWhatsAppContactUrl,
  buildWhatsAppUrl,
  getWhatsAppNumber,
} from '@/lib/whatsapp';

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

    it('encodes an exact campaign message without adding personal data', () => {
      const message = 'Bonjour, Pré-rentrée 2026.\nNiveau : Première\nPack : pre2026-pack-2';
      const url = buildWhatsAppUrl(message, { exactMessage: true });

      expect(new URL(url).searchParams.get('text')).toBe(message);
      expect(url).not.toContain('+216');
    });
  });

  describe('getWhatsAppNumber', () => {
    it('returns the number as a string', () => {
      expect(getWhatsAppNumber()).toBe('21699192829');
    });
  });

  describe('buildWhatsAppContactUrl', () => {
    it('uses the supplied canonical public number', () => {
      expect(buildWhatsAppContactUrl('21699192829')).toBe(
        'https://wa.me/21699192829',
      );
    });
  });
});
