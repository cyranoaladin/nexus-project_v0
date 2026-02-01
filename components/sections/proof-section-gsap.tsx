"use client";

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TrendingUp, Users, Award, Target } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const ProofSectionGSAP = () => {
    const sectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const section = sectionRef.current;
        if (!section) return;

        const ctx = gsap.context(() => {
            // Animated counter effect
            gsap.fromTo('.proof-stat',
                { scale: 0.8, opacity: 0 },
                {
                    scale: 1,
                    opacity: 1,
                    duration: 0.8,
                    stagger: 0.15,
                    scrollTrigger: {
                        trigger: section,
                        start: 'top 70%',
                        toggleActions: 'play none none reverse',
                    }
                }
            );

            // Number count-up animation
            document.querySelectorAll('.count-up').forEach((el) => {
                const target = parseInt(el.getAttribute('data-target') || '0');
                const suffix = el.getAttribute('data-suffix') || '';

                ScrollTrigger.create({
                    trigger: el,
                    start: 'top 80%',
                    onEnter: () => {
                        gsap.to(el, {
                            innerHTML: target,
                            duration: 2,
                            snap: { innerHTML: 1 },
                            onUpdate: function () {
                                el.innerHTML = Math.ceil(parseFloat(el.innerHTML as string)) + suffix;
                            }
                        });
                    }
                });
            });
        }, section);

        return () => ctx.revert();
    }, []);

    const stats = [
        {
            icon: TrendingUp,
            value: 42,
            suffix: '%',
            label: 'Augmentation moyenne des résultats',
            color: 'bg-nexus-cyan/10'
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
            className="bg-nexus-dark py-20 md:py-32 px-4 md:px-6 lg:px-12"
        >
            <div className="w-full max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <span className="label-mono text-nexus-cyan block mb-4">Résultats mesurables</span>
                    <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-nexus-white mb-6">
                        L'Impact en Chiffres
                    </h2>
                    <p className="text-nexus-gray text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                        Des résultats concrets et mesurables pour nos partenaires et élèves.
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, index) => (
                        <div
                            key={index}
                            className="proof-stat card-dark p-8 text-center hover:border-nexus-cyan/40 transition-all duration-300"
                        >
                            <div className={`w-16 h-16 rounded-xl ${stat.color} flex items-center justify-center mx-auto mb-6`}>
                                <stat.icon className="w-8 h-8 text-nexus-cyan" />
                            </div>
                            <div className="font-display text-5xl font-bold text-nexus-white mb-3">
                                <span className="count-up" data-target={stat.value} data-suffix={stat.suffix}>0{stat.suffix}</span>
                            </div>
                            <p className="text-nexus-gray text-sm leading-relaxed">
                                {stat.label}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Bottom CTA */}
                <div className="mt-12 card-dark p-8 md:p-12 text-center">
                    <h3 className="font-display text-2xl md:text-3xl font-bold text-nexus-white mb-4">
                        Prêt à transformer votre établissement ?
                    </h3>
                    <p className="text-nexus-gray text-base md:text-lg mb-6 max-w-2xl mx-auto">
                        Rejoignez les établissements qui ont choisi l'excellence avec Nexus Réussite.
                    </p>
                    <button className="btn-primary">
                        Demander une démo
                    </button>
                </div>
            </div>
        </section>
    );
};

export default ProofSectionGSAP;
