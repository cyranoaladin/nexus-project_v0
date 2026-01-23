"use client";

import React from 'react';
import { Network, Globe, Laptop } from 'lucide-react';
import Link from 'next/link';

export function CorporateFooter() {
    return (
        <footer className="bg-deep-midnight text-slate-400 py-16 border-t border-gold-600/30">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                    <div>
                        <div className="flex items-center gap-2 font-bold text-2xl text-white mb-6">
                            <Network size={28} className="text-gold-500" />
                            Nexus Digital Campus
                        </div>
                        <p className="text-sm leading-relaxed mb-6">
                            Cabinet de conseil & studio technologique. Nous concevons des architectures pédagogiques souveraines et des produits IA à impact.
                        </p>
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-gold-500/20 transition-colors cursor-pointer">
                                <Globe size={18} className="text-gold-500" />
                            </div>
                            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-gold-500/20 transition-colors cursor-pointer">
                                <Laptop size={18} className="text-gold-500" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-6 text-lg">Navigation</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link href="/#adn" className="hover:text-gold-400 transition-colors">Expertise (ADN)</Link></li>
                            <li><Link href="/#etablissements" className="hover:text-gold-400 transition-colors">Solutions Établissements</Link></li>
                            <li><Link href="/#parents_eleves" className="hover:text-gold-400 transition-colors">Espace Parents & Élèves</Link></li>
                            <li><Link href="/#formation_tech" className="hover:text-gold-400 transition-colors">Formation Tech & Pro</Link></li>
                            <li><Link href="/#korrigo" className="hover:text-gold-400 transition-colors">Korrigo</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-6 text-lg">Contact</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link href="/contact" className="hover:text-gold-400 transition-colors">Planifier une démo</Link></li>
                            <li><Link href="/contact" className="hover:text-gold-400 transition-colors">Solliciter un audit</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-6 text-lg">Coordonnées</h4>
                        <ul className="space-y-3 text-sm">
                            <li className="flex items-start gap-3">
                                <span className="text-gold-500">📍</span>
                                <div>
                                    Centre Urbain Nord <br />
                                    Immeuble VENUS, Apt. C13 <br />
                                    1082 – Tunis
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-gold-500">📧</span>
                                <a href="mailto:contact@nexusreussite.academy" className="hover:text-white">contact@nexusreussite.academy</a>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="text-gold-500">📞</span>
                                <span>+216 99 19 28 29</span>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-xs">
                    <p>&copy; {new Date().getFullYear()} Nexus Réussite. Tous droits réservés.</p>
                    <div className="flex gap-6 mt-4 md:mt-0">
                        <a href="#" className="hover:text-white">Mentions Légales</a>
                        <a href="#" className="hover:text-white">Politique de Confidentialité</a>
                        <a href="#" className="hover:text-white">CGV</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
