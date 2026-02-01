"use client";

import React, { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Brain, Target, Shield, ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const ApproachSectionGSAP = () => {
    const sectionRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const section = sectionRef.current;
        if (!section) return;

        const ctx = gsap.context(() => {

            const mm = gsap.matchMedia();

            mm.add("(prefers-reduced-motion: no-preference)", () => {
                // Cards Animation
                gsap.fromTo('.approach-card',
                    { y: 50, opacity: 0 },
                    {
                        scrollTrigger: {
                            trigger: section,
                            start: 'top 75%',
                        },
                        y: 0,
                        opacity: 1,
                        stagger: 0.2,
                        duration: 0.8,
                        ease: 'power3.out'
                    }
                );
            });

            mm.add("(prefers-reduced-motion: reduce)", () => {
                gsap.set('.approach-card', { opacity: 1, y: 0 });
            });

        }, section);

        return () => ctx.revert();
    }, []);

    const approaches = [
        {
            icon: Brain,
            title: "Diagnostiquer",
            description: "Nous ne devinons jamais. Tout commence par un audit précis de vos besoins (élève ou établissement) via nos outils IA.",
            color: "text-blue-400",
            gradient: "from-blue-500/10 to-transparent"
        },
        {
            icon: Target,
            title: "Cibler",
            description: "Création d'un parcours sur-mesure. Allocation des ressources (tuteurs, modules IA, contenus) pour un impact maximal.",
            color: "text-purple-400",
            gradient: "from-purple-500/10 to-transparent"
        },
        {
            icon: Shield,
            title: "Sécuriser",
            description: "Les résultats sont verrouillés par un suivi constant. Ajustement en temps réel grâce aux analytics de performance.",
            color: "text-emerald-400",
            gradient: "from-emerald-500/10 to-transparent"
        }
    ];

    return (
        <section ref={sectionRef} id="approach" className="relative py-32 bg-[#0a0b0f] overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">

                {/* Header */}
                <div className="text-center mb-20">
                    <span className="font-mono text-xs uppercase tracking-[0.2em] text-gray-500 mb-4 block">
                        Notre Méthodologie
                    </span>
                    <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
                        La précision avant <br />
                        <span className="text-gray-600">l'action</span>.
                    </h2>
                </div>

                {/* Steps */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {approaches.map((item, idx) => (
                        <div
                            key={idx}
                            className={`approach-card relative p-8 rounded-3xl bg-gradient-to-b ${item.gradient} border border-white/5 group hover:border-white/10 transition-colors duration-500`}
                        >
                            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 text-white border border-white/10">
                                <item.icon className={`w-6 h-6 ${item.color}`} />
                            </div>

                            <h3 className="font-display text-2xl font-bold text-white mb-4">
                                {item.title}
                            </h3>

                            <p className="text-gray-400 leading-relaxed mb-6">
                                {item.description}
                            </p>

                            <div className="flex items-center gap-2 text-sm font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-[-10px] group-hover:translate-x-0">
                                <span>En savoir plus</span>
                                <ArrowRight className="w-4 h-4" />
                            </div>

                            {/* Number background */}
                            <div className="absolute top-4 right-6 font-display text-8xl font-bold text-white/[0.02] select-none">
                                0{idx + 1}
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    );
};

export default ApproachSectionGSAP;
