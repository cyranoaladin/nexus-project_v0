"use client";

import { useEffect, useRef } from "react";

interface VideoConferenceProps {
  sessionId: string;
  studentName: string;
  coachName: string;
  roomName: string;
  isHost: boolean;
  onLeave: () => void;
  className?: string;
}

export function VideoConference({
  sessionId,
  studentName,
  coachName,
  roomName,
  isHost,
  onLeave,
  className
}: VideoConferenceProps) {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!jitsiContainerRef.current) return;

    // Configuration Jitsi Meet
    const domain = 'meet.jit.si';
    const options = {
      roomName: roomName,
      width: '100%',
      height: '100%',
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName: isHost ? coachName : studentName
      },
      configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: true,
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
          'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
          'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
          'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts'
        ],
      }
    };

    // @ts-ignore - JitsiMeetExternalAPI est chargé dynamiquement
    const api = new window.JitsiMeetExternalAPI(domain, options);

    return () => {
      api?.dispose();
    };
  }, [roomName, studentName, coachName, isHost]);

  return (
    <div className={className}>
      <div ref={jitsiContainerRef} className="w-full h-full min-h-[600px]" />
    </div>
  );
}
