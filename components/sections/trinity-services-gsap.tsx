"use client";

import React, { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Brain, LayoutDashboard, Users, CheckCircle2 } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const TrinityServicesGSAP = () => {
    const sectionRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const section = sectionRef.current;
        if (!section) return;

        const ctx = gsap.context(() => {
            const mm = gsap.matchMedia();

            mm.add("(prefers-reduced-motion: no-preference)", () => {
                // Pinning Effect for Title
                ScrollTrigger.create({
                    trigger: section,
                    start: "top top",
                    end: "+=100%",
                    pin: true,
                    pinSpacing: true,
                });

                // Cards Animation
                gsap.fromTo('.trinity-card',
                    { y: 100, opacity: 0, scale: 0.9 },
                    {
                        scrollTrigger: {
                            trigger: section,
                            start: "top center",
                            end: "bottom bottom",
                            scrub: 1,
                        },
                        y: 0,
                        opacity: 1,
                        scale: 1,
                        stagger: 0.3,
                        ease: "power2.out"
                    }
                );
            });

            mm.add("(prefers-reduced-motion: reduce)", () => {
                // No pinning, just visible content
                gsap.set('.trinity-card', { opacity: 1, y: 0, scale: 1 });
            });

        }, section);

        return () => ctx.revert();
    }, []);

    const services = [
        {
            id: "coachs",
            icon: Users,
            title: "Coachs agrégés",
            description: "Des professeurs experts pour structurer, corriger et faire progresser.",
            features: ["Cours particuliers ciblés", "Méthodologie Bac", "Feedback actionnable"],
            color: "text-emerald-400",
            bg: "bg-emerald-400/10",
            border: "border-emerald-400/20"
        },
        {
            id: "ia",
            icon: Brain,
            title: "IA ARIA 24/7",
            description: "Un tuteur IA pour pratiquer, réviser et comprendre à tout moment.",
            features: ["Explications instantanées", "Exercices guidés", "Révisions intelligentes"],
            color: "text-blue-400",
            bg: "bg-blue-400/10",
            border: "border-blue-400/20"
        },
        {
            id: "suivi",
            icon: LayoutDashboard,
            title: "Suivi parent",
            description: "Un tableau de bord clair pour piloter la progression et les résultats.",
            features: ["Rapports réguliers", "Objectifs visibles", "Alertes de progression"],
            color: "text-purple-400",
            bg: "bg-purple-400/10",
            border: "border-purple-400/20"
        }
    ];

    return (
        <section ref={sectionRef} id="trinity" className="relative h-[150vh] bg-surface-darker py-24 overflow-hidden">

            {/* Background Gradients */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(47,107,255,0.08),transparent_55%)]" />
                <div className="absolute -top-10 right-[-10%] h-72 w-72 rounded-full bg-brand-accent/10 blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 h-full flex flex-col justify-center">

                {/* Section Header */}
                <div className="text-center mb-16">
                    <span className="font-mono text-xs uppercase tracking-[0.2em] text-brand-accent mb-4 block">
                        L’essentiel pour réussir
                    </span>
                    <h2 className="font-display text-4xl md:text-5xl font-bold text-white max-w-3xl mx-auto leading-tight">
                        3 leviers, un seul objectif : <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400">
                            la mention au Bac
                        </span>
                    </h2>
                </div>

                {/* Cards Container */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {services.map((service) => (
                        <div
                            key={service.id}
                            className={`trinity-card relative p-8 rounded-3xl bg-white/[0.03] border ${service.border} backdrop-blur-sm group hover:bg-white/[0.06] transition-colors duration-500 hover:shadow-premium`}
                        >
                            {/* Icon */}
                            <div className={`w-14 h-14 rounded-2xl ${service.bg} flex items-center justify-center mb-6`}>
                                <service.icon className={`w-7 h-7 ${service.color}`} />
                            </div>

                            {/* Content */}
                            <h3 className="font-display text-2xl font-bold text-white mb-4">
                                {service.title}
                            </h3>
                            <p className="text-neutral-400 leading-relaxed mb-8 h-20">
                                {service.description}
                            </p>

                            {/* Features List */}
                            <ul className="space-y-3">
                                {service.features.map((item, idx) => (
                                    <li key={idx} className="flex items-center gap-3 text-sm text-neutral-300">
                                        <CheckCircle2 className={`w-4 h-4 ${service.color}`} aria-hidden="true" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom Connect */}
                <div className="mt-16 text-center">
                    <p className="text-neutral-500 text-sm font-mono mb-4">
                        UN PARCOURS CLAIR ET MESURABLE
                    </p>
                    <div className="h-px w-24 bg-gradient-to-r from-transparent via-neutral-700 to-transparent mx-auto" />
                </div>

            </div>
        </section>
    );
};

export default TrinityServicesGSAP;
