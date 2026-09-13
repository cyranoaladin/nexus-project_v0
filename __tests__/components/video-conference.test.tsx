import { render, cleanup } from '@testing-library/react';
import { VideoConference } from '@/components/ui/video-conference';

describe('VideoConference', () => {
  let listeners: Record<string, (() => void)[]>;
  let disposeSpy: jest.Mock;
  let constructorSpy: jest.Mock;

  beforeEach(() => {
    listeners = {};
    disposeSpy = jest.fn();
    constructorSpy = jest.fn();

    (window as any).JitsiMeetExternalAPI = jest.fn().mockImplementation((domain: string, options: unknown) => {
      constructorSpy(domain, options);
      return {
        addListener: jest.fn((event: string, handler: () => void) => {
          listeners[event] = listeners[event] ?? [];
          listeners[event].push(handler);
        }),
        removeListener: jest.fn(),
        dispose: disposeSpy,
      };
    });
  });

  afterEach(() => {
    cleanup();
    delete (window as any).JitsiMeetExternalAPI;
    delete process.env.NEXT_PUBLIC_JITSI_SERVER_URL;
  });

  const baseProps = {
    sessionId: 'session-1',
    studentName: 'Eleve Test',
    coachName: 'Coach Test',
    roomName: 'nexus-reussite-room-abc123',
    isHost: false,
    onLeave: jest.fn(),
  };

  it('initialises JitsiMeetExternalAPI with the configured domain, not a hardcoded one', () => {
    process.env.NEXT_PUBLIC_JITSI_SERVER_URL = 'https://visio.nexusreussite.academy';
    render(<VideoConference {...baseProps} />);

    expect(constructorSpy).toHaveBeenCalledWith(
      'visio.nexusreussite.academy',
      expect.objectContaining({ roomName: 'nexus-reussite-room-abc123' }),
    );
  });

  it('falls back to meet.jit.si only when NEXT_PUBLIC_JITSI_SERVER_URL is unset', () => {
    render(<VideoConference {...baseProps} />);

    expect(constructorSpy).toHaveBeenCalledWith('meet.jit.si', expect.anything());
  });

  it('calls onLeave when the Jitsi iframe signals readyToClose — previously nothing was wired here at all', () => {
    const onLeave = jest.fn();
    render(<VideoConference {...baseProps} onLeave={onLeave} />);

    expect(listeners.readyToClose).toBeDefined();
    listeners.readyToClose[0]();

    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('calls onLeave when the Jitsi iframe signals videoConferenceLeft', () => {
    const onLeave = jest.fn();
    render(<VideoConference {...baseProps} onLeave={onLeave} />);

    listeners.videoConferenceLeft[0]();

    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('disposes the Jitsi instance on unmount without throwing', () => {
    const { unmount } = render(<VideoConference {...baseProps} />);

    expect(() => unmount()).not.toThrow();
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });
});
