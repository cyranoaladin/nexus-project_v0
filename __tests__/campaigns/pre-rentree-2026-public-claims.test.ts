import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compilePreRentreeReviewSurfaceDTO } from '@/lib/campaigns/pre-rentree-2026/public-surface';

const root = process.cwd();

describe('Pré-rentrée public service and CTA claims', () => {
  it('limits included services to the deliverables supported by the campaign contract', () => {
    const dto = compilePreRentreeReviewSurfaceDTO();
    const publicCopy = JSON.stringify({
      method: dto.method,
      offers: dto.offers,
      faq: dto.faq,
    });

    expect(dto.method.length).toBeGreaterThan(0);
    expect(dto.method.every((step) => step.title.length > 0 && step.description.length > 0)).toBe(true);
    // "ni bilan diagnostique" est le disclaimer explicitement exigé par la
    // mission (le stage N'INCLUT PAS de bilan) — on l'exclut du texte avant
    // de chercher une PROMESSE de bilan, jamais sa négation explicite.
    const publicCopyWithoutDisclaimer = publicCopy.replace(/ni suivi individuel régulier, ni accompagnement annuel, ni bilan diagnostique/gi, '');
    expect(publicCopyWithoutDisclaimer).not.toMatch(/bilan|espace parent actif|ARIA incluse|Cyclades|coaching individuel|suivi annuel|cours d'urgence|rattrapage garanti|priorité de réservation/i);
  });

  it('qualifies absence, wait-list and pre-registration statements without promising a place', () => {
    const dto = compilePreRentreeReviewSurfaceDTO();
    expect(dto.reservation.depositPercentage).toBe(30);
    expect(dto.reservation.enabled).toBe(false);
    expect(dto.reservation.rule).toMatch(/sans paiement/i);
    expect(dto.faq.find((item) => /réserver ou payer/i.test(item.question))?.answer).toMatch(/aucune réservation ni collecte de paiement/i);
  });

  it('keeps request CTAs non-transactional and excludes the unapproved public form', () => {
    const files = [
      'app/stages/pre-rentree-2026/page.tsx',
      'components/pre-rentree-2026/CanonicalOfferCatalogue.tsx',
      'components/marketing/PreRentreeCampaignSpotlight.tsx',
    ];
    const source = files.map((file) => readFileSync(join(root, file), 'utf8')).join('\n');

    expect(source).toContain('offer.cta');
    expect(source).toContain('buildWhatsAppUrl');
    expect(source).toContain('Construire mon planning');
    expect(source).toContain('WhatsApp');
    expect(source).not.toMatch(/bilan-gratuit|>\s*Payer|ClicToPay/i);
  });
});
