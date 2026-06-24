"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, Phone, MapPin, ArrowRight } from 'lucide-react';
import { FloatingAdvisorBubble, NewsletterSignup } from '@/components/marketing/acadomia-inspired';
import { MobileStickyBar } from '@/components/marketing/MobileStickyBar';
import { PREPARATION_LINKS } from '@/content/marketing/preparation-links';
import { LEGAL } from '@/lib/legal';

const CorporateFooter = () => {
    const scrollToSection = (id: string) => {
        const element = document.querySelector(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const links = [
        { label: 'Accueil', href: '/', isPage: true },
        { label: 'Accompagnement Scolaire', href: '/accompagnement-scolaire', isPage: true },
        { label: 'Offres', href: '/offres', isPage: true },
        { label: 'Stages', href: '/stages', isPage: true },
        { label: 'Plateforme ARIA', href: '/plateforme-aria', isPage: true },
        { label: 'Ressources', href: '/ressources', isPage: true },
        { label: 'Notre Équipe', href: '/equipe', isPage: true },
        { label: 'Notre Centre', href: '/notre-centre', isPage: true },
        { label: 'Bilan Gratuit', href: '/bilan-gratuit', isPage: true },
        { label: 'Contact', href: '/contact', isPage: true }
    ];

    return (
        <footer className="relative bg-surface-darker pt-24 pb-28 overflow-hidden z-20 border-t border-white/10 lg:pb-8">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">

                    {/* Brand */}
                    <div className="lg:col-span-1">
                        <div className="mb-6">
                            <Image
                                src="/images/logo_slogan_nexus.webp"
                                alt="Nexus Réussite"
                                width={150}
                                height={54}
                                className="h-8 w-auto brightness-0 invert"
                            />
                        </div>
                        <p className="text-neutral-300 text-sm leading-relaxed">
                            Un accompagnement pédagogique exigeant, augmenté par l&apos;IA selon la formule, pour les familles qui recherchent un cadre sérieux, sobre et cohérent.
                        </p>
                    </div>

                    {/* Links */}
                    <div>
                        <h2 className="font-fraunces text-lg font-medium text-lux-ivory mb-6">Exploration</h2>
                        <ul className="space-y-4">
                            {links.map((item, index) => (
                                <li key={index}>
                                    {item.isPage ? (
                                        <Link
                                            href={item.href}
                                            className="group inline-flex items-center gap-2 text-neutral-300 text-sm hover:text-lux-gold-wash hover:gap-3 transition-all duration-300"
                                        >
                                            <span>{item.label}</span>
                                            <ArrowRight className="w-3 h-3 opacity-0 transition-opacity group-hover:opacity-100" />
                                        </Link>
                                    ) : (
                                        <button
                                            onClick={() => scrollToSection(item.href)}
                                            className="group inline-flex items-center gap-2 text-neutral-300 text-sm hover:text-lux-gold-wash hover:gap-3 transition-all duration-300"
                                        >
                                            <span>{item.label}</span>
                                            <ArrowRight className="w-3 h-3 opacity-0 transition-opacity group-hover:opacity-100" />
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h2 className="font-fraunces text-lg font-medium text-lux-ivory mb-6">Préparations</h2>
                        <ul className="space-y-4">
                            {PREPARATION_LINKS.map((item) => (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className="group inline-flex items-center gap-2 text-neutral-300 text-sm hover:text-lux-gold-wash hover:gap-3 transition-all duration-300"
                                    >
                                        <span>{item.label}</span>
                                        <ArrowRight className="w-3 h-3 opacity-0 transition-opacity group-hover:opacity-100" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact */}
                    <div className="lg:col-span-2">
                        <h2 className="font-fraunces text-lg font-medium text-lux-ivory mb-6">Coordonnées</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-lux-gold-wash mt-1" />
                                <div>
                                    <span className="block text-lux-ivory text-sm font-medium">Siège social administratif</span>
                                    <span className="block text-neutral-300 text-xs mt-1">
                                        {LEGAL.addresses.siege.full}
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-lux-gold-wash mt-1" />
                                <div>
                                    <span className="block text-lux-ivory text-sm font-medium">Centre d&apos;accompagnement pédagogique</span>
                                    <span className="block text-neutral-300 text-xs mt-1">
                                        {LEGAL.addresses.pedagogique.full}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-neutral-300 hover:text-white transition-colors">
                                    <Mail className="w-4 h-4 text-lux-gold-wash" />
                                    <span className="text-sm">{LEGAL.contact.email}</span>
                                </div>
                                <div className="flex items-center gap-3 text-neutral-300 hover:text-white transition-colors">
                                    <Phone className="w-4 h-4 text-lux-gold-wash" />
                                    <span className="text-sm">{LEGAL.contact.phone}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Newsletter — full width, above bottom bar */}
                <div className="mb-12 max-w-2xl">
                    <NewsletterSignup />
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="max-w-3xl text-center md:text-left text-neutral-300 text-xs leading-relaxed">
                        {LEGAL.copyright.notice()}
                    </p>
                    <div className="flex items-center gap-6">
                        <Link href="/mentions-legales" className="text-neutral-300 text-xs hover:text-lux-gold-wash transition-colors">
                            Mentions Légales
                        </Link>
                        <Link href="/conditions-generales" className="text-neutral-300 text-xs hover:text-lux-gold-wash transition-colors">
                            Conditions Générales
                        </Link>
                        <Link href="/contact" className="text-neutral-300 text-xs hover:text-lux-gold-wash transition-colors">
                            Contact
                        </Link>
                    </div>
                </div>
            </div>
            <FloatingAdvisorBubble />
            <MobileStickyBar />
        </footer>
    );
};

export { CorporateFooter };
