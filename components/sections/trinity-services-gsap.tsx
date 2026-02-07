"use client";

import React, { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Brain, Network, Users, CheckCircle2 } from 'lucide-react';

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
            id: "ia",
            icon: Brain,
            title: "Ingénierie IA & RAG",
            description: "Déploiement d'agents autonomes et de systèmes RAG pour une connaissance instantanée et précise.",
            features: ["Chatbots Éducatifs", "Analyse de Données", "Automatisation"],
            color: "text-blue-400",
            bg: "bg-blue-400/10",
            border: "border-blue-400/20"
        },
        {
            id: "web3",
            icon: Network,
            title: "Certification Web3",
            description: "Ancrage des diplômes et compétences sur la Blockchain pour une vérifiabilité totale et incalsifiable.",
            features: ["NFTs de Compétence", "Smart Contracts", "Identité Numérique"],
            color: "text-purple-400",
            bg: "bg-purple-400/10",
            border: "border-purple-400/20"
        },
        {
            id: "human",
            icon: Users,
            title: "Excellence Humaine",
            description: "Le toucher irremplaçable de nos Professeurs Agrégés et Experts pour guider, motiver et inspirer.",
            features: ["Mentorat Elite", "Coaching Mental", "Orientation Stratégique"],
            color: "text-emerald-400",
            bg: "bg-emerald-400/10",
            border: "border-emerald-400/20"
        }
    ];

    return (
        <section ref={sectionRef} id="trinity" className="relative h-[150vh] bg-surface-darker py-24 overflow-hidden">

            {/* Background Gradients */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.05),transparent_50%)]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 h-full flex flex-col justify-center">

                {/* Section Header */}
                <div className="text-center mb-16">
                    <span className="font-mono text-xs uppercase tracking-[0.2em] text-brand-accent mb-4 block">
                        La Trinité Nexus
                    </span>
                    <h2 className="font-display text-4xl md:text-5xl font-bold text-white max-w-3xl mx-auto leading-tight">
                        Une synergie unique entre <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400">
                            Technologie et Pédagogie
                        </span>
                    </h2>
                </div>

                {/* Cards Container */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {services.map((service) => (
                        <div
                            key={service.id}
                            className={`trinity-card relative p-8 rounded-3xl bg-white/[0.02] border ${service.border} backdrop-blur-sm group hover:bg-white/[0.04] transition-colors duration-500`}
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
                        COMBINÉS POUR VOTRE RÉUSSITE
                    </p>
                    <div className="h-px w-24 bg-gradient-to-r from-transparent via-neutral-700 to-transparent mx-auto" />
                </div>

            </div>
        </section>
    );
};

export default TrinityServicesGSAP;
