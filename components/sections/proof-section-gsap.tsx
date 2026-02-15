"use client";

import { TrendingUp, Users, Award, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useScrollReveal, useCountUp } from '@/hooks/useScrollReveal';

/**
 * Individual stat card with count-up animation.
 */
function StatCard({ stat, index }: { stat: { icon: React.ElementType; value: number; suffix: string; label: string; color: string }; index: number }) {
    const countRef = useCountUp(stat.value, stat.suffix);

    return (
        <div
            data-reveal="scale"
            className="bg-surface-card border border-white/[0.08] rounded-[18px] shadow-[0_24px_70px_rgba(0,0,0,0.45)] p-8 text-center hover:border-brand-accent/40 transition-all duration-300"
        >
            <div className={`w-16 h-16 rounded-xl ${stat.color} flex items-center justify-center mx-auto mb-6`}>
                <stat.icon className="w-8 h-8 text-brand-accent" />
            </div>
            <div className="font-display text-5xl font-bold text-white mb-3">
                <span ref={countRef}>0{stat.suffix}</span>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed">
                {stat.label}
            </p>
        </div>
    );
}

const ProofSectionGSAP = () => {
    const sectionRef = useScrollReveal<HTMLElement>({ staggerDelay: 120 });

    const stats = [
        {
            icon: TrendingUp,
            value: 42,
            suffix: '%',
            label: 'Augmentation moyenne des résultats',
            color: 'bg-brand-accent/10'
        },
        {
            icon: Users,
            value: 500,
            suffix: '+',
            label: 'Élèves accompagnés',
            color: 'bg-purple-500/10'
        },
        {
            icon: Award,
            value: 95,
            suffix: '%',
            label: 'Taux de satisfaction',
            color: 'bg-amber-500/10'
        },
        {
            icon: Target,
            value: 89,
            suffix: '%',
            label: 'Objectifs atteints',
            color: 'bg-emerald-500/10'
        }
    ];

    return (
        <section
            ref={sectionRef}
            id="proof"
            className="bg-surface-dark py-20 md:py-32 px-4 md:px-6 lg:px-12"
        >
            <div className="w-full max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <span className="label-mono text-brand-accent block mb-4">Résultats mesurables</span>
                    <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
                        L'Impact en Chiffres
                    </h2>
                    <p className="text-neutral-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                        Des résultats concrets et mesurables pour nos partenaires et élèves.
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, index) => (
                        <StatCard key={index} stat={stat} index={index} />
                    ))}
                </div>

                {/* Bottom CTA */}
                <div className="mt-12 bg-surface-card border border-white/[0.08] rounded-[18px] shadow-[0_24px_70px_rgba(0,0,0,0.45)] p-8 md:p-12 text-center transition-all duration-300">
                    <h3 className="font-display text-2xl md:text-3xl font-bold text-white mb-4">
                        Prêt à transformer votre établissement ?
                    </h3>
                    <p className="text-neutral-400 text-base md:text-lg mb-6 max-w-2xl mx-auto">
                        Rejoignez les établissements qui ont choisi l'excellence avec Nexus Réussite.
                    </p>
                    <Button>
                        Demander une démo
                    </Button>
                </div>
            </div>
        </section>
    );
};

export default ProofSectionGSAP;
