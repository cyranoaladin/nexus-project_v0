"use client";

import { useEffect, useRef } from "react";
import { getJitsiDomain } from "@/lib/jitsi";

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

    // Configuration Jitsi Meet — le domaine vient de la même autorité que le
    // reste de l'app (NEXT_PUBLIC_JITSI_SERVER_URL, cf. lib/jitsi.ts) : un
    // domaine en dur ici rendrait toute instance Jitsi auto-hébergée
    // silencieusement inopérante, quelle que soit la configuration.
    const domain = getJitsiDomain();
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

    // Utiliser ts-expect-error car l'API est injectée par le script Jitsi
    // @ts-expect-error JitsiMeetExternalAPI is provided at runtime
    const api = new window.JitsiMeetExternalAPI(domain, options);

    // A participant closing the iframe (hangup button, or the iframe
    // signalling it is ready to be torn down) must actually notify the
    // page — previously nothing was wired here, so leaving never called
    // `onLeave` at all, and the page's own cleanup/redirect never ran.
    // This is UI-only: it must never itself mark the underlying
    // SessionBooking COMPLETED (that stays the coach's explicit report
    // submission, see app/api/coach/sessions/[sessionId]/report/route.ts)
    // — one participant leaving must never end the session for the other.
    api.addListener('readyToClose', onLeave);
    api.addListener('videoConferenceLeft', onLeave);

    return () => {
      api?.removeListener?.('readyToClose', onLeave);
      api?.removeListener?.('videoConferenceLeft', onLeave);
      api?.dispose();
    };
  }, [roomName, studentName, coachName, isHost, onLeave]);

  return (
    <div className={className} data-session-id={sessionId}>
      <div ref={jitsiContainerRef} className="w-full h-full min-h-[600px]" />
    </div>
  );
}
