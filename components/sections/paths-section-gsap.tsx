"use client";

import React, { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { User, GraduationCap, Briefcase, ArrowRight, School } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const PathsSectionGSAP = () => {
    const sectionRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const section = sectionRef.current;
        if (!section) return;

        const ctx = gsap.context(() => {
            const mm = gsap.matchMedia();

            mm.add("(prefers-reduced-motion: no-preference)", () => {
                // Cards Stagger Animation
                gsap.fromTo('.path-card',
                    { y: 100, opacity: 0 },
                    {
                        scrollTrigger: {
                            trigger: section,
                            start: 'top 80%',
                            end: 'center center',
                            toggleActions: 'play none none reverse'
                        },
                        y: 0,
                        opacity: 1,
                        duration: 0.8,
                        stagger: 0.2,
                        ease: 'power3.out'
                    }
                );

                // Title Animation
                gsap.fromTo('.section-title',
                    { y: 50, opacity: 0 },
                    {
                        scrollTrigger: {
                            trigger: section,
                            start: 'top 90%',
                        },
                        y: 0,
                        opacity: 1,
                        duration: 1,
                        ease: 'power3.out'
                    }
                );
            });

            mm.add("(prefers-reduced-motion: reduce)", () => {
                gsap.set('.path-card', { opacity: 1, y: 0 });
                gsap.set('.section-title', { opacity: 1, y: 0 });
            });

        }, section);

        return () => ctx.revert();
    }, []);

    const paths = [
        {
            id: 'eleve',
            icon: School,
            title: "Élève (Lycée/Prépas)",
            subtitle: "L'Excellence comme Standard",
            description: "Un accompagnement sur-mesure pour viser les meilleures filières. Méthodologie, rigueur et dépassement de soi.",
            features: ["Cours particuliers Expert", "Stages intensifs (Vacances)", "Préparation Bac & Concours"],
            gradient: "from-blue-500/20 to-cyan-500/20",
            border: "hover:border-blue-400/50",
            cta: "Booster mes notes"
        },
        {
            id: 'etudiant',
            icon: GraduationCap,
            title: "Étudiant Supérieur",
            subtitle: "Validez, Majorz, Performer",
            description: "Soutien universitaire de haut niveau pour les licences, masters et écoles d'ingénieurs. Ne laissez aucune lacune s'installer.",
            features: ["Aide aux projets & PFE", "Renforcement modules clés", "Préparation examens semestriels"],
            gradient: "from-purple-500/20 to-pink-500/20",
            border: "hover:border-purple-400/50",
            cta: "Réussir mon année"
        },
        {
            id: 'pro',
            icon: Briefcase,
            title: "Professionnel",
            subtitle: "L'IA comme Levier de Carrière",
            description: "Formations certifiantes en Intelligence Artificielle et mise à niveau technique pour rester compétitif sur le marché.",
            features: ["Formation IA Generative", "Upskilling Technique", "Coaching Carrière Tech"],
            gradient: "from-emerald-500/20 to-green-500/20",
            border: "hover:border-emerald-400/50",
            cta: "Évoluer maintenant"
        }
    ];

    const scrollToSection = (id: string) => {
        const element = document.querySelector(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <section ref={sectionRef} id="paths" className="py-24 bg-neutral-950 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[20%] right-[10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6">
                {/* Header */}
                <div className="text-center mb-24 section-title">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
                        <User className="w-4 h-4 text-blue-400" />
                        <span className="font-mono text-xs uppercase tracking-wider text-gray-400">Pour chaque ambition</span>
                    </div>
                    <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
                        Choisissez votre <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Voie d'Excellence</span>
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                        Que vous soyez au lycée, à l'université ou en poste, Nexus a conçu un parcours d'élite adapté à vos enjeux spécifiques.
                    </p>
                </div>

                {/* Paths Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {paths.map((path) => (
                        <div
                            key={path.id}
                            className={`path-card group relative p-1 rounded-3xl bg-gradient-to-br ${path.gradient} hover:scale-[1.02] transition-transform duration-500`}
                        >
                            <div className={`relative h-full bg-surface-card rounded-[22px] p-8 border border-white/5 ${path.border} transition-colors duration-500 overflow-hidden`}>

                                {/* Hover Glow */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                {/* Icon */}
                                <div className="relative w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 group-hover:bg-white/10 transition-colors">
                                    <path.icon className="w-7 h-7 text-white" />
                                </div>

                                {/* Content */}
                                <h3 className="relative font-display text-2xl font-bold text-white mb-2">
                                    {path.title}
                                </h3>
                                <p className={`relative font-mono text-xs uppercase tracking-wider mb-6 ${path.id === 'eleve' ? 'text-blue-400' :
                                    path.id === 'etudiant' ? 'text-purple-400' : 'text-emerald-400'
                                    }`}>
                                    {path.subtitle}
                                </p>

                                <p className="relative text-gray-400 text-sm leading-relaxed mb-8">
                                    {path.description}
                                </p>

                                {/* Features */}
                                <ul className="relative space-y-3 mb-8">
                                    {path.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-center gap-3 text-sm text-gray-300">
                                            <div className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-white/50 transition-colors" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA */}
                                <button
                                    onClick={() => scrollToSection('#contact')}
                                    className="relative w-full py-4 rounded-xl font-semibold text-sm
                           bg-white/5 border border-white/10 text-white
                           hover:bg-white/10 transition-all duration-300 flex items-center justify-center gap-2"
                                >
                                    <span>{path.cta}</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>

                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default PathsSectionGSAP;
