import { render, screen, within } from '@testing-library/react';
import {
  AriaAgentPanel,
  AriaAssessmentsPanel,
  AriaCourseWorkspace,
  AriaResourcesPanel,
  AriaTodayPanel,
  AriaTrajectoryPanel,
} from '@/components/aria/cockpit';
import type { AriaCockpitCapabilitiesDTO, AriaCockpitDTO } from '@/lib/aria/cockpit/contracts';
import fixture from '@/e2e/fixtures/aria/cockpit-terminale-eds.json';

const UNAVAILABLE_COPY = 'Fonction non encore disponible pour ce profil';
const baseCockpit = fixture as unknown as AriaCockpitDTO;

function cockpit(
  capabilityOverrides: Partial<AriaCockpitCapabilitiesDTO>,
  payloadOverrides: Partial<AriaCockpitDTO> = {},
): AriaCockpitDTO {
  return {
    ...baseCockpit,
    trajectory: null,
    resources: [],
    assessments: [],
    nextSession: null,
    aria: {
      ...baseCockpit.aria,
      totalConversations: 0,
      messagesToday: 0,
    },
    ...payloadOverrides,
    capabilities: {
      ...baseCockpit.capabilities,
      ...capabilityOverrides,
    },
  };
}

const CAPABILITY_CASES = [
  {
    capability: 'trajectory' as const,
    emptyLabels: ['Aucune trajectoire active'],
    renderPanel: (value: AriaCockpitDTO) => render(<AriaTrajectoryPanel cockpit={value} />),
  },
  {
    capability: 'resources' as const,
    emptyLabels: ['Aucune ressource disponible'],
    renderPanel: (value: AriaCockpitDTO) => render(<AriaResourcesPanel cockpit={value} />),
  },
  {
    capability: 'assessments' as const,
    emptyLabels: ['Aucun bilan pour l’instant'],
    renderPanel: (value: AriaCockpitDTO) => render(<AriaAssessmentsPanel cockpit={value} />),
  },
  {
    capability: 'nextSession' as const,
    emptyLabels: ['Aucune séance programmée.'],
    renderPanel: (value: AriaCockpitDTO) => render(<AriaTodayPanel cockpit={value} />),
  },
  {
    capability: 'conversationHistory' as const,
    emptyLabels: ['Conversations', 'Messages aujourd’hui'],
    renderPanel: (value: AriaCockpitDTO) => render(<AriaAgentPanel cockpit={value} onOpenChat={jest.fn()} />),
  },
] as const;

describe('ARIA cockpit capability availability', () => {
  it.each(CAPABILITY_CASES)(
    '$capability=false renders neutral unavailability instead of an empty-data claim',
    ({ capability, emptyLabels, renderPanel }) => {
      renderPanel(cockpit({ [capability]: false }));

      expect(screen.getByText(UNAVAILABLE_COPY)).toBeInTheDocument();
      for (const emptyLabel of emptyLabels) {
        expect(screen.queryByText(emptyLabel)).not.toBeInTheDocument();
      }
    },
  );

  it.each(CAPABILITY_CASES)(
    '$capability=true with an empty payload preserves the V1 available-empty label',
    ({ capability, emptyLabels, renderPanel }) => {
      renderPanel(cockpit({ [capability]: true }));

      for (const emptyLabel of emptyLabels) {
        expect(screen.getByText(emptyLabel)).toBeInTheDocument();
      }
      expect(screen.queryByText(UNAVAILABLE_COPY)).not.toBeInTheDocument();
    },
  );

  it('conversationHistory=false suppresses both history counters without disabling deployed chat', () => {
    render(
      <AriaAgentPanel
        cockpit={cockpit(
          { chat: true, conversationHistory: false },
          {
            aria: {
              ...baseCockpit.aria,
              totalConversations: 12,
              messagesToday: 7,
            },
          },
        )}
        onOpenChat={jest.fn()}
      />,
    );

    expect(screen.getByText(UNAVAILABLE_COPY)).toBeInTheDocument();
    expect(screen.queryByText('Conversations')).not.toBeInTheDocument();
    expect(screen.queryByText('Messages aujourd’hui')).not.toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
    expect(screen.queryByText('7')).not.toBeInTheDocument();
    expect(screen.getByText('Démarrer une conversation')).toBeInTheDocument();
  });

  it('conversationHistory=true preserves the two available-empty counters even when chat is unavailable', () => {
    render(<AriaAgentPanel cockpit={cockpit({ chat: false, conversationHistory: true })} />);

    const conversations = screen.getByText('Conversations').parentElement;
    const messages = screen.getByText('Messages aujourd’hui').parentElement;
    expect(conversations).not.toBeNull();
    expect(messages).not.toBeNull();
    expect(within(conversations!).getByText('0')).toBeInTheDocument();
    expect(within(messages!).getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Le chat ARIA n’est pas encore disponible pour ce profil.')).toBeInTheDocument();
    expect(screen.queryByText('Démarrer une conversation')).not.toBeInTheDocument();
  });

  it.each([
    {
      capability: 'resources' as const,
      emptyLabel: 'Aucune ressource rattachée',
    },
    {
      capability: 'assessments' as const,
      emptyLabel: 'Aucun bilan pour cette matière',
    },
  ])(
    'course workspace $capability=false renders neutral unavailability instead of an empty-data claim',
    ({ capability, emptyLabel }) => {
      const courseKey = baseCockpit.curriculum.courses.find((view) => view.access.academicallyRelevant)!.course.key;
      render(
        <AriaCourseWorkspace
          cockpit={cockpit({ [capability]: false })}
          courseKey={courseKey}
          onBack={jest.fn()}
          onWorkWithAria={jest.fn()}
        />,
      );

      expect(screen.getByText(UNAVAILABLE_COPY)).toBeInTheDocument();
      expect(screen.queryByText(emptyLabel)).not.toBeInTheDocument();
    },
  );

  it.each([
    {
      capability: 'resources' as const,
      emptyLabel: 'Aucune ressource rattachée',
    },
    {
      capability: 'assessments' as const,
      emptyLabel: 'Aucun bilan pour cette matière',
    },
  ])('course workspace $capability=true preserves its available-empty label', ({ capability, emptyLabel }) => {
    const courseKey = baseCockpit.curriculum.courses.find((view) => view.access.academicallyRelevant)!.course.key;
    render(
      <AriaCourseWorkspace
        cockpit={cockpit({ [capability]: true })}
        courseKey={courseKey}
        onBack={jest.fn()}
        onWorkWithAria={jest.fn()}
      />,
    );

    expect(screen.getByText(emptyLabel)).toBeInTheDocument();
  });
});
