"use client";

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FileCheck, BarChart3, Users, Zap, Shield, Clock } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const KorrigoSectionGSAP = () => {
    const sectionRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const section = sectionRef.current;
        const content = contentRef.current;

        if (!section || !content) return;

        const ctx = gsap.context(() => {
            const mm = gsap.matchMedia();

            mm.add("(prefers-reduced-motion: no-preference)", () => {
                // Entry animation
                const entryTl = gsap.timeline({ defaults: { ease: 'power2.out' } });

                entryTl
                    .fromTo('.korrigo-header',
                        { y: 40, opacity: 0 },
                        { y: 0, opacity: 1, duration: 0.8 }
                    )
                    .fromTo('.korrigo-feature',
                        { x: 60, opacity: 0 },
                        { x: 0, opacity: 1, duration: 0.6, stagger: 0.15 },
                        '-=0.4'
                    );

                // Pinned scroll animation
                const scrollTl = gsap.timeline({
                    scrollTrigger: {
                        trigger: section,
                        start: 'top top',
                        end: '+=100%',
                        pin: true,
                        scrub: 0.8,
                    }
                });

                // Exit animation
                scrollTl.to(content,
                    { opacity: 0, y: -50, ease: 'power2.in' },
                    0.7
                );
            });

            mm.add("(prefers-reduced-motion: reduce)", () => {
                gsap.set('.korrigo-header', { opacity: 1, y: 0 });
                gsap.set('.korrigo-feature', { opacity: 1, x: 0 });
                gsap.set(content, { opacity: 1, y: 0 });
            });

        }, section);

        return () => ctx.revert();
    }, []);

    const features = [
        {
            icon: FileCheck,
            title: 'Correction Assistée',
            description: 'IA qui aide à corriger plus vite sans perdre en qualité',
            color: 'bg-nexus-cyan/10'
        },
        {
            icon: BarChart3,
            title: 'Analytics Avancés',
            description: 'Tableaux de bord en temps réel pour piloter votre pédagogie',
            color: 'bg-purple-500/10'
        },
        {
            icon: Users,
            title: 'Gestion de Classe',
            description: 'Suivi individualisé de chaque élève et de sa progression',
            color: 'bg-amber-500/10'
        },
        {
            icon: Zap,
            title: 'Gain de Temps x10',
            description: 'Automatisez les tâches répétitives et concentrez-vous sur l\'essentiel',
            color: 'bg-emerald-500/10'
        },
        {
            icon: Shield,
            title: 'Souveraineté',
            description: 'Vos données restent chez vous, conformité RGPD garantie',
            color: 'bg-blue-500/10'
        },
        {
            icon: Clock,
            title: 'Disponible 24/7',
            description: 'Accès permanent pour vous et vos équipes',
            color: 'bg-pink-500/10'
        }
    ];

    return (
        <section
            ref={sectionRef}
            id="korrigo"
            className="section-pinned bg-nexus-dark flex items-center justify-center py-20 px-4 md:px-6 lg:px-12"
            style={{ zIndex: 50 }}
        >
            <div ref={contentRef} className="w-full max-w-7xl mx-auto">
                {/* Header */}
                <div className="korrigo-header text-center mb-12 md:mb-16">
                    <span className="label-mono text-nexus-cyan block mb-4">Plateforme phare</span>
                    <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-nexus-white mb-6">
                        Korrigo Engine
                    </h2>
                    <p className="text-nexus-gray text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                        La plateforme de correction et de pilotage pédagogique qui révolutionne le métier d'enseignant.
                    </p>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="korrigo-feature card-dark p-6 md:p-8 hover:border-nexus-cyan/40 transition-all duration-300"
                        >
                            <div className={`w-14 h-14 rounded-xl ${feature.color} flex items-center justify-center mb-6`}>
                                <feature.icon className="w-7 h-7 text-nexus-cyan" />
                            </div>
                            <h3 className="font-display font-semibold text-nexus-white text-xl mb-3">
                                {feature.title}
                            </h3>
                            <p className="text-nexus-gray text-sm md:text-base leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div className="mt-12 text-center">
                    <Link href="/contact?sujet=korrigo" className="btn-primary inline-block">
                        Découvrir Korrigo
                    </Link>
                </div>
            </div>
        </section>
    );
};

export default KorrigoSectionGSAP;
