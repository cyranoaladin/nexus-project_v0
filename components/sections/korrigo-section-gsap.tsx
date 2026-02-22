"use client";

import Link from 'next/link';
import { FileCheck, BarChart3, Users, Zap, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const KorrigoSectionGSAP = () => {
    const sectionRef = useScrollReveal<HTMLElement>({ staggerDelay: 100 });

    const features = [
        {
            icon: FileCheck,
            title: 'Corrections rapides',
            description: 'Des retours clairs pour comprendre et progresser vite.',
            color: 'bg-brand-accent/10'
        },
        {
            icon: BarChart3,
            title: 'Suivi de progression',
            description: 'Graphiques simples pour visualiser les progrès.',
            color: 'bg-brand-secondary/10'
        },
        {
            icon: Users,
            title: 'Suivi parent',
            description: 'Un tableau de bord lisible pour piloter sans stress.',
            color: 'bg-slate-500/10'
        },
        {
            icon: Zap,
            title: 'Plan d’action',
            description: 'Objectifs clairs et actions concrètes semaine après semaine.',
            color: 'bg-blue-400/10'
        },
        {
            icon: Shield,
            title: 'Données protégées',
            description: 'Sécurité et confidentialité des informations.',
            color: 'bg-blue-500/10'
        },
        {
            icon: Clock,
            title: 'Disponible 24/7',
            description: 'Accès permanent pour réviser quand il faut.',
            color: 'bg-slate-400/10'
        }
    ];

    return (
        <section
            ref={sectionRef}
            id="korrigo"
            className="bg-surface-dark py-16 md:py-20 px-4 md:px-6 lg:px-12 relative overflow-hidden"
        >
            <div className="pointer-events-none absolute inset-0 opacity-40">
                <div className="absolute top-0 left-0 h-72 w-72 rounded-full bg-brand-accent/10 blur-[120px]" />
                <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-blue-500/10 blur-[120px]" />
            </div>
            <div className="relative z-10 w-full max-w-7xl mx-auto">
                {/* Header */}
                <div data-reveal="up" className="text-center mb-12 md:mb-16">
                    <span className="label-mono text-brand-accent block mb-4">Suivi intelligent</span>
                    <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
                        Suivi & corrections Korrigo
                    </h2>
                    <p className="text-neutral-300/90 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                        Une plateforme claire pour suivre la progression, corriger vite et garder le cap vers la mention.
                    </p>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            data-reveal="right"
                            className="bg-surface-card border border-white/[0.08] rounded-[18px] shadow-card p-6 md:p-8 hover:border-brand-accent/40 hover:shadow-premium-strong transition-all duration-300"
                        >
                            <div className={`w-14 h-14 rounded-xl ${feature.color} flex items-center justify-center mb-6`}>
                                <feature.icon className="w-7 h-7 text-brand-accent" />
                            </div>
                            <h3 className="font-display font-semibold text-white text-xl mb-3">
                                {feature.title}
                            </h3>
                            <p className="text-neutral-300/90 text-sm md:text-base leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div className="mt-12 text-center">
                    <Button asChild className="inline-block">
                        <Link href="/bilan-gratuit">
                            Démarrer un bilan gratuit
                        </Link>
                    </Button>
                </div>
            </div>
        </section>
    );
};

export default KorrigoSectionGSAP;
