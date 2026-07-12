import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StageConfigurator from '@/components/pre-rentree-2026/StageConfigurator';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';

jest.mock('@/lib/analytics', () => ({
  track: {
    preRentreeLevelSelected: jest.fn(),
    preRentreeTrackSelected: jest.fn(),
    preRentreeSubjectSelected: jest.fn(),
    preRentreePriceSummaryViewed: jest.fn(),
    preRentreeBilanClicked: jest.fn(),
    preRentreeWhatsAppClicked: jest.fn(),
    preRentreePreregistrationStarted: jest.fn(),
  },
}));

const dto = getPreRentreeLandingDTO();

function renderConfigurator() {
  render(
    <StageConfigurator
      levels={dto.levels}
      subjects={dto.subjects}
      packs={dto.packs}
      schedule={dto.schedule}
      academicProfiles={dto.academicProfiles}
      groupCompositionNotice={dto.content.practical.groupCompositionNotice}
      campaignStatus={dto.status}
    />,
  );
}

describe('Pré-rentrée stage configurator', () => {
  it('supports a Première profile, two subjects and exact DTO pricing', async () => {
    const user = userEvent.setup();
    renderConfigurator();

    await user.click(screen.getByRole('radio', { name: 'Première' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByRole('radio', { name: 'Voie générale' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Maths EDS' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'EAF voie générale' })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Voie générale' }));
    await user.click(screen.getByRole('radio', { name: 'Maths EDS' }));
    await user.click(screen.getByRole('radio', { name: 'EAF voie générale' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    await user.click(screen.getByRole('checkbox', { name: /Mathématiques/i }));
    await user.click(screen.getByRole('checkbox', { name: /Français.*EAF/i }));
    await user.click(screen.getByRole('button', { name: /Voir mon résumé/i }));

    const pack = dto.packs.find((candidate) => candidate.subjectsCount === 2);
    expect(screen.getByText(`${pack?.price.toLocaleString('fr-TN')} TND`)).toBeInTheDocument();
    expect(screen.getByText(`Acompte : ${pack?.deposit.toLocaleString('fr-TN')} TND`)).toBeInTheDocument();
    expect(screen.getByText(`Solde : ${pack?.balance.toLocaleString('fr-TN')} TND`)).toBeInTheDocument();
    expect(screen.getByText('Pré-inscription ouverte')).toBeInTheDocument();
    expect(screen.getByText(/validation du groupe par l'équipe Nexus/i)).toBeInTheDocument();

    const bilan = screen.getByRole('link', { name: /Poursuivre vers le bilan/i });
    expect(bilan).toHaveAttribute('href', expect.stringContaining('pack=pre2026-pack-2'));
    expect(bilan.getAttribute('href')).not.toMatch(/price|prix/i);
  });

  it('skips EDS profiles for Seconde and shows four level-specific subjects', async () => {
    const user = userEvent.setup();
    renderConfigurator();

    await user.click(screen.getByRole('radio', { name: 'Seconde' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(screen.queryByText(/EDS NSI Seconde/i)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Initiation informatique, algorithmique et SNT/i })).toBeInTheDocument();
    expect(screen.getByText(dto.modules.find(
      (campaignModule) => campaignModule.level === 'SECONDE' && campaignModule.subjectId === 'NSI',
    )?.subtitle ?? '')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('limits Terminale retained specialties to two', async () => {
    const user = userEvent.setup();
    renderConfigurator();
    await user.click(screen.getByRole('radio', { name: 'Terminale' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    const specialties = screen.getAllByRole('checkbox');
    await user.click(specialties[0]);
    await user.click(specialties[1]);
    await user.click(specialties[2]);
    expect(specialties[0]).toBeChecked();
    expect(specialties[1]).toBeChecked();
    expect(specialties[2]).not.toBeChecked();
  });

  it('reports an incomplete pedagogical profile before subject selection', async () => {
    const user = userEvent.setup();
    renderConfigurator();

    await user.click(screen.getByRole('radio', { name: 'Première' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(screen.getByText(/Complétez le profil pédagogique/i)).toBeInTheDocument();
  });

  it('keeps the persistent mobile summary collapsible', async () => {
    const user = userEvent.setup();
    renderConfigurator();

    await user.click(screen.getByRole('radio', { name: 'Seconde' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('checkbox', { name: /Mathématiques/i }));

    const toggle = screen.getByRole('button', { name: /Afficher le résumé/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /Poursuivre vers le bilan/i })).toBeInTheDocument();
  });
});
