"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { School, Users, GraduationCap, FileCheck, Bot, Shield, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

gsap.registerPlugin(ScrollTrigger);

const OfferSection = () => {
    const sectionRef = useRef<HTMLDivElement>(null);
    const photoCardRef = useRef<HTMLDivElement>(null);
    const offerCardRef = useRef<HTMLDivElement>(null);
    const bottomCardsRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState(0);

    useEffect(() => {
        const section = sectionRef.current;
        const photoCard = photoCardRef.current;
        const offerCard = offerCardRef.current;
        const bottomCards = bottomCardsRef.current;

        if (!section || !photoCard || !offerCard || !bottomCards) return;

        const ctx = gsap.context(() => {
            const mm = gsap.matchMedia();

            mm.add("(prefers-reduced-motion: no-preference)", () => {
                const scrollTl = gsap.timeline({
                    scrollTrigger: {
                        trigger: section,
                        start: 'top top',
                        end: '+=140%',
                        pin: true,
                        scrub: 0.7,
                    }
                });

                // ENTRANCE (0-30%)
                scrollTl
                    .fromTo(photoCard,
                        { x: '-60vw', opacity: 0, scale: 0.98 },
                        { x: 0, opacity: 1, scale: 1, ease: 'none' },
                        0
                    )
                    .fromTo(offerCard,
                        { x: '60vw', opacity: 0 },
                        { x: 0, opacity: 1, ease: 'none' },
                        0.05
                    )
                    .fromTo(bottomCards.querySelectorAll('.micro-card'),
                        { y: '12vh', opacity: 0 },
                        { y: 0, opacity: 1, stagger: 0.03, ease: 'none' },
                        0.1
                    );

                // EXIT (70-100%)
                scrollTl
                    .fromTo(photoCard,
                        { x: 0, opacity: 1 },
                        { x: '-18vw', opacity: 0, ease: 'power2.in' },
                        0.7
                    )
                    .fromTo(offerCard,
                        { x: 0, opacity: 1 },
                        { x: '18vw', opacity: 0, ease: 'power2.in' },
                        0.7
                    )
                    .fromTo(bottomCards.querySelectorAll('.micro-card'),
                        { y: 0, opacity: 1 },
                        { y: '10vh', opacity: 0, stagger: 0.02, ease: 'power2.in' },
                        0.7
                    );
            });

            mm.add("(prefers-reduced-motion: reduce)", () => {
                gsap.timeline({
                    scrollTrigger: {
                        trigger: section,
                        start: 'top top',
                        end: '+=140%',
                        pin: true,
                    }
                });

                // Set final state for visibility
                gsap.set(photoCard, { x: 0, opacity: 1, scale: 1 });
                gsap.set(offerCard, { x: 0, opacity: 1 });
                gsap.set(bottomCards.querySelectorAll('.micro-card'), { y: 0, opacity: 1 });
            });

        }, section);

        return () => ctx.revert();
    }, []);

    const tabs = [
        { icon: School, label: 'Plateforme' },
        { icon: Users, label: 'Hybride' },
        { icon: GraduationCap, label: 'Immersion' }
    ];

    const tabContent = [
        {
            title: "Accès Plateforme",
            subtitle: "IA + Suivi",
            items: [
                { icon: Bot, text: "IA ARIA 24/7 (1 matière)" },
                { icon: FileCheck, text: "Suivi de progression" },
                { icon: Shield, text: "Dashboard parent" },
                { icon: GraduationCap, text: "Ressources & méthodes Bac" }
            ],
            cta: "Voir les formules"
        },
        {
            title: "Hybride",
            subtitle: "Plateforme + Coach",
            items: [
                { icon: Check, text: "4h/mois avec coach agrégé et certifié" },
                { icon: Bot, text: "IA ARIA 24/7" },
                { icon: Shield, text: "Suivi parental" },
                { icon: GraduationCap, text: "Plan de révision personnalisé" }
            ],
            cta: "Voir les formules"
        },
        {
            title: "Immersion",
            subtitle: "Intensif & Prioritaire",
            items: [
                { icon: Check, text: "8h/mois avec experts agrégés et certifiés" },
                { icon: Bot, text: "IA ARIA 24/7" },
                { icon: Shield, text: "Support prioritaire" },
                { icon: GraduationCap, text: "Bilan trimestriel" }
            ],
            cta: "Voir les formules"
        }
    ];

    return (
        <section
            ref={sectionRef}
            id="offer"
            className="section-pinned bg-neutral-950 flex items-center justify-center cursor-default min-h-screen relative overflow-hidden"
            style={{ zIndex: 50 }}
        >
            <div className="relative w-full h-full flex items-center px-[6vw]">

                {/* Left Photo Card */}
                <div
                    ref={photoCardRef}
                    className="absolute left-[6vw] top-[14vh] w-[44vw] h-[72vh] bg-surface-card overflow-hidden rounded-[18px] border border-white/[0.08] shadow-[0_24px_70px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-0.5"
                >
                    <img
                        src="/images/classroom.jpg"
                        alt="Salle de classe"
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-surface-card/60 via-transparent to-surface-card/80" />

                    {/* Overlay Content */}
                    <div className="absolute bottom-6 left-6 right-6">
                        <span className="label-mono text-brand-accent block mb-1">Nexus Réussite</span>
                        <h3 className="font-display text-2xl font-bold text-white mt-2">
                            Un plan clair, des résultats
                        </h3>
                        <p className="text-neutral-400 text-sm mt-1">
                            Conçu pour sécuriser le Bac et viser la mention.
                        </p>
                    </div>
                </div>

                {/* Right Offer Card */}
                <div
                    ref={offerCardRef}
                    className="absolute left-[52vw] top-[14vh] w-[42vw] h-[72vh] rounded-[18px] border border-white/10 bg-neutral-950/80 backdrop-blur-xl p-6 flex flex-col"
                >
                    {/* Tabs */}
                    <div className="flex border-b border-white/10">
                        {tabs.map((tab, index) => (
                            <button
                                key={index}
                                onClick={() => setActiveTab(index)}
                                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium
                          transition-all duration-300 relative ${activeTab === index
                                        ? 'text-brand-accent'
                                        : 'text-neutral-400 hover:text-white'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                <span className="hidden sm:inline">{tab.label}</span>
                                {activeTab === index && (
                                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-accent" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 flex flex-col justify-center py-6">
                        <span className="label-mono text-brand-accent block mb-2">{tabContent[activeTab].subtitle}</span>
                        <h3 className="font-display text-2xl font-bold text-white mt-2">
                            {tabContent[activeTab].title}
                        </h3>

                        <ul className="mt-6 space-y-4">
                            {tabContent[activeTab].items.map((item, idx) => (
                                <li key={idx} className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-brand-accent/10 flex items-center justify-center flex-shrink-0">
                                        <item.icon className="w-4 h-4 text-brand-accent" />
                                    </div>
                                    <span className="text-neutral-300 text-sm">{item.text}</span>
                                </li>
                            ))}
                        </ul>

                        <Button asChild className="flex items-center justify-center gap-2 mt-8 w-full">
                            <Link href="/offres">
                                <span>{tabContent[activeTab].cta}</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Bottom Micro Cards */}
                <div
                    ref={bottomCardsRef}
                    className="absolute left-[6vw] top-[88vh] w-[88vw] h-[10vh] flex gap-[2vw]"
                >
                    <div className="micro-card w-[28vw] h-full rounded-[10px] border border-white/10 bg-neutral-950/80 p-4 flex items-center gap-3">
                        <GraduationCap className="w-5 h-5 text-brand-accent flex-shrink-0" />
                        <div>
                            <span className="block text-white text-xs font-medium">Bilan stratégique</span>
                            <span className="block text-neutral-400 text-[10px]">Point de départ clair</span>
                        </div>
                    </div>

                    <div className="micro-card w-[28vw] h-full rounded-[10px] border border-white/10 bg-neutral-950/80 p-4 flex items-center gap-3">
                        <Bot className="w-5 h-5 text-brand-accent flex-shrink-0" />
                        <div>
                            <span className="block text-white text-xs font-medium">IA ARIA 24/7</span>
                            <span className="block text-neutral-400 text-[10px]">Pratique illimitée</span>
                        </div>
                    </div>

                    <div className="micro-card w-[28vw] h-full rounded-[10px] border border-white/10 bg-neutral-950/80 p-4 flex items-center gap-3">
                        <FileCheck className="w-5 h-5 text-brand-accent flex-shrink-0" />
                        <div>
                            <span className="block text-white text-xs font-medium">Suivi parent</span>
                            <span className="block text-neutral-400 text-[10px]">Résultats visibles</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default OfferSection;
