import conversionSource from '@/content/pre-rentree-2026/whatsapp-conversion.fr.json';
import {
  buildWhatsAppConversionMessage,
  getWhatsAppObjectionMatrix,
} from '@/lib/campaigns/pre-rentree-2026/whatsapp-conversion';

describe('Pré-rentrée 2026 WhatsApp conversion journey', () => {
  it('covers qualification, objections, follow-ups and operational messages', () => {
    const ids = new Set(conversionSource.scripts.map((script) => script.id));
    for (const id of [
      'qualification', 'short-answer', 'detailed-answer', 'objection-price',
      'objection-distance', 'objection-schedule', 'objection-group',
      'objection-classic-course', 'deposit-explanation', 'payment-method',
      'follow-up-j1', 'follow-up-j3', 'follow-up-j7', 'reservation-confirmed',
      'before-stage', 'after-stage',
    ]) expect(ids.has(id)).toBe(true);
  });

  it('minimizes lead data and records consent before follow-up', () => {
    expect(conversionSource.privacy.requiredLeadFields).toEqual([
      'entryLevel', 'subjectIds', 'schoolStatus', 'parentContact', 'contactConsent',
    ]);
    expect(conversionSource.privacy.forbiddenFields).toEqual(expect.arrayContaining([
      'studentHealthData', 'studentPassword', 'bankCardData', 'identityDocument',
    ]));
    expect(conversionSource.crm.events.find((event) => event.id === 'FOLLOW_UP_SCHEDULED'))
      .toMatchObject({ requiresConsent: true });
  });

  it('derives the price response from the canonical commercial offer', () => {
    const message = buildWhatsAppConversionMessage('objection-price', {
      offerId: 'pre2026-3e-mathematiques',
      entryLevel: '3e',
      subjects: 'Mathématiques',
      schoolStatus: 'scolarisé',
    });

    expect(message).toContain('350 TND');
    expect(message).toContain('105 TND');
    expect(message).toContain('cinq séances');
    expect(message).not.toMatch(/SNT|manuel offert|remise annuelle|garanti/i);
  });

  it('requires a received deposit before using the reservation confirmation', () => {
    expect(() => buildWhatsAppConversionMessage('reservation-confirmed', {
      offerId: 'pre2026-seconde-francais',
      entryLevel: 'Seconde',
      subjects: 'Français',
      schoolStatus: 'scolarisé',
    })).toThrow(/DEPOSIT_RECEIVED/);

    expect(buildWhatsAppConversionMessage('reservation-confirmed', {
      offerId: 'pre2026-seconde-francais',
      entryLevel: 'Seconde',
      subjects: 'Français',
      schoolStatus: 'scolarisé',
      satisfiedGates: ['DEPOSIT_RECEIVED'],
    })).toContain('réservation est confirmée');
  });

  it('provides an objection matrix linked to proof, offer, CTA and CRM event', () => {
    const matrix = getWhatsAppObjectionMatrix();
    expect(matrix).toHaveLength(5);
    expect(matrix.every((row) => (
      row.objection && row.responseScriptId && row.proofIds.length > 0
      && row.offerScope.length > 0 && row.cta && row.crmEvent
    ))).toBe(true);
  });
});
