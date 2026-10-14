import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AriaCockpitDTO } from '@/lib/aria/cockpit/contracts';
import fixture from '@/e2e/fixtures/aria/cockpit-terminale-eds.json';

const mockSessionState: { data: unknown; status: string } = {
  data: null,
  status: 'loading',
};
const mockProtectedFetch = jest.fn();
const mockRouterPush = jest.fn();
const mockRouter = { push: mockRouterPush };
const mockAriaChatLauncher = jest.fn((props: unknown) => {
  void props;
  return (
    <button type="button" data-testid="mock-aria-chat-launcher">
      Ouvrir ARIA
    </button>
  );
});

jest.mock('@/components/auth/SessionRecoveryProvider', () => ({
  useProtectedFetch: () => mockProtectedFetch,
  useCanonicalSession: () => mockSessionState,
  useSessionMutationSuspended: () => false,
}));
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/components/aria/AriaChatLauncher', () => ({
  AriaChatLauncher: (props: unknown) => mockAriaChatLauncher(props),
}));

jest.mock('@/hooks/use-core-membership', () => ({ useCoreMembership: () => ({ state: (mockSessionState.data as { user: { id: string } }).user.id === 'student-v2' ? 'ACTIVE' : 'NOT_MEMBER', role: 'ELEVE', retry: jest.fn() }) }));

import AriaCockpitPage from '@/app/dashboard/eleve/aria/page';

const CORE_V2_LEGACY_ARIA_REQUEST = /^\/api\/aria(?:\/|\?|$)/;

function cockpit(chat: boolean, history = chat): AriaCockpitDTO {
  return {
    ...fixture,
    capabilities: {
      chat,
      trajectory: chat,
      assessments: chat,
      resources: chat,
      nextSession: chat,
      conversationHistory: history,
      courseWorkspace: chat,
    },
  } as unknown as AriaCockpitDTO;
}

function response(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

function requestedUrls(): string[] {
  return mockProtectedFetch.mock.calls.map(([input]) => String(input));
}

describe('/dashboard/eleve/aria — chat deployment capability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionState.status = 'authenticated';
  });

  it('V1-authenticated Core student mounts no launcher or course workspace and calls no legacy ARIA route', async () => {
    mockSessionState.data = {
      user: { id: 'student-v2', role: 'ELEVE', authority: 'V1' },
    };
    mockProtectedFetch.mockResolvedValue(response({ ok: true, data: cockpit(false) }));

    render(<AriaCockpitPage />);

    expect(await screen.findByTestId('aria-cockpit-page')).toBeInTheDocument();
    expect(mockProtectedFetch).toHaveBeenCalledWith('/api/v2/aria/cockpit');
    expect(mockAriaChatLauncher).not.toHaveBeenCalled();
    expect(screen.queryByTestId('mock-aria-chat-launcher')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ouvrir.*aria|démarrer.*chat/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('aria-nav-ARIA'));
    expect(screen.queryByText('Démarrer une conversation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Maths|NSI/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('aria-nav-CURRICULUM'));
    expect(screen.queryByRole('button', { name: 'Ouvrir' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('aria-work-with-aria')).not.toBeInTheDocument();
    expect(mockAriaChatLauncher).not.toHaveBeenCalled();

    await waitFor(() => {
      const forbidden = requestedUrls().filter((url) => CORE_V2_LEGACY_ARIA_REQUEST.test(url));
      expect(forbidden).toEqual([]);
    });
  });

  it('V1 keeps the existing chat launcher when chat is deployed', async () => {
    mockSessionState.data = {
      user: { id: 'student-v1', role: 'ELEVE', authority: 'V1' },
    };
    mockProtectedFetch.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/aria/workshops')) return response({ workshops: [] });
      if (url.startsWith('/api/aria/mastery/course')) return response({ skills: [] });
      if (url.startsWith('/api/aria/next-best-action')) return response({ action: null });
      return response(cockpit(true));
    });

    render(<AriaCockpitPage />);

    expect(await screen.findByTestId('aria-cockpit-page')).toBeInTheDocument();
    expect(mockProtectedFetch).toHaveBeenCalledWith('/api/aria/cockpit');
    expect(mockAriaChatLauncher).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('mock-aria-chat-launcher')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('aria-nav-CURRICULUM'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Ouvrir' })[0]!);
    await waitFor(() => {
      expect(requestedUrls()).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^\/api\/aria\/mastery\/course/),
          expect.stringMatching(/^\/api\/aria\/next-best-action/),
          expect.stringMatching(/^\/api\/aria\/workshops/),
        ]),
      );
    });
    expect(screen.getAllByRole('button', { name: 'Ma carte scolaire' })).toHaveLength(2);
  });

  it('keeps a history/recovery launcher when Core v2 chat rollout is disabled', async () => {
    mockSessionState.data = {
      user: { id: 'student-v2', role: 'ELEVE', authority: 'V1' },
    };
    mockProtectedFetch.mockResolvedValue(response({ ok: true, data: {
      ...cockpit(false, true),
      activeConversationCourseKey: 'maths-terminale-eds',
    } }));

    render(<AriaCockpitPage />);

    expect(await screen.findByTestId('aria-cockpit-page')).toBeInTheDocument();
    expect(mockAriaChatLauncher).toHaveBeenCalledWith(expect.objectContaining({
      initialCourseKey: 'maths-terminale-eds',
      recoveryOnly: true,
    }));
    expect(screen.getByTestId('mock-aria-chat-launcher')).toBeInTheDocument();
  });
});
