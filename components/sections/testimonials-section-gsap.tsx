"use client";

import React, { useRef, useLayoutEffect } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Star, Quote, ArrowRight, User } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const TestimonialsSectionGSAP = () => {
    const sectionRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const section = sectionRef.current;
        const scrollContainer = scrollContainerRef.current;

        if (!section || !scrollContainer) return;

        const ctx = gsap.context(() => {
            // Horizontal Scroll Animation
            const totalWidth = scrollContainer.scrollWidth;
            const viewportWidth = window.innerWidth;

            gsap.to(scrollContainer, {
                x: () => -(totalWidth - viewportWidth),
                ease: "none",
                scrollTrigger: {
                    trigger: section,
                    pin: true,
                    scrub: 1,
                    end: () => "+=" + totalWidth,
                    invalidateOnRefresh: true,
                }
            });

            // Background Parallax
            gsap.to('.bg-parallax', {
                yPercent: 20,
                ease: "none",
                scrollTrigger: {
                    trigger: section,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: true
                }
            });

        }, section);

        return () => ctx.revert();
    }, []);

    const testimonials = [
        {
            id: 1,
            name: "Jean-Pierre L.",
            role: "Directeur d'Établissement",
            content: "L'intégration des agents autonomes pour la vie scolaire a libéré 30% du temps de notre administration. Enfin une solution qui comprend le terrain.",
            tags: ["Transformation", "IA Agentique"],
            rating: 5,
            gradient: "from-blue-500/10 to-cyan-500/10",
            border: "border-blue-500/20"
        },
        {
            id: 2,
            name: "Sarah M.",
            role: "Élève Prépa HEC",
            content: "Grâce au coaching d'excellence et à l'accès 24/7 au tuteur ARIA, j'ai gagné 4 points en maths en un semestre. La méthode est d'une rigueur absolue.",
            tags: ["Performance", "Coaching"],
            rating: 5,
            gradient: "from-purple-500/10 to-pink-500/10",
            border: "border-purple-500/20"
        },
        {
            id: 3,
            name: "Amine K.",
            role: "Étudiant Ingénieur",
            content: "La certification de mes projets sur la Blockchain via Nexus a fait la différence lors de mes entretiens. C'est le futur du CV.",
            tags: ["Web3", "Carrière"],
            rating: 5,
            gradient: "from-emerald-500/10 to-green-500/10",
            border: "border-emerald-500/20"
        },
        {
            id: 4,
            name: "Mme Ben Ali",
            role: "Parent d'élève",
            content: "Le suivi est transparent et rassurant. On sent une véritable équipe d'experts derrière chaque décision pédagogique.",
            tags: ["Confiance", "Suivi"],
            rating: 5,
            gradient: "from-orange-500/10 to-yellow-500/10",
            border: "border-orange-500/20"
        },
        {
            id: 5,
            name: "Dr. Fakhfakh",
            role: "Professeur Universitaire",
            content: "Utiliser Korrigo pour l'harmonisation des corrections est une révolution. Plus d'équité, moins de charge mentale.",
            tags: ["Innovation", "Pedagogie"],
            rating: 5,
            gradient: "from-blue-500/10 to-indigo-500/10",
            border: "border-blue-500/20"
        },
    ];

    return (
        <section ref={sectionRef} id="testimonials" className="relative bg-surface-darker h-screen overflow-hidden flex flex-col justify-center">

            {/* Dynamic Background */}
            <div className="bg-parallax absolute inset-0 opacity-30 pointer-events-none">
                <div className="absolute top-[10%] left-[20%] w-[30vw] h-[30vw] rounded-full bg-blue-600/10 blur-[100px]" />
                <div className="absolute bottom-[10%] right-[20%] w-[30vw] h-[30vw] rounded-full bg-cyan-600/10 blur-[100px]" />
            </div>

            {/* Header */}
            <div className="absolute top-12 left-0 w-full px-6 md:px-12 z-10">
                <div className="max-w-7xl mx-auto flex items-end justify-between">
                    <div>
                        <span className="font-mono text-xs text-nexus-cyan uppercase tracking-widest mb-2 block">
                            Ils nous font confiance
                        </span>
                        <h2 className="font-display text-4xl md:text-5xl font-bold text-white">
                            L'Impact Nexus
                        </h2>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-gray-400 text-sm">
                        <span className="animate-pulse">●</span> Glisser pour découvrir
                    </div>
                </div>
            </div>

            {/* Horizontal Scroll Container */}
            <div ref={scrollContainerRef} className="flex items-center pl-[6vw] pr-[20vw] gap-8 w-fit">

                {/* Intro Card */}
                <div className="w-[30vw] md:w-[20vw] shrink-0">
                    <Quote className="w-16 h-16 text-nexus-gray/20 mb-6" />
                    <p className="text-xl text-gray-400 font-light leading-relaxed">
                        La réussite ne se déclare pas, elle se prouve par les résultats de ceux que nous accompagnons.
                    </p>
                </div>

                {/* Testimonial Cards */}
                {testimonials.map((item) => (
                    <div
                        key={item.id}
                        className={`w-[85vw] md:w-[35vw] shrink-0 p-8 rounded-3xl bg-gradient-to-br ${item.gradient} border ${item.border} backdrop-blur-md relative group hover:scale-[1.02] transition-transform duration-500`}
                    >
                        {/* Stars */}
                        <div className="flex gap-1 mb-6">
                            {[...Array(item.rating)].map((_, i) => (
                                <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            ))}
                        </div>

                        {/* Content */}
                        <p className="text-lg md:text-xl text-white leading-relaxed mb-8 italic">
                            "{item.content}"
                        </p>

                        {/* Footer */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                    <User className="w-5 h-5 text-gray-300" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-sm">{item.name}</h4>
                                    <span className="text-xs text-nexus-cyan font-mono">{item.role}</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {item.tags.map((tag, idx) => (
                                    <span key={idx} className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-white/5 text-gray-400 border border-white/5">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Call to Action Card */}
                <div className="w-[85vw] md:w-[25vw] shrink-0 h-full flex items-center justify-center">
                    <Link href="/bilan-gratuit" className="group relative px-8 py-20 rounded-3xl border border-white/10 hover:border-nexus-cyan/50 hover:bg-nexus-cyan/5 transition-all duration-500 w-full text-center block">
                        <span className="block font-display text-3xl font-bold text-white mb-4">
                            Rejoignez l'Excellence
                        </span>
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-nexus-cyan text-nexus-dark group-hover:scale-110 transition-transform">
                            <ArrowRight className="w-8 h-8" />
                        </div>
                    </Link>
                </div>

            </div>
        </section>
    );
};

export default TestimonialsSectionGSAP;
