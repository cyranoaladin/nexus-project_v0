"use client";

import React from 'react';
import { Brain, Target, Shield, ArrowRight } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const ApproachSectionGSAP = () => {
    const sectionRef = useScrollReveal<HTMLElement>({ staggerDelay: 150 });

    const approaches = [
        {
            icon: Brain,
            title: "Bilan stratégique",
            description: "On évalue le niveau, les lacunes et l’objectif précis.",
            color: "text-blue-400",
            gradient: "from-blue-500/10 to-transparent"
        },
        {
            icon: Target,
            title: "Plan sur‑mesure",
            description: "Coachs + IA ARIA + rythme adapté pour avancer vite.",
            color: "text-purple-400",
            gradient: "from-purple-500/10 to-transparent"
        },
        {
            icon: Shield,
            title: "Résultats suivis",
            description: "Progression visible, ajustements en continu, parent informé.",
            color: "text-emerald-400",
            gradient: "from-emerald-500/10 to-transparent"
        }
    ];

    return (
        <section ref={sectionRef} id="approach" className="relative py-28 bg-neutral-950 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-40">
                <div className="absolute top-[-5%] left-[-5%] h-72 w-72 rounded-full bg-brand-accent/10 blur-[120px]" />
                <div className="absolute bottom-[-5%] right-[-5%] h-72 w-72 rounded-full bg-blue-500/10 blur-[120px]" />
            </div>
            <div className="relative z-10 max-w-7xl mx-auto px-6">

                {/* Header */}
                <div className="text-center mb-20">
                    <span className="font-mono text-xs uppercase tracking-[0.2em] text-gray-400 mb-4 block">
                        Un parcours simple
                    </span>
                    <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
                        3 étapes claires, <br />
                        <span className="text-gray-300">des résultats visibles</span>.
                    </h2>
                </div>

                {/* Steps */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {approaches.map((item, idx) => (
                        <div
                            key={idx}
                            data-reveal="up"
                            className={`relative p-8 rounded-3xl bg-gradient-to-b ${item.gradient} border border-white/5 group hover:border-white/10 transition-colors duration-500 hover:shadow-premium`}
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
