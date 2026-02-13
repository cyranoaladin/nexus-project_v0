"use client";

import React, { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Check } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const DNASectionGSAP = () => {
    const sectionRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            const mm = gsap.matchMedia();

            mm.add("(prefers-reduced-motion: no-preference)", () => {
                // Simple fade in for values
                gsap.fromTo('.dna-item',
                    { opacity: 0, x: -20 },
                    {
                        scrollTrigger: {
                            trigger: sectionRef.current,
                            start: 'top 80%',
                        },
                        opacity: 1,
                        x: 0,
                        stagger: 0.1,
                        duration: 0.8
                    }
                );
            });

            mm.add("(prefers-reduced-motion: reduce)", () => {
                gsap.set('.dna-item', { opacity: 1, x: 0 });
            });
        }, sectionRef);

        return () => ctx.revert();
    }, []);

    const values = [
        "Coachs agrégés et certifiés",
        "IA ARIA disponible 24/7",
        "Suivi parent clair et continu",
        "Méthode Bac et rigueur",
        "Résultats mesurables"
    ];

    return (
        <section ref={sectionRef} id="adn" className="py-24 bg-neutral-950 border-t border-white/5 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-30">
                <div className="absolute -top-10 right-[-10%] h-72 w-72 rounded-full bg-brand-accent/10 blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-5%] h-72 w-72 rounded-full bg-blue-500/10 blur-[120px]" />
            </div>
            <div className="relative z-10 max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">

                {/* Left Visual */}
                <div className="relative aspect-square md:aspect-[4/3] rounded-2xl overflow-hidden shadow-premium">
                    <img
                        src="/images/dna_team.jpg"
                        alt="L'équipe Nexus"
                        className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000"
                        loading="lazy"
                        decoding="async"
                    />
                    <div className="absolute inset-0 bg-blue-500/10 mix-blend-overlay" />
                </div>

                {/* Right Content */}
                <div>
                    <span className="font-mono text-xs uppercase tracking-[0.2em] text-blue-500 mb-6 block">
                        Notre ADN pédagogique
                    </span>
                    <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-8">
                        L’exigence au service <br />
                        <span className="text-gray-500">de la réussite.</span>
                    </h2>

                    <p className="text-gray-400 text-lg leading-relaxed mb-8">
                        Nous combinons l’expertise pédagogique, une IA utile et un suivi
                        transparent pour transformer le potentiel en résultats concrets.
                    </p>

                    <ul className="space-y-4">
                        {values.map((val, idx) => (
                            <li key={idx} className="dna-item flex items-center gap-4 text-white font-medium">
                                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-blue-400" />
                                </div>
                                {val}
                            </li>
                        ))}
                    </ul>
                </div>

            </div>
        </section>
    );
};

export default DNASectionGSAP;
