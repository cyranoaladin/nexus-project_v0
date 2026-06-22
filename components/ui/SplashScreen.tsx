'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

interface SplashScreenProps {
    onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
    const [text, setText] = useState('');
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);

    const fullText = "Viser. Atteindre. Dépasser.";
    const typingSpeed = 40;
    const initialDelay = 800;
    const postTypingDelay = 1200;
    const fadeOutDuration = 500;

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReducedMotion(mq.matches);
    }, []);

    useEffect(() => {
        // Skip animation entirely if reduced motion
        if (reducedMotion) {
            setText(fullText);
            const id = setTimeout(() => onComplete(), 600);
            return () => clearTimeout(id);
        }

        let timeoutId: NodeJS.Timeout;
        let charIndex = 0;

        const startTyping = () => {
            const typeChar = () => {
                if (charIndex < fullText.length) {
                    setText(fullText.slice(0, charIndex + 1));
                    charIndex++;
                    timeoutId = setTimeout(typeChar, typingSpeed);
                } else {
                    timeoutId = setTimeout(() => {
                        setIsFadingOut(true);
                        timeoutId = setTimeout(() => {
                            onComplete();
                        }, fadeOutDuration);
                    }, postTypingDelay);
                }
            };

            typeChar();
        };

        timeoutId = setTimeout(startTyping, initialDelay);

        return () => clearTimeout(timeoutId);
    }, [onComplete, reducedMotion]);

    return (
        <div
            id="nexus-splash"
            role="status"
            aria-live="polite"
            aria-label="Chargement de Nexus Réussite"
            className={`fixed inset-0 bg-lux-ivory flex justify-center items-center z-[10000] ${isFadingOut ? 'opacity-0 transition-opacity duration-500 motion-reduce:transition-none pointer-events-none' : ''}`}
        >
            <div className="flex flex-col items-center">
                {/* Logo with bounce animation */}
                <div className="splash-bounce-in opacity-0 motion-reduce:opacity-100 motion-reduce:animate-none">
                    <Image
                        src="/images/logo.png"
                        alt="Nexus Réussite"
                        width={140}
                        height={140}
                        className="w-[140px] h-auto"
                        priority
                    />
                </div>

                {/* Filet or — marque */}
                <div className="lux-filet-gold mt-5 w-12" />

                {/* Typewriter text */}
                <div className="mt-4 font-fraunces font-semibold text-[1.6rem] md:text-[1.8rem] h-[40px] flex items-center">
                    <span className="text-lux-ink">{text}</span>
                    <span
                        className="splash-blink font-bold ml-1 text-lux-gold motion-reduce:hidden"
                        aria-hidden="true"
                    >
                        |
                    </span>
                </div>
            </div>

            <style jsx global>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes splashBounceIn {
            0% {
              opacity: 0;
              transform: scale(0.3) rotate(-20deg);
            }
            100% {
              opacity: 1;
              transform: scale(1) rotate(0deg);
            }
          }

          .splash-bounce-in {
            animation: splashBounceIn 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55) forwards;
          }

          @keyframes splashBlink {
            50% { opacity: 0; }
          }

          .splash-blink {
            animation: splashBlink 0.6s step-end infinite;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .splash-bounce-in {
            opacity: 1 !important;
            animation: none !important;
          }
          .splash-blink {
            animation: none !important;
            display: none;
          }
        }
      `}</style>
        </div>
    );
}
