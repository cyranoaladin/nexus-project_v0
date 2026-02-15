'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

interface SplashScreenProps {
    onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
    const [text, setText] = useState('');
    const [isFadingOut, setIsFadingOut] = useState(false);

    const fullText = "Viser. Atteindre. Dépasser.";
    const typingSpeed = 40; // ms per char
    const initialDelay = 800; // ms before typing starts
    const postTypingDelay = 1200; // ms to wait after typing finishes
    const fadeOutDuration = 500; // ms

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        let charIndex = 0;

        // Start typing after initial delay
        const startTyping = () => {
            const typeChar = () => {
                if (charIndex < fullText.length) {
                    setText(fullText.slice(0, charIndex + 1));
                    charIndex++;
                    timeoutId = setTimeout(typeChar, typingSpeed);
                } else {
                    // Finished typing
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
    }, [onComplete]);

    return (
        <div
            id="nexus-splash"
            className={`fixed inset-0 bg-white flex justify-center items-center z-[10000] ${isFadingOut ? 'opacity-0 transition-opacity duration-500 pointer-events-none' : ''}`}
        >
            <div className="flex flex-col items-center">
                {/* Logo with bounce animation */}
                <div className="animate-bounce-in opacity-0">
                    <Image
                        src="/images/logo.png"
                        alt="Nexus Réussite"
                        width={140}
                        height={140}
                        className="w-[140px] h-auto"
                        priority
                    />
                </div>

                {/* Typewriter text container */}
                <div className="mt-[30px] font-sans font-extrabold text-[1.8rem] h-[40px] flex items-center">
                    <span style={{ color: '#004aad' }}>{text}</span>
                    <span
                        className="animate-blink font-bold ml-1"
                        style={{ color: '#e30613' }}
                    >
                        |
                    </span>
                </div>
            </div>

            <style jsx global>{`
        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0.3) rotate(-20deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        
        .animate-bounce-in {
          animation: bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55) forwards;
        }
        
        @keyframes blink {
          50% { opacity: 0; }
        }
        
        .animate-blink {
          animation: blink 0.6s step-end infinite;
        }
      `}</style>
        </div>
    );
}
