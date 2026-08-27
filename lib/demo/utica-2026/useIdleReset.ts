'use client';

/**
 * Reset automatique après inactivité (P2 §9) — comportement salon : entre
 * deux visiteurs, l'écran revient seul à l'accueil UTICA. Détecte
 * pointer/souris/clavier/tactile ; le minuteur est remis à zéro à chaque
 * activité (jamais un déclenchement en quelques secondes pendant une
 * présentation active). Aucun listener ne fuit : tout est nettoyé au démontage.
 */
import { useEffect, useRef } from 'react';

/** ~5 minutes — constante explicite, jamais un littéral `300000` dispersé dans le code. */
export const UTICA_DEMO_IDLE_RESET_MS = 5 * 60_000;

const ACTIVITY_EVENTS = ['pointerdown', 'mousemove', 'keydown', 'touchstart'] as const;

export function useIdleReset(onIdle: () => void, timeoutMs: number = UTICA_DEMO_IDLE_RESET_MS): void {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function reset() {
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), timeoutMs);
    }

    reset();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, reset, { passive: true });
    }

    return () => {
      clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, reset);
      }
    };
  }, [timeoutMs]);
}
