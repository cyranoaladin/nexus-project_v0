import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import SessionVideoCall from '@/app/session/video/page';

describe('/session/video availability', () => {
  const previousMode = process.env.NEXT_PUBLIC_VIDEO_MODE;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_VIDEO_MODE = 'DISABLED';
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: 'student-1', role: 'ELEVE' } },
      status: 'authenticated',
    });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
    if (previousMode === undefined) delete process.env.NEXT_PUBLIC_VIDEO_MODE;
    else process.env.NEXT_PUBLIC_VIDEO_MODE = previousMode;
  });

  it('shows disabled availability on direct navigation without joining or loading Jitsi', async () => {
    render(<SessionVideoCall />);

    expect(await screen.findByText('Visioconférence intégrée non activée sur cette Preview.')).toBeVisible();
    expect(document.querySelector('[data-video-mode="DISABLED"]')).not.toBeNull();
    await waitFor(() => expect(global.fetch).not.toHaveBeenCalled());
    expect(document.querySelector('script[src*="external_api.js"]')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.queryByText(/Rejoindre/)).toBeNull();
  });
});
