import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StagePlanningSelector } from '@/components/pre-rentree-2026/StagePlanningSelector';
import { getPreRentreeLandingDTO, getPreRentreeSchedule } from '@/lib/campaigns/pre-rentree-2026/getters';
import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';

jest.mock('@/lib/analytics', () => ({
  track: {
    preRentreeLevelSelected: jest.fn(),
    preRentreeSubjectSelected: jest.fn(),
  },
}));

const dto = getPreRentreeLandingDTO();

function renderSelector() {
  return render(
    <StagePlanningSelector
      levels={dto.levels}
      subjects={dto.subjects}
      schedule={dto.schedule}
      offerOptions={dto.offerOptions}
      incompatibilities={dto.subjectIncompatibilities}
      capacityByOffer={dto.capacityByOffer}
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

  it('Terminale : n’affiche jamais Français, propose Maths expertes', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'TERMINALE');
    expect(screen.queryByRole('checkbox', { name: 'Français' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Mathématiques expertes' })).toBeInTheDocument();
  });

  it('une matière cochée : recompose le planning chronologique avec date, horaire et salle', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'TROISIEME');
    await user.click(screen.getByRole('checkbox', { name: 'Mathématiques' }));

    expect(screen.getByText(/17 août/)).toBeInTheDocument();
    expect(screen.getAllByText(/09:00–11:00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Salle 1/).length).toBeGreaterThan(0);
    const recap = screen.getByText('Matières').closest('dl') as HTMLElement;
    expect(within(recap).getByText('1')).toBeInTheDocument();
    expect(within(recap).getByText('10 h')).toBeInTheDocument();
  });

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

  it('conflit détecté : NSI et SVT en Terminale (bloc C) affichent un message clair et non bloquant', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'TERMINALE');
    await user.click(screen.getByRole('checkbox', { name: 'NSI' }));
    await user.click(screen.getByRole('checkbox', { name: 'SVT' }));

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(/même créneau/i)).toBeInTheDocument();
    expect(within(alert).getByText('NSI')).toBeInTheDocument();
    expect(within(alert).getByText('SVT')).toBeInTheDocument();
    // Le planning reste affiché (non bloquant) : les deux matières sont toujours cochées.
    expect(screen.getByRole('checkbox', { name: 'NSI' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'SVT' })).toBeChecked();
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
    await user.click(screen.getByRole('checkbox', { name: 'SVT' }));

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

  it.each(['TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE'] as EntryLevelCode[])(
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
      // Philosophie n'existe dans AUCUN stage de pré-rentrée : jamais dans la liste attendue,
      // et donc jamais affichée, quel que soit le niveau.
      expect(expectedSubjects.has('PHILOSOPHIE')).toBe(false);
      expect(shownLabels).not.toContain('Philosophie');
    },
  );

  it('Mathématiques expertes n’est proposable qu’en Terminale (jamais 3e, Seconde ou Première)', async () => {
    const user = userEvent.setup();
    renderSelector();

    for (const level of ['TROISIEME', 'SECONDE', 'PREMIERE'] as EntryLevelCode[]) {
      await user.selectOptions(screen.getByLabelText('Classe de rentrée'), level);
      expect(screen.queryByRole('checkbox', { name: 'Mathématiques expertes' })).not.toBeInTheDocument();
    }
    await user.selectOptions(screen.getByLabelText('Classe de rentrée'), 'TERMINALE');
    expect(screen.getByRole('checkbox', { name: 'Mathématiques expertes' })).toBeInTheDocument();
  });

  it('Philosophie n’apparaît jamais, sous aucune forme, dans le sélecteur (aucun niveau)', async () => {
    const user = userEvent.setup();
    renderSelector();
    for (const level of ['TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE'] as EntryLevelCode[]) {
      await user.selectOptions(screen.getByLabelText('Classe de rentrée'), level);
      expect(screen.queryByText(/philosophie/i)).not.toBeInTheDocument();
    }
  });
});

/**
 * GARDE-FOU DE NON-RÉGRESSION PERMANENT (2026-07-24).
 *
 * Objectif : empêcher toute réintroduction future — accidentelle ou non — d'une
 * matière hors grille de stage dans le sélecteur (Philosophie ou toute autre),
 * pour n'importe quel niveau. Contrairement aux tests ci-dessus (qui comparent le
 * sélecteur à la grille datée), celui-ci vérifie le sélecteur contre une LISTE
 * FERMÉE des seules matières qu'un stage de pré-rentrée peut légitimement
 * proposer. Si ce test casse un jour, c'est le signal qu'une matière nouvelle a
 * été ajoutée quelque part (SUBJECT_THEMES, campaign.subjects, commercial-contract)
 * sans passer par une révision explicite de cette liste — donc sans décision
 * consciente sur l'étanchéité stages/annuel.
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
  ]);

  it.each(['TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE'] as EntryLevelCode[])(
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
