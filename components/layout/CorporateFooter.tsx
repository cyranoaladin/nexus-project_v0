"use client";

import React from 'react';
import { Mail, Phone, MapPin, ArrowRight } from 'lucide-react';

const CorporateFooter = () => {
    const scrollToSection = (id: string) => {
        const element = document.querySelector(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const links = [
        { label: 'Accueil', href: '#top' },
        { label: 'Notre ADN', href: '#adn' },
        { label: 'Offres & Parcours', href: '#paths' },
        { label: 'Korrigo Engine', href: '#korrigo' },
        { label: 'Contact', href: '#contact' }
    ];

    return (
        <footer className="relative bg-[#050608] pt-24 pb-8 overflow-hidden z-20 border-t border-white/5">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">

                    {/* Brand */}
                    <div className="lg:col-span-1">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center">
                                <span className="font-display font-bold text-white">N</span>
                            </div>
                            <span className="font-display font-bold text-white text-lg">NEXUS</span>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            L'excellence pédagogique augmentée par l'Intelligence Artificielle. <br />Pour ceux qui visent l'exceptionnel.
                        </p>
                    </div>

                    {/* Links */}
                    <div>
                        <h4 className="text-white font-medium text-sm mb-6">Exploration</h4>
                        <ul className="space-y-4">
                            {links.map((item, index) => (
                                <li key={index}>
                                    <button
                                        onClick={() => scrollToSection(item.href)}
                                        className="inline-flex items-center gap-2 text-gray-400 text-sm 
                             hover:text-cyan-400 hover:gap-3 transition-all duration-300"
                                    >
                                        <span>{item.label}</span>
                                        <ArrowRight className="w-3 h-3 opacity-0 hover:opacity-100" />
                                    </button>
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
                                    <span className="block text-gray-400 text-xs mt-1">
                                        Centre Urbain Nord, Immeuble VENUS<br />Appt C13, 1082 – Tunis
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors">
                                    <Mail className="w-4 h-4 text-cyan-400" />
                                    <span className="text-sm">contact@nexusreussite.academy</span>
                                </div>
                                <div className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors">
                                    <Phone className="w-4 h-4 text-cyan-400" />
                                    <span className="text-sm">+216 99 19 28 29</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-gray-500 text-xs">
                        © 2026 Nexus Réussite. Tous droits réservés.
                    </p>
                    <div className="flex items-center gap-6">
                        <a href="#" className="text-gray-500 text-xs hover:text-white transition-colors">
                            Mentions Légales
                        </a>
                        <a href="#" className="text-gray-500 text-xs hover:text-white transition-colors">
                            Politique de Confidentialité
                        </a>
                        <a href="#" className="text-gray-500 text-xs hover:text-white transition-colors">
                            CGV
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export { CorporateFooter };
