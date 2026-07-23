import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StageConfigurator from '@/components/pre-rentree-2026/StageConfigurator';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';
import { track } from '@/lib/analytics';

jest.mock('@/lib/analytics', () => ({
  toPreRentreeEntryLevel: (level: string) => level.toLowerCase(),
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
      packs={dto.offerOptions}
      schedule={dto.schedule}
      academicProfiles={dto.academicProfiles}
      groupCompositionNotice={dto.content.practical.groupCompositionNotice}
      campaignPublicStatus={dto.publicStatus}
    />,
  );
}

describe('Pré-rentrée stage configurator', () => {
  it('supports a Première profile, two subjects and exact DTO pricing', async () => {
    const user = userEvent.setup();
    renderConfigurator();

    expect(screen.getByRole('group', { name: 'Classe de rentrée 2026' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Entrée en Première' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByRole('radio', { name: 'Voie générale' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Maths EDS' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'EAF voie générale' })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Voie générale' }));
    await user.click(screen.getByRole('radio', { name: 'Maths EDS' }));
    await user.click(screen.getByRole('radio', { name: 'EAF voie générale' }));
    await user.click(screen.getByRole('radio', { name: 'NSI et Physique-Chimie envisagées' }));
    expect(track.preRentreeTrackSelected).toHaveBeenCalledWith('premiere', 'maths_eds');
    expect(track.preRentreeTrackSelected).toHaveBeenCalledWith('premiere', 'eaf_generale');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
    await user.click(screen.getByRole('checkbox', { name: /Mathématiques/i }));
    await user.click(screen.getByRole('checkbox', { name: /Français.*EAF/i }));
    await user.click(screen.getByRole('button', { name: /Voir mon résumé/i }));

    const pack = dto.offerOptions.find((candidate) => candidate.level === 'PREMIERE' && candidate.subjectsCount === 2);
    expect(screen.getByText(`${pack?.price.toLocaleString('fr-TN')} TND`)).toBeInTheDocument();
    expect(screen.getByText(`Acompte : ${pack?.deposit.toLocaleString('fr-TN')} TND`)).toBeInTheDocument();
    expect(screen.getByText(`Solde : ${pack?.balance.toLocaleString('fr-TN')} TND`)).toBeInTheDocument();
    expect(screen.getAllByText('Campagne en préparation').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('PRE_REGISTRATION_OPEN');
    expect(screen.getByText(/validation du groupe par l'équipe Nexus/i)).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Demander ce parcours sur WhatsApp/i })).toHaveAttribute('href', expect.stringContaining('wa.me'));
    expect(screen.getByText('Du lundi 17 au vendredi 21 août · 13:30–15:30')).toBeInTheDocument();
    expect(screen.getByText('(nouvel onglet)')).toHaveClass('sr-only');
  });

  async function goToPremiereSubjects(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('radio', { name: 'Entrée en Première' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('radio', { name: 'Voie générale' }));
    await user.click(screen.getByRole('radio', { name: 'Maths EDS' }));
    await user.click(screen.getByRole('radio', { name: 'EAF voie générale' }));
    await user.click(screen.getByRole('radio', { name: 'NSI et Physique-Chimie envisagées' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
  }

  const checkedCount = () =>
    screen.getAllByRole('checkbox').filter((cb) => (cb as HTMLInputElement).checked).length;

  it('caps subject selection at four and never crashes on the 5th (D3 regression)', async () => {
    const user = userEvent.setup();
    renderConfigurator();
    await goToPremiereSubjects(user);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(5);

    // Tenter de sélectionner les 5 matières (si buildSelectionSummary était appelé avec 5,
    // il lèverait "Missing canonical campaign pack" et ferait planter le rendu).
    for (let i = 0; i < 5; i += 1) {
      await user.click(screen.getAllByRole('checkbox')[i]);
    }

    // La 5e est refusée : plafond à 4, message d'aide affiché, aucune erreur levée.
    expect(checkedCount()).toBe(4);
    expect(screen.getByRole('status')).toHaveTextContent('4 matières maximum');
    expect(document.body.textContent).not.toContain('Missing canonical campaign pack');
    // Le configurateur reste fonctionnel (bouton résumé actif avec 4 matières).
    expect(screen.getByRole('button', { name: /Voir mon résumé/i })).toBeEnabled();
  });

  it('re-allows the blocked subject after removing one at the cap (ajout/retrait)', async () => {
    const user = userEvent.setup();
    renderConfigurator();
    await goToPremiereSubjects(user);

    const checkboxes = screen.getAllByRole('checkbox');
    for (let i = 0; i < 4; i += 1) await user.click(checkboxes[i]);
    expect(checkedCount()).toBe(4);

    await user.click(checkboxes[4]); // refusé au plafond
    expect(checkedCount()).toBe(4);
    expect(screen.getByRole('status')).toBeInTheDocument();

    await user.click(checkboxes[0]); // on libère une place
    expect(checkedCount()).toBe(3);
    await user.click(checkboxes[4]); // la 5e devient sélectionnable
    expect(checkedCount()).toBe(4);
    expect((checkboxes[4] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps "Voir mon résumé" disabled with zero subjects', async () => {
    const user = userEvent.setup();
    renderConfigurator();
    await goToPremiereSubjects(user);

    expect(checkedCount()).toBe(0);
    expect(screen.getByRole('button', { name: /Voir mon résumé/i })).toBeDisabled();
  });

  it('links to a level-specific program without nesting an action inside the choice label', async () => {
    const user = userEvent.setup();
    renderConfigurator();

    await user.click(screen.getByRole('radio', { name: 'Entrée en Première' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('radio', { name: 'Voie générale' }));
    await user.click(screen.getByRole('radio', { name: 'Maths EDS' }));
    await user.click(screen.getByRole('radio', { name: 'EAF voie générale' }));
    await user.click(screen.getByRole('radio', { name: 'NSI et Physique-Chimie envisagées' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    const link = screen.getAllByRole('link', { name: 'Consulter le programme' })[0];
    expect(link).toHaveAttribute('href', '#programme-premiere-mathematiques');
    expect(link.closest('label')).toBeNull();
  });

  it('skips EDS profiles for Seconde and shows only the three approved subjects', async () => {
    const user = userEvent.setup();
    renderConfigurator();

    await user.click(screen.getByRole('radio', { name: 'Entrée en Seconde' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(screen.queryByText(/EDS NSI Seconde/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /SNT|initiation informatique/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('uses the three approved Seconde subject themes in choices and summary', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <StageConfigurator
        levels={dto.levels}
        subjects={dto.subjects}
        packs={dto.offerOptions}
        schedule={dto.schedule}
        academicProfiles={dto.academicProfiles}
        groupCompositionNotice={dto.content.practical.groupCompositionNotice}
        campaignPublicStatus={dto.publicStatus}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Entrée en Seconde' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    for (const family of ['MATHEMATIQUES', 'FRANCAIS', 'PHYSIQUE_CHIMIE']) {
      expect(container.querySelector(`[data-subject-family="${family}"]`)).toBeInTheDocument();
    }
    expect(container.querySelector('[data-subject-family="NSI"]')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Mathématiques/i }));
    expect(container.querySelectorAll('[data-subject-family="MATHEMATIQUES"]').length).toBeGreaterThanOrEqual(2);
  });

  it('limits Terminale retained specialties to two', async () => {
    const user = userEvent.setup();
    renderConfigurator();
    await user.click(screen.getByRole('radio', { name: 'Entrée en Terminale' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    const specialties = screen.getAllByRole('checkbox');
    await user.click(specialties[0]);
    await user.click(specialties[1]);
    await user.click(specialties[2]);
    expect(specialties[0]).toBeChecked();
    expect(specialties[1]).toBeChecked();
    expect(specialties[2]).not.toBeChecked();
  });

  it('blocks a certain Terminale Maths option contradiction before subject selection', async () => {
    const user = userEvent.setup();
    renderConfigurator();

    await user.click(screen.getByRole('radio', { name: 'Entrée en Terminale' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('radio', { name: 'Maths expertes' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Maths expertes nécessite la spécialité Mathématiques conservée.',
    );
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();
  });

  it('reports an incomplete pedagogical profile before subject selection', async () => {
    const user = userEvent.setup();
    renderConfigurator();

    await user.click(screen.getByRole('radio', { name: 'Entrée en Première' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(screen.getByText(/Complétez le profil pédagogique/i)).toBeInTheDocument();
  });

  it('keeps the persistent mobile summary collapsible', async () => {
    const user = userEvent.setup();
    renderConfigurator();

    await user.click(screen.getByRole('radio', { name: 'Entrée en Seconde' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('checkbox', { name: /Mathématiques/i }));

    const toggle = screen.getByRole('button', { name: /Afficher le résumé/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /Demander ce parcours sur WhatsApp/i })).toBeInTheDocument();
  });

  it('shows the public campaign status without an internal status label', async () => {
    const user = userEvent.setup();
    renderConfigurator();

    await user.click(screen.getByRole('radio', { name: 'Entrée en Seconde' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('checkbox', { name: /Mathématiques/i }));
    expect(screen.getByText('Campagne en préparation')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Statut de campagne');
  });
});
