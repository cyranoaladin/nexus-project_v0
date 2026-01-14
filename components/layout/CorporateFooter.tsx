"use client";

import React from 'react';
import { Network, Globe, Laptop, ShieldCheck, FileText, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

export function CorporateFooter() {
    const { t } = useLanguage();

    return (
        <footer className="bg-slate-950 text-slate-400 py-16 border-t border-slate-800 font-sans">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                    {/* Brand Column */}
                    <div>
                        <div className="flex items-center gap-2 font-bold text-2xl text-white mb-6">
                            <Network size={28} className="text-blue-500" />
                            NEXUS
                        </div>
                        <p className="text-sm leading-relaxed mb-6 text-slate-300">
                            {t.footer.tagline}
                        </p>
                        <p className="text-xs text-slate-500 mb-6">
                            {t.footer.sub_tagline}
                        </p>
                        <div className="flex gap-4">
                            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center hover:bg-blue-600 hover:text-white hover:border-blue-500 transition-all cursor-pointer">
                                <Globe size={18} />
                            </a>
                            <a href="mailto:contact@nexusreussite.academy" className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center hover:bg-blue-600 hover:text-white hover:border-blue-500 transition-all cursor-pointer">
                                <Laptop size={18} />
                            </a>
                        </div>
                    </div>

                    {/* Column 1: Consulting */}
                    <div>
                        <h4 className="font-bold text-white mb-6 text-lg flex items-center gap-2">
                            {t.footer.col1.title}
                        </h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link href="/consulting" className="hover:text-blue-400 transition-colors flex items-center gap-2"><ArrowUpRight size={12} /> {t.footer.col1.links.audit}</Link></li>
                            <li><Link href="/consulting" className="hover:text-blue-400 transition-colors flex items-center gap-2"><ArrowUpRight size={12} /> {t.footer.col1.links.engineering}</Link></li>
                            <li><Link href="/education" className="hover:text-blue-400 transition-colors flex items-center gap-2"><ArrowUpRight size={12} /> {t.footer.col1.links.support}</Link></li>
                            <li><Link href="/education" className="hover:text-blue-400 transition-colors flex items-center gap-2"><ArrowUpRight size={12} /> {t.footer.col1.links.strategy}</Link></li>
                        </ul>
                    </div>

                    {/* Column 2: Factory */}
                    <div>
                        <h4 className="font-bold text-white mb-6 text-lg flex items-center gap-2">
                            {t.footer.col2.title}
                        </h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link href="/studio" className="hover:text-purple-400 transition-colors flex items-center gap-2"><ArrowUpRight size={12} /> {t.footer.col2.links.studio}</Link></li>
                            <li><Link href="/studio" className="hover:text-purple-400 transition-colors flex items-center gap-2"><ArrowUpRight size={12} /> {t.footer.col2.links.saas}</Link></li>
                            <li><Link href="/academy" className="hover:text-purple-400 transition-colors flex items-center gap-2"><ArrowUpRight size={12} /> {t.footer.col2.links.blockchain}</Link></li>
                            <li><Link href="/plateforme" className="hover:text-purple-400 transition-colors flex items-center gap-2"><ArrowUpRight size={12} /> {t.footer.col2.links.product}</Link></li>
                        </ul>
                    </div>

                    {/* Column 3: Legal & Contact */}
                    <div>
                        <h4 className="font-bold text-white mb-6 text-lg flex items-center gap-2">
                            {t.footer.col3.title}
                        </h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link href="/mentions-legales" className="hover:text-white transition-colors flex items-center gap-2"><FileText size={14} /> {t.footer.col3.links.mentions}</Link></li>
                            <li><Link href="/mentions-legales#cgu" className="hover:text-white transition-colors flex items-center gap-2"><ShieldCheck size={14} /> {t.footer.col3.links.cgu}</Link></li>
                            <li className="pt-4 text-xs text-slate-500">
                                <strong>{t.footer.address.hq}</strong><br />
                                {t.footer.address.location}
                            </li>
                            <li className="text-xs text-slate-500">
                                <strong>{t.footer.address.contact}</strong><br />
                                <a href="mailto:contact@nexusreussite.academy" className="hover:text-blue-400">contact@nexusreussite.academy</a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-slate-900 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-600">
                    <p>&copy; {new Date().getFullYear()} Nexus Réussite. {t.footer.rights}</p>
                    <div className="flex gap-6 mt-4 md:mt-0">
                        <Link href="/mentions-legales" className="hover:text-slate-400 transition-colors">{t.footer.col3.links.privacy}</Link>
                        <Link href="/mentions-legales" className="hover:text-slate-400 transition-colors">{t.footer.col3.links.cookies}</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
