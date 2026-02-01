"use client";

import React, { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { School, Users, Briefcase, GraduationCap, FileCheck, Bot, Shield, Check, ArrowRight } from 'lucide-react';

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
        { icon: School, label: 'Établissements' },
        { icon: Users, label: 'Parents & Élèves' },
        { icon: Briefcase, label: 'Formation Pro' }
    ];

    const tabContent = [
        {
            title: "L'École Augmentée",
            subtitle: "Studio & Infra",
            items: [
                { icon: GraduationCap, text: "Nexus Digital Campus (LMS & pilotage)" },
                { icon: FileCheck, text: "Korrigo Engine (correction & analytics)" },
                { icon: Bot, text: "Agent Vie Scolaire (automatisation)" },
                { icon: Shield, text: "Certification sécurisée (Smart Credentials)" }
            ],
            cta: "Planifier une démo"
        },
        {
            title: "Accompagnement Elite",
            subtitle: "ARIA & Coaching",
            items: [
                { icon: Bot, text: "Tuteur IA ARIA disponible 24/7" },
                { icon: GraduationCap, text: "Cursus 'Elite Track' (Code / Web3)" },
                { icon: Check, text: "Coaching orientation personnalisé" },
                { icon: Shield, text: "Suivi parental sécurisé" }
            ],
            cta: "Découvrir l'accompagnement"
        },
        {
            title: "Formation Tech & Pro",
            subtitle: "IA & Web3",
            items: [
                { icon: Bot, text: "Bootcamp IA Générative" },
                { icon: Shield, text: "Certification Web3 & Blockchain" },
                { icon: GraduationCap, text: "Formation Staff (IA & outils)" },
                { icon: Check, text: "Accompagnement reconversion" }
            ],
            cta: "Explorer les formations"
        }
    ];

    return (
        <section
            ref={sectionRef}
            id="offer"
            className="section-pinned bg-[#0a0b0f] flex items-center justify-center cursor-default min-h-screen relative overflow-hidden"
            style={{ zIndex: 50 }}
        >
            <div className="relative w-full h-full flex items-center px-[6vw]">

                {/* Left Photo Card */}
                <div
                    ref={photoCardRef}
                    className="absolute left-[6vw] top-[14vh] w-[44vw] h-[72vh] card-dark overflow-hidden rounded-[18px] border border-white/10"
                >
                    <img
                        src="/images/classroom.jpg"
                        alt="Salle de classe"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#111318]/60 via-transparent to-[#111318]/80" />

                    {/* Overlay Content */}
                    <div className="absolute bottom-6 left-6 right-6">
                        <span className="label-mono text-nexus-cyan block mb-1">Nexus Réussite</span>
                        <h3 className="font-display text-2xl font-bold text-white mt-2">
                            Des livrables concrets
                        </h3>
                        <p className="text-gray-400 text-sm mt-1">
                            Pensés pour la direction, l'IT et les équipes pédagogiques.
                        </p>
                    </div>
                </div>

                {/* Right Offer Card */}
                <div
                    ref={offerCardRef}
                    className="absolute left-[52vw] top-[14vh] w-[42vw] h-[72vh] rounded-[18px] border border-white/10 bg-[#0a0b0f]/80 backdrop-blur-xl p-6 flex flex-col"
                >
                    {/* Tabs */}
                    <div className="flex border-b border-white/10">
                        {tabs.map((tab, index) => (
                            <button
                                key={index}
                                onClick={() => setActiveTab(index)}
                                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium
                          transition-all duration-300 relative ${activeTab === index
                                        ? 'text-cyan-400'
                                        : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                <span className="hidden sm:inline">{tab.label}</span>
                                {activeTab === index && (
                                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 flex flex-col justify-center py-6">
                        <span className="label-mono text-cyan-400 block mb-2">{tabContent[activeTab].subtitle}</span>
                        <h3 className="font-display text-2xl font-bold text-white mt-2">
                            {tabContent[activeTab].title}
                        </h3>

                        <ul className="mt-6 space-y-4">
                            {tabContent[activeTab].items.map((item, idx) => (
                                <li key={idx} className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-cyan-400/10 flex items-center justify-center flex-shrink-0">
                                        <item.icon className="w-4 h-4 text-cyan-400" />
                                    </div>
                                    <span className="text-gray-300 text-sm">{item.text}</span>
                                </li>
                            ))}
                        </ul>

                        <button className="btn-primary flex items-center justify-center gap-2 mt-8 w-full">
                            <span>{tabContent[activeTab].cta}</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Bottom Micro Cards */}
                <div
                    ref={bottomCardsRef}
                    className="absolute left-[6vw] top-[88vh] w-[88vw] h-[10vh] flex gap-[2vw]"
                >
                    <div className="micro-card w-[28vw] h-full rounded-[10px] border border-white/10 bg-[#0a0b0f]/80 p-4 flex items-center gap-3">
                        <GraduationCap className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                        <div>
                            <span className="block text-white text-xs font-medium">Nexus Stratégie</span>
                            <span className="block text-gray-400 text-[10px]">Pilotage avec vision</span>
                        </div>
                    </div>

                    <div className="micro-card w-[28vw] h-full rounded-[10px] border border-white/10 bg-[#0a0b0f]/80 p-4 flex items-center gap-3">
                        <Bot className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                        <div>
                            <span className="block text-white text-xs font-medium">Nexus Studio</span>
                            <span className="block text-gray-400 text-[10px]">L'IA qui travaille pour vous</span>
                        </div>
                    </div>

                    <div className="micro-card w-[28vw] h-full rounded-[10px] border border-white/10 bg-[#0a0b0f]/80 p-4 flex items-center gap-3">
                        <FileCheck className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                        <div>
                            <span className="block text-white text-xs font-medium">Nexus Academy</span>
                            <span className="block text-gray-400 text-[10px]">Élevez les compétences</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default OfferSection;
