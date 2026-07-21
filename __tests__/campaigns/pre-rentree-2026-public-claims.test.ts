import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPreRentreePublicSurfaceDTO } from '@/lib/campaigns/pre-rentree-2026/public-surface';

const root = process.cwd();

describe('Pré-rentrée public service and CTA claims', () => {
  it('limits included services to the deliverables supported by the campaign contract', () => {
    const dto = getPreRentreePublicSurfaceDTO();
    const publicCopy = JSON.stringify({
      method: dto.method,
      offers: dto.offers,
      faq: dto.faq,
    });

    expect(dto.method).toEqual([
      'Un groupe dont la capacité est annoncée pour chaque offre',
      'Cinq séances structurées par matière',
      'Des objectifs annoncés',
      'De l’entraînement et de la correction en séance',
      'Des consignes et exercices utilisés pendant les séances',
    ]);
    expect(publicCopy).not.toMatch(/bilan|espace parent actif|ARIA incluse|Cyclades|coaching individuel|suivi annuel|cours d'urgence|rattrapage garanti|priorité de réservation/i);
  });

  it('qualifies absence, wait-list and pre-registration statements without promising a place', () => {
    const dto = getPreRentreePublicSurfaceDTO();
    expect(dto.reservation.depositPercentage).toBe(30);
    expect(dto.reservation.rule).toBe('Une demande sans acompte ne réserve pas la place.');
    expect(dto.faq.find((item) => /acompte/i.test(item.question))?.answer).toMatch(/réservation est confirmée après qualification/i);
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
    expect(source).toContain('Voir les offres');
    expect(source).toContain('WhatsApp');
    expect(source).not.toMatch(/bilan-gratuit|>\s*Payer|ClicToPay/i);
  });
});
