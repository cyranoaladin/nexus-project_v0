"use client";

import React from 'react';
import Link from 'next/link';
import { Star, Quote, ArrowRight, User } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const TestimonialsSectionGSAP = () => {
    const sectionRef = useScrollReveal<HTMLElement>({ staggerDelay: 100 });

    const testimonials = [
        {
            id: 1,
            name: "Mme Ben Ammar",
            role: "Parent d'élève, Terminale",
            content: "Le plan était clair dès la première semaine. On voit les progrès et les points à travailler.",
            tags: ["Suivi", "Clarté"],
            rating: 5,
            gradient: "from-blue-500/10 to-cyan-500/10",
            border: "border-blue-500/20"
        },
        {
            id: 2,
            name: "Yasmine B.",
            role: "Élève, Première",
            content: "ARIA m’aide à réviser quand je bloque, et le coach vérifie tout en cours.",
            tags: ["IA", "Coaching"],
            rating: 5,
            gradient: "from-purple-500/10 to-pink-500/10",
            border: "border-purple-500/20"
        },
        {
            id: 3,
            name: "M. Hassen",
            role: "Parent d'élève",
            content: "Les rapports sont simples à lire. On sait où on va et pourquoi.",
            tags: ["Confiance", "Reporting"],
            rating: 5,
            gradient: "from-emerald-500/10 to-green-500/10",
            border: "border-emerald-500/20"
        },
        {
            id: 4,
            name: "Inès R.",
            role: "Élève, Terminale",
            content: "J’ai repris confiance en maths. Les exercices sont ciblés et je progresse vite.",
            tags: ["Confiance", "Résultats"],
            rating: 5,
            gradient: "from-orange-500/10 to-yellow-500/10",
            border: "border-orange-500/20"
        },
        {
            id: 5,
            name: "M. Ben Ali",
            role: "Parent d'élève",
            content: "Le suivi parent fait la différence. On ne découvre plus les problèmes trop tard.",
            tags: ["Prévention", "Suivi"],
            rating: 5,
            gradient: "from-blue-500/10 to-indigo-500/10",
            border: "border-blue-500/20"
        },
    ];

    return (
        <section
            ref={sectionRef}
            id="testimonials"
            className="relative bg-surface-darker overflow-hidden py-24"
        >

            {/* Dynamic Background */}
            <div className="absolute inset-0 opacity-30 pointer-events-none">
                <div className="absolute top-[10%] left-[20%] w-[30vw] h-[30vw] rounded-full bg-blue-600/10 blur-[100px]" />
                <div className="absolute bottom-[10%] right-[20%] w-[30vw] h-[30vw] rounded-full bg-cyan-600/10 blur-[100px]" />
            </div>

            {/* Header */}
            <div data-reveal="up" className="relative z-10 px-6 md:px-12 mb-12">
                <div className="max-w-7xl mx-auto flex items-end justify-between">
                    <div>
                        <span className="font-mono text-xs text-brand-accent uppercase tracking-widest mb-2 block">
                            Ils nous font confiance
                        </span>
                        <h2 className="font-display text-4xl md:text-5xl font-bold text-white">
                            Résultats concrets
                        </h2>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-gray-400 text-sm">
                        <span className="animate-pulse">●</span> Glisser pour découvrir
                    </div>
                </div>
            </div>

            {/* Horizontal Scroll Container — native CSS scroll */}
            <div
                className="relative z-10 flex items-stretch gap-8 px-6 md:pl-[6vw] md:pr-[6vw] overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4"
                style={{ scrollbarWidth: 'none' }}
            >

                {/* Intro Card */}
                <div data-reveal="fade" className="shrink-0 w-[70vw] md:w-[20vw] snap-center flex flex-col justify-center">
                    <Quote className="w-16 h-16 text-nexus-gray/20 mb-6" />
                    <p className="text-xl text-gray-400 font-light leading-relaxed">
                        Des parents rassurés, des élèves confiants, et des résultats visibles.
                    </p>
                </div>

                {/* Testimonial Cards */}
                {testimonials.map((item) => (
                    <div
                        key={item.id}
                        data-reveal="scale"
                        className={`shrink-0 w-[80vw] md:w-[35vw] snap-center p-8 rounded-3xl bg-gradient-to-br ${item.gradient} border ${item.border} backdrop-blur-md relative group hover:scale-[1.02] transition-transform duration-500 hover:shadow-premium`}
                    >
                        {/* Stars */}
                        <div className="flex gap-1 mb-6">
                            {[...Array(item.rating)].map((_, i) => (
                                <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            ))}
                        </div>

                        {/* Content */}
                        <p className="text-lg md:text-xl text-white leading-relaxed mb-8 italic">
                            &ldquo;{item.content}&rdquo;
                        </p>

                        {/* Footer */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                    <User className="w-5 h-5 text-gray-300" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-sm">{item.name}</h4>
                                    <span className="text-xs text-brand-accent font-mono">{item.role}</span>
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
                <div className="shrink-0 w-[80vw] md:w-[25vw] snap-center flex items-center justify-center">
                    <Link href="/bilan-gratuit" className="group relative px-8 py-20 rounded-3xl border border-white/10 hover:border-brand-accent/50 hover:bg-brand-accent/5 transition-all duration-500 w-full text-center block">
                        <span className="block font-display text-3xl font-bold text-white mb-4">
                            Démarrer un bilan gratuit
                        </span>
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-accent text-surface-dark group-hover:scale-110 transition-transform">
                            <ArrowRight className="w-8 h-8" />
                        </div>
                    </Link>
                </div>

            </div>
        </section>
    );
};

export default TestimonialsSectionGSAP;
