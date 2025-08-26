"use client";

import { useEffect, useRef, useState } from "react";

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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const serverUrl = process.env.NEXT_PUBLIC_JITSI_SERVER_URL || 'https://meet.jit.si';
    const scriptSrc = `${serverUrl.replace(/\/$/, '')}/external_api.js`;

    if (typeof window !== 'undefined' && !(window as any).JitsiMeetExternalAPI) {
      const s = document.createElement('script');
      s.src = scriptSrc;
      s.async = true;
      s.onload = () => setReady(true);
      s.onerror = () => setReady(false);
      document.body.appendChild(s);
    } else {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!jitsiContainerRef.current) return;
    if (!ready) return;

    // Configuration Jitsi Meet
    const serverUrl = process.env.NEXT_PUBLIC_JITSI_SERVER_URL || 'https://meet.jit.si';
    const domain = new URL(serverUrl).host;
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
    } as any;

    // @ts-ignore - JitsiMeetExternalAPI est chargé dynamiquement
    const api = new (window as any).JitsiMeetExternalAPI(domain, options);

    return () => {
      try { (api as any)?.dispose?.(); } catch {}
    };
  }, [roomName, studentName, coachName, isHost, ready]);

  return (
    <div className={className}>
      <div ref={jitsiContainerRef} className="w-full h-full min-h-[600px]" />
    </div>
  );
}
