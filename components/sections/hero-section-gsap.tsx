"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Sparkles, Cpu, Blocks, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HeroSectionGSAP = () => {

    const authorityBadges = [
        { icon: Cpu, label: 'IA ARIA 24/7', color: 'blue' },
        { icon: GraduationCap, label: 'Agrégés et Certifiés', color: 'emerald' },
        { icon: Blocks, label: '98% Réussite', color: 'purple' },
    ];

    const badgePositions = [
        { x: 140, y: 0 },
        { x: -70, y: 121.244 },
        { x: -70, y: -121.244 },
    ];

    const formatOffset = (value: number) => {
        const sign = value >= 0 ? '+' : '-';
        const abs = Math.abs(value);
        const normalized = Number.isInteger(abs)
            ? abs.toString()
            : abs.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
        return `calc(50% ${sign} ${normalized}px)`;
    };

    return (
        <section
            id="hero"
            className="bg-surface-darker flex items-center justify-center overflow-hidden h-screen w-full relative"
            style={{ zIndex: 10 }}
        >
            {/* Background Visual */}
            <div
                className="absolute inset-0 z-0 hero-bg-animate"
            >
                <Image
                    src="/images/hero_precision.jpg"
                    alt="Nexus Réussite - Pédagogie augmentée pour lycéens du système français en Tunisie"
                    fill
                    className="object-cover opacity-70"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-r from-surface-darker via-surface-darker/90 to-surface-darker/60" />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-darker via-transparent to-surface-darker/70" />

                {/* Animated Grid Overlay */}
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
            `,
                        backgroundSize: '60px 60px'
                    }} />
                </div>
            </div>

            {/* Content */}
            <div className="relative z-10 w-full h-full flex items-center px-[6vw]">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full max-w-7xl mx-auto">

                    {/* Left - Text Content */}
                    <div className="flex flex-col justify-center">
                        {/* Premium Badge */}
                        <div className="hero-animate-in hero-stagger-1 inline-flex items-center gap-2 px-4 py-2 rounded-full
                            bg-white/5 border border-white/10 w-fit mb-6 backdrop-blur-sm">
                            <Sparkles className="w-4 h-4 text-brand-primary" aria-hidden="true" />
                            <span className="font-mono text-xs uppercase tracking-[0.16em] text-neutral-400">
                                Pédagogie augmentée pour lycéens du système français
                            </span>
                        </div>

                        {/* Headline */}
                        <h1 className="hero-animate-in hero-stagger-2 font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.05]">
                            La{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary via-brand-accent to-brand-primary">
                                réussite au Bac
                            </span>{' '}
                            commence ici.
                        </h1>

                        {/* Value Proposition */}
                        <p className="hero-animate-in hero-stagger-3 text-neutral-300/90 mt-6 text-lg leading-relaxed max-w-xl">
                            Coachs agrégés et certifiés, IA ARIA 24/7 et suivi parent clair :
                            Nexus Réussite transforme le potentiel de votre enfant
                            en résultats visibles.
                        </p>

                        {/* CTAs */}
                        <div className="hero-animate-in hero-stagger-4 flex flex-wrap items-center gap-4 mt-8">
                            <Button
                                asChild
                                size="lg"
                                className="group bg-gradient-to-r from-brand-primary to-brand-accent hover:shadow-xl hover:shadow-brand-accent/30"
                            >
                                <Link href="/bilan-gratuit">
                                    <span>Bilan gratuit</span>
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                size="lg"
                                className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-brand-accent/30"
                            >
                                <Link href="/offres">
                                    <span>Voir nos offres</span>
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {/* Right - Authority Indicators */}
                    <div className="hidden lg:flex items-center justify-center">
                        <div
                            className="relative"
                        >
                            {/* Central Hub */}
                            <div className="w-48 h-48 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 
                            border border-blue-500/30 flex items-center justify-center
                            backdrop-blur-xl">
                                <div className="text-center">
                                    <span className="block font-display text-4xl font-bold text-white">N</span>
                                    <span className="block text-xs text-gray-400 mt-1">NEXUS</span>
                                </div>
                            </div>

                            {/* Orbiting Badges */}
                            {authorityBadges.map((badge, index) => {
                                const position = badgePositions[index] ?? { x: 0, y: 0 };

                                return (
                                    <div
                                        key={index}
                                        className={`hero-badge-animate hero-badge-stagger-${index + 1} absolute w-24 h-24 -ml-12 -mt-12`}
                                        style={{
                                            left: formatOffset(position.x),
                                            top: formatOffset(position.y),
                                        }}
                                    >
                                        <div className={`w-full h-full rounded-2xl bg-white/5 border border-white/10 
                                   flex flex-col items-center justify-center gap-2
                                   backdrop-blur-md hover:bg-white/10 transition-colors`}>
                                            <badge.icon className={`w-6 h-6 ${badge.color === 'blue' ? 'text-blue-400' :
                                                badge.color === 'purple' ? 'text-purple-400' : 'text-emerald-400'
                                                }`} />
                                            <span className="text-xs text-gray-300 font-medium">{badge.label}</span>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Connection Lines (SVG) */}
                            <svg className="absolute inset-0 w-full h-full -z-10" style={{ transform: 'scale(1.5)' }}>
                                <circle
                                    cx="50%" cy="50%" r="140"
                                    fill="none"
                                    stroke="url(#gradient)"
                                    strokeWidth="1"
                                    strokeDasharray="8 4"
                                    opacity="0.3"
                                />
                                <defs>
                                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#3b82f6" />
                                        <stop offset="100%" stopColor="#06b6d4" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Gradient Fade */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0b0f] to-transparent z-20" />
        </section>
    );
};

export default HeroSectionGSAP;
