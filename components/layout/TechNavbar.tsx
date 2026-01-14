"use client";

import React from 'react';
import { Laptop, Menu } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

export function TechNavbar() {
    const { t } = useLanguage();

    return (
        <nav className="fixed top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md transition-all">
            <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
                <Link href="/" className="flex items-center gap-3 font-bold text-xl tracking-tighter text-white">
                    <img src="/images/logo_slogan_nexus_x3.png" alt="Nexus Réussite" className="h-10 w-auto invert brightness-200 grayscale contrast-200" />
                </Link>
                
                {/* Desktop Menu */}
                <div className="hidden xl:flex gap-8 text-sm font-medium text-slate-400 items-center">
                    <Link href="#consulting" className="hover:text-white transition-colors">{t.nav.consulting}</Link>
                    <Link href="#factory" className="hover:text-white transition-colors">{t.nav.factory}</Link>
                    <Link href="/studio" className="hover:text-white transition-colors">{t.nav.studio}</Link>
                    <Link href="/academy" className="hover:text-white transition-colors">{t.nav.academy}</Link>
                </div>

                {/* CTA Buttons & Switcher */}
                <div className="hidden md:flex items-center gap-4">
                    <LanguageSwitcher />
                    <Link href="/plateforme" className="inline-flex h-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800/50 px-6 text-sm font-bold text-slate-200 transition-all hover:bg-slate-700 hover:border-slate-600 focus:outline-none backdrop-blur-sm">
                        <Laptop size={16} className="mr-2" />
                        {t.nav.platform}
                    </Link>
                    <Link href="mailto:contact@nexusreussite.academy" className="inline-flex h-10 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-medium text-white shadow-[0_0_20px_-5px_rgba(37,99,235,0.5)] transition-all hover:bg-blue-500 hover:scale-105 focus:outline-none">
                        {t.nav.contact}
                    </Link>
                </div>

                {/* Mobile Menu Toggle (Placeholder for now) */}
                <div className="md:hidden flex items-center gap-4">
                    <LanguageSwitcher />
                    <button className="text-slate-400 hover:text-white">
                        <Menu size={24} />
                    </button>
                </div>
            </div>
        </nav>
    );
}