import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';

const root = process.cwd();

describe('Pré-rentrée public service and CTA claims', () => {
  it('limits included services to the deliverables supported by the campaign contract', () => {
    const dto = getPreRentreeLandingDTO();
    const publicCopy = JSON.stringify({
      method: dto.content.method,
      practical: dto.content.practical,
      faq: dto.content.faq,
    });

    expect(dto.content.method.map((item) => item.title)).toEqual([
      'Positionnement',
      'Travail guidé en groupe réduit',
      'Entraînement et correction',
      'Bilan et recommandations de rentrée',
    ]);
    expect(dto.content.practical.material).toContain('supports de travail sont fournis');
    expect(publicCopy).not.toMatch(/espace parent actif|ARIA incluse|coaching individuel|suivi annuel|cours d'urgence|rattrapage garanti|priorité de réservation/i);
  });

  it('qualifies absence, wait-list and pre-registration statements without promising a place', () => {
    const { content } = getPreRentreeLandingDTO();
    const absence = content.faq.find((item) => /absence/i.test(item.question));
    const waitingList = content.faq.find((item) => /liste d'attente/i.test(item.question));

    expect(absence?.answer).toMatch(/communiquées avant toute confirmation/i);
    expect(absence?.answer).toMatch(/aucun rattrapage n’est garanti/i);
    expect(waitingList?.answer).toMatch(/ne constitue pas une confirmation de place/i);
    expect(content.practical.preRegistrationNotice).toMatch(/ne réserve pas une place/i);
    expect(content.practical.preRegistrationNotice).toMatch(/ne forme pas un contrat/i);
  });

  it('keeps request CTAs non-transactional and excludes the unapproved public form', () => {
    const files = [
      'components/pre-rentree-2026/PreRentreeHero.tsx',
      'components/pre-rentree-2026/StageConfigurator.tsx',
      'components/pre-rentree-2026/FinalCampaignCTA.tsx',
      'components/marketing/PreRentreeCampaignSpotlight.tsx',
    ];
    const source = files.map((file) => readFileSync(join(root, file), 'utf8')).join('\n');

    expect(source).toContain('Composer le stage');
    expect(source).toContain('Demander ce parcours sur WhatsApp');
    expect(source).toContain('WhatsApp');
    expect(source).not.toMatch(/bilan-gratuit|>\s*Payer|ClicToPay/i);
  });
});
