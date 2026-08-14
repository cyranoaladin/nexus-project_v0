import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StagePlanningSelector } from '@/components/pre-rentree-2026/StagePlanningSelector';
import { getPreRentreeCampaign, getPreRentreeSchedule } from '@/lib/campaigns/pre-rentree-2026/getters';
import { compilePreRentreeReviewSurfaceDTO } from '@/lib/campaigns/pre-rentree-2026/public-surface';
import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';

jest.mock('@/lib/analytics', () => ({
  track: {
    preRentreeLevelSelected: jest.fn(),
    preRentreeSubjectSelected: jest.fn(),
  },
}));

const campaign = getPreRentreeCampaign();
const surfaceDto = compilePreRentreeReviewSurfaceDTO();
const dto = {
  levels: campaign.levels,
  subjects: campaign.subjects,
  capacityByLevel: surfaceDto.planning.capacityByLevel,
  schedule: surfaceDto.planning.schedule,
  offerOptions: surfaceDto.planning.offerOptions,
};

function renderSelector() {
  return render(
    <StagePlanningSelector
      levels={dto.levels}
      subjects={dto.subjects}
      schedule={dto.schedule}
      offerOptions={dto.offerOptions}
      capacityByLevel={dto.capacityByLevel}
      planningPdfHref="/documents/pre-rentree-2026/planning.pdf"
    />,
  );
}

describe('Pré-rentrée 2026 — sélecteur de planning parents', () => {
  it('état vide : invite à choisir un niveau, aucune matière proposée', () => {
    renderSelector();
    expect(screen.getByText('Sélectionnez un niveau pour afficher le planning.')).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByRole('link', { name: /Télécharger le planning complet/i })).toHaveAttribute(
      'href',
      '/documents/pre-rentree-2026/planning.pdf',
    );
  });

  it('niveau sélectionné : ne propose que les matières réellement offertes à ce niveau', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'SECONDE');
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(screen.getByRole('checkbox', { name: 'Mathématiques' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Français' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /NSI|Physique-Chimie/i })).not.toBeInTheDocument();
  });

  it('Terminale : n’affiche ni Français, ni les trois matières fermées le 14/08/2026', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'TERMINALE');
    for (const closed of ['Français', 'Mathématiques expertes', 'SVT', 'Philosophie']) {
      expect(screen.queryByRole('checkbox', { name: closed })).not.toBeInTheDocument();
    }
    for (const open of ['Mathématiques', 'NSI', 'Physique-Chimie']) {
      expect(screen.getByRole('checkbox', { name: open })).toBeInTheDocument();
    }
  });

  it('une matière cochée : recompose le planning chronologique sans exposer une salle non validée', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'TROISIEME');
    await user.click(screen.getByRole('checkbox', { name: 'Mathématiques' }));

    expect(screen.getByText(/17 août/)).toBeInTheDocument();
    expect(screen.getAllByText(/09:00–11:00/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/Salle\s+\d/i);
    const recap = screen.getByText('Matières').closest('dl') as HTMLElement;
    expect(within(recap).getByText('1')).toBeInTheDocument();
    expect(within(recap).getByText('10 h')).toBeInTheDocument();
    expect(screen.getByText(/capacité à confirmer/i)).toBeInTheDocument();
    expect(screen.getByText(
      'Itinéraire compact proposé, sous réserve de disponibilité dans les groupes.',
    )).toBeInTheDocument();
    expect(screen.getByRole('link', {
      name: 'Demander la disponibilité de ce parcours',
    })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it.each(['TROISIEME', 'SECONDE'] as const)(
    'Fondations %s, 2 matières (Maths + Français) : volume 20 h — non-régression du bug « Volume 0 h »',
    async (level) => {
      const user = userEvent.setup();
      renderSelector();

      await user.selectOptions(screen.getByLabelText('Classe de rentrée'), level);
      await user.click(screen.getByRole('checkbox', { name: 'Mathématiques' }));
      await user.click(screen.getByRole('checkbox', { name: 'Français' }));

      const recap = screen.getByText('Matières').closest('dl') as HTMLElement;
      expect(within(recap).getByText('2')).toBeInTheDocument();
      expect(within(recap).getByText('20 h')).toBeInTheDocument();
    },
  );

  it('plusieurs matières compatibles : aucun message de conflit, récap mis à jour', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'PREMIERE');
    await user.click(screen.getByRole('checkbox', { name: 'Mathématiques' }));
    await user.click(screen.getByRole('checkbox', { name: 'SVT' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('20 h')).toBeInTheDocument();
  });

  it('Premium Terminale, 1 à 3 matières : volume 10/20/30 h', async () => {
    // Le pack à 4 matières a été retiré en Terminale le 14/08/2026 : il n'y reste
    // que trois matières ouvertes. Il demeure vendable en Première, qui en compte cinq.
    const user = userEvent.setup();
    renderSelector();

    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'TERMINALE');
    const subjectsInOrder = ['Mathématiques', 'Physique-Chimie', 'NSI'];

    for (const [index, subjectLabel] of subjectsInOrder.entries()) {
      await user.click(screen.getByRole('checkbox', { name: subjectLabel }));
      const recap = screen.getByText('Matières').closest('dl') as HTMLElement;
      expect(within(recap).getByText(`${(index + 1) * 10} h`)).toBeInTheDocument();
    }
  });

  it('NSI + Mathématiques en Terminale : le dédoublement rend le parcours compact', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'TERMINALE');
    await user.click(screen.getByRole('checkbox', { name: 'NSI' }));
    await user.click(screen.getByRole('checkbox', { name: 'Mathématiques' }));

    // L'assignation choisit celui des deux groupes de mathématiques qui rend le
    // parcours compact — ici le groupe du matin, juste après NSI.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/Parcours compact/i)).toBeInTheDocument();
    const availability = screen.getByRole('link', { name: 'Demander la disponibilité de ce parcours' });
    expect(availability).not.toHaveAttribute('aria-disabled', 'true');
    expect(availability).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/21699192829\?text=/));
  });

  it('attente excessive : NSI + Physique-Chimie en Terminale désactive la demande et l’explique', async () => {
    // Depuis le dédoublement des mathématiques (14/08/2026), les deux groupes
    // occupent les blocs centraux : NSI ouvre la journée, la Physique-Chimie la
    // ferme, et les cumuler laisse 5 h 30 de battement. Aucun élève n'a souscrit
    // cette combinaison cette session, mais le site doit refuser de la proposer
    // plutôt que de la vendre — c'est cette branche que le test couvre.
    const user = userEvent.setup();
    renderSelector();

    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'TERMINALE');
    await user.click(screen.getByRole('checkbox', { name: 'NSI' }));
    await user.click(screen.getByRole('checkbox', { name: 'Physique-Chimie' }));

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(/330 minutes/i)).toBeInTheDocument();
    expect(within(alert).getByText(/attente/i)).toBeInTheDocument();
    // Le planning reste affiché (non bloquant) : les deux matières restent cochées.
    expect(screen.getByRole('checkbox', { name: 'NSI' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Physique-Chimie' })).toBeChecked();
    expect(screen.getByRole('link', { name: 'Demander la disponibilité de ce parcours' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('Mathématiques + Physique-Chimie en Terminale : 15 min d’attente (60 min avant le dédoublement)', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'TERMINALE');
    await user.click(screen.getByRole('checkbox', { name: 'Mathématiques' }));
    await user.click(screen.getByRole('checkbox', { name: 'Physique-Chimie' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // Le groupe de l'après-midi finit à 16 h 15, la Physique-Chimie enchaîne à
    // 16 h 30 : le dédoublement a raccourci l'attente de 60 à 15 minutes.
    expect(screen.getByText(/Parcours compact.*15 min/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Demander la disponibilité de ce parcours' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('attente longue : avertit et bloque le CTA comme parcours confirmé', async () => {
    // Après SCHEDULE-S5, aucune sélection réelle ne reste LONG_IDLE (voir les 2
    // tests ci-dessus) — cette branche du composant reste testée avec un planning
    // synthétique pour ne jamais devenir du code mort non couvert.
    const user = userEvent.setup();
    const syntheticSchedule = dto.schedule.map((slot) =>
      slot.level === 'TERMINALE' && slot.subject === 'MATHEMATIQUES'
        ? { ...slot, block: 'A', startTime: '09:00', endTime: '11:00' }
        : slot.level === 'TERMINALE' && slot.subject === 'PHYSIQUE_CHIMIE'
          ? { ...slot, block: 'D', startTime: '16:30', endTime: '18:30' }
          : slot,
    );
    render(
      <StagePlanningSelector
        levels={dto.levels}
        subjects={dto.subjects}
        schedule={syntheticSchedule}
        offerOptions={dto.offerOptions}
        capacityByLevel={dto.capacityByLevel}
        planningPdfHref="/documents/pre-rentree-2026/planning.pdf"
      />,
    );

    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'TERMINALE');
    await user.click(screen.getByRole('checkbox', { name: 'Mathématiques' }));
    await user.click(screen.getByRole('checkbox', { name: 'Physique-Chimie' }));

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(/330 minutes/)).toBeInTheDocument();
    expect(screen.queryByText(/Parcours compact/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Demander la disponibilité de ce parcours' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('parcours compact (Seconde Français + Mathématiques, 15 min) : badge positif, CTA actif', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'SECONDE');
    await user.click(screen.getByRole('checkbox', { name: 'Français' }));
    await user.click(screen.getByRole('checkbox', { name: 'Mathématiques' }));

    expect(screen.getByText(/Parcours compact.*15 min/i)).toBeInTheDocument();
    const availability = screen.getByRole('link', { name: 'Demander la disponibilité de ce parcours' });
    expect(availability).not.toHaveAttribute('aria-disabled', 'true');
    const message = decodeURIComponent(new URL(availability.getAttribute('href') ?? '').searchParams.get('text') ?? '');
    expect(message).toContain('Entrée en Seconde');
    expect(message).toContain('Français');
    expect(message).toContain('Mathématiques');
    expect(message).toContain('15 minutes');
    expect(message).toContain('sous réserve de places disponibles');
  });

  it('limite le pack à quatre matières et explique pourquoi la cinquième reste décochée', async () => {
    // Exercé en Première : depuis la fermeture des trois matières de Terminale
    // (14/08/2026), seule la Première compte assez de matières (cinq) pour qu'une
    // cinquième sélection puisse être refusée.
    const user = userEvent.setup();
    renderSelector();

    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'PREMIERE');
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(5);
    for (let index = 0; index < 4; index += 1) {
      await user.click(checkboxes[index]!);
    }
    await user.click(checkboxes[4]!);

    expect(checkboxes[4]).not.toBeChecked();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '4 matières maximum — retirez une matière pour en ajouter une autre.',
    );
    expect(screen.getByText('Matières').closest('dl')).toHaveTextContent('4');
  });

  it('changer de niveau réinitialise la sélection de matières', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'PREMIERE');
    await user.click(screen.getByRole('checkbox', { name: 'Mathématiques' }));
    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'TERMINALE');

    expect(screen.getByText(/Cochez au moins une matière/i)).toBeInTheDocument();
  });

  it('aucun nom propre d’enseignant, uniquement des rôles ou labels génériques', async () => {
    const user = userEvent.setup();
    renderSelector();
    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'TERMINALE');
    await user.click(screen.getByRole('checkbox', { name: 'NSI' }));

    expect(document.body.textContent).not.toMatch(/\b(?:M\.|Mme|Mlle|Professeur|Prof\.)\s+[A-ZÀ-Ý]/);
    expect(document.body.textContent).not.toMatch(/TEACHER_[A-Z]/);
  });
});

describe('Pré-rentrée 2026 — étanchéité stages/annuel : le sélecteur n’expose que la grille de stage', () => {
  const schedule = getPreRentreeSchedule();
  const scheduledSubjectsByLevel = new Map<EntryLevelCode, Set<string>>();
  for (const session of schedule) {
    const set = scheduledSubjectsByLevel.get(session.level) ?? new Set<string>();
    set.add(session.subject);
    scheduledSubjectsByLevel.set(session.level, set);
  }
  function labelFor(subjectId: string, level: EntryLevelCode): string {
    const subject = dto.subjects.find((candidate) => candidate.id === subjectId);
    return subject?.labelByLevel?.[level] ?? subject?.label ?? subjectId;
  }

  it.each(['QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE'] as EntryLevelCode[])(
    'le sélecteur de stage n’affiche, pour %s, que les matières réellement programmées dans la grille de pré-rentrée (source : getPreRentreeSchedule, pas SUBJECT_THEMES)',
    async (level) => {
      const user = userEvent.setup();
      renderSelector();
      await user.selectOptions(screen.getByLabelText('Classe de rentrée'), level);

      const shownLabels = screen.getAllByRole('checkbox').map((checkbox) => {
        const label = checkbox.closest('label');
        return label?.textContent?.trim();
      });
      const expectedSubjects = scheduledSubjectsByLevel.get(level) ?? new Set<string>();
      const expectedLabels = [...expectedSubjects].map((subjectId) => labelFor(subjectId, level)).sort();

      expect(expectedSubjects.size).toBeGreaterThan(0);
      expect([...shownLabels].sort()).toEqual(expectedLabels);
    },
  );

  it('Mathématiques expertes et Philosophie ne sont proposables à aucun niveau (fermées le 14/08/2026)', async () => {
    // Elles n'étaient ouvertes qu'en Terminale. La fermeture doit valoir partout :
    // une case résiduelle vendrait une matière que personne n'assure.
    const user = userEvent.setup();
    renderSelector();

    for (const level of ['QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE'] as EntryLevelCode[]) {
      await user.selectOptions(screen.getByLabelText('Classe de rentrée'), level);
      expect(screen.queryByRole('checkbox', { name: 'Mathématiques expertes' })).not.toBeInTheDocument();
      expect(screen.queryByText(/philosophie/i)).not.toBeInTheDocument();
    }
  });

  it('la SVT reste proposable en Première, et nulle part ailleurs', async () => {
    const user = userEvent.setup();
    renderSelector();

    for (const level of ['QUATRIEME', 'TROISIEME', 'SECONDE', 'TERMINALE'] as EntryLevelCode[]) {
      await user.selectOptions(screen.getByLabelText('Classe de rentrée'), level);
      expect(screen.queryByRole('checkbox', { name: 'SVT' })).not.toBeInTheDocument();
    }
    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'PREMIERE');
    expect(screen.getByRole('checkbox', { name: 'SVT' })).toBeInTheDocument();
  });
});

/**
 * GARDE-FOU DE NON-RÉGRESSION PERMANENT (2026-07-24, liste étendue 2026-07-27
 * pour la mission 4e/Philosophie).
 *
 * Objectif : empêcher toute réintroduction future — accidentelle ou non — d'une
 * matière hors grille de stage dans le sélecteur, pour n'importe quel niveau.
 * Contrairement aux tests ci-dessus (qui comparent le sélecteur à la grille
 * datée), celui-ci vérifie le sélecteur contre une LISTE FERMÉE des seules
 * matières qu'un stage de pré-rentrée peut légitimement proposer. Si ce test
 * casse un jour, c'est le signal qu'une matière nouvelle a été ajoutée quelque
 * part (SUBJECT_THEMES, campaign.subjects, commercial-contract) sans passer par
 * une révision explicite de cette liste — donc sans décision consciente sur
 * l'étanchéité stages/annuel.
 */
describe('Pré-rentrée 2026 — garde-fou permanent : aucune matière hors grille de stage, pour aucun niveau', () => {
  const ALLOWED_STAGE_SUBJECT_LABELS = new Set([
    'Mathématiques',
    'Français',
    'Français — préparation à l’EAF',
    'NSI',
    'Physique-Chimie',
    'SVT',
    'Mathématiques expertes',
    'Philosophie',
  ]);

  it.each(['QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE'] as EntryLevelCode[])(
    'niveau %s : chaque matière affichée appartient à la liste fermée des matières de stage autorisées',
    async (level) => {
      const user = userEvent.setup();
      renderSelector();
      await user.selectOptions(screen.getByLabelText('Classe de rentrée'), level);

      const shownLabels = screen.getAllByRole('checkbox').map((checkbox) => checkbox.closest('label')?.textContent?.trim());
      expect(shownLabels.length).toBeGreaterThan(0);
      for (const label of shownLabels) {
        expect(ALLOWED_STAGE_SUBJECT_LABELS.has(label ?? '')).toBe(true);
      }
    },
  );
});
