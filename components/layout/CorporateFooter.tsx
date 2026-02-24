"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, Phone, MapPin, ArrowRight } from 'lucide-react';

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
        { label: 'Notre Équipe', href: '/equipe', isPage: true },
        { label: 'Notre Centre', href: '/notre-centre', isPage: true },
        { label: 'Bilan Gratuit', href: '/bilan-gratuit', isPage: true },
        { label: 'Contact', href: '/contact', isPage: true }
    ];

    return (
        <footer className="relative bg-surface-darker pt-24 pb-8 overflow-hidden z-20 border-t border-white/5">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">

                    {/* Brand */}
                    <div className="lg:col-span-1">
                        <div className="mb-6">
                            <Image
                                src="/images/logo_slogan_nexus_x3.png"
                                alt="Nexus Réussite"
                                width={150}
                                height={54}
                                className="h-8 w-auto brightness-0 invert"
                            />
                        </div>
                        <p className="text-neutral-300 text-sm leading-relaxed mb-6">
                            L'excellence pédagogique augmentée par l'Intelligence Artificielle. <br />Pour ceux qui visent l'exceptionnel.
                        </p>
                    </div>

                    {/* Links */}
                    <div>
                        <h4 className="text-white font-medium text-sm mb-6">Exploration</h4>
                        <ul className="space-y-4">
                            {links.map((item, index) => (
                                <li key={index}>
                                    {item.isPage ? (
                                        <Link
                                            href={item.href}
                                            className="inline-flex items-center gap-2 text-neutral-300 text-sm
                                 hover:text-cyan-400 hover:gap-3 transition-all duration-300"
                                        >
                                            <span>{item.label}</span>
                                            <ArrowRight className="w-3 h-3 opacity-0 hover:opacity-100" />
                                        </Link>
                                    ) : (
                                        <button
                                            onClick={() => scrollToSection(item.href)}
                                            className="inline-flex items-center gap-2 text-neutral-300 text-sm
                                 hover:text-cyan-400 hover:gap-3 transition-all duration-300"
                                        >
                                            <span>{item.label}</span>
                                            <ArrowRight className="w-3 h-3 opacity-0 hover:opacity-100" />
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact */}
                    <div className="lg:col-span-2">
                        <h4 className="text-white font-medium text-sm mb-6">Coordonnées</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-cyan-400 mt-1" />
                                <div>
                                    <span className="block text-white text-sm font-medium">Siège Social</span>
                                    <span className="block text-neutral-300 text-xs mt-1">
                                        Centre Urbain Nord, Immeuble VENUS<br />Appt C13, 1082 – Tunis
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-neutral-300 hover:text-white transition-colors">
                                    <Mail className="w-4 h-4 text-cyan-400" />
                                    <span className="text-sm">contact@nexusreussite.academy</span>
                                </div>
                                <div className="flex items-center gap-3 text-neutral-300 hover:text-white transition-colors">
                                    <Phone className="w-4 h-4 text-cyan-400" />
                                    <span className="text-sm">+216 99 19 28 29</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-neutral-400 text-xs">
                        © 2026 Nexus Réussite. Tous droits réservés.
                    </p>
                    <div className="flex items-center gap-6">
                        <Link href="/mentions-legales" className="text-neutral-400 text-xs hover:text-white transition-colors">
                            Mentions Légales
                        </Link>
                        <Link href="/conditions-generales" className="text-neutral-400 text-xs hover:text-white transition-colors">
                            Conditions Générales
                        </Link>
                        <Link href="/contact" className="text-neutral-400 text-xs hover:text-white transition-colors">
                            Contact
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export { CorporateFooter };
