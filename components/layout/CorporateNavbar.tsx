import React from 'react';
import { Laptop } from 'lucide-react';
import Link from 'next/link';

export function CorporateNavbar() {
    return (
        <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md transition-all">
            <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
                <Link href="/" className="flex items-center gap-3 font-bold text-xl tracking-tighter text-slate-900">
                    <img src="/images/logo_slogan_nexus_x3.png" alt="Nexus Réussite" className="h-10 w-auto" />
                </Link>
                <div className="hidden xl:flex gap-8 text-sm font-medium text-slate-600">
                    <Link href="/consulting" className="hover:text-blue-600 transition-colors">Notre Expertise 360°</Link>
                    <Link href="/studio" className="hover:text-blue-600 transition-colors">Solutions Agentiques & RAG</Link>
                    <Link href="/academy" className="hover:text-blue-600 transition-colors">Blockchain & Innovation</Link>
                    <Link href="/education" className="hover:text-blue-600 transition-colors">Éducation & Accompagnement</Link>
                </div>
                <div className="flex gap-4">
                    <Link href="/plateforme" className="hidden md:inline-flex h-10 items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-6 text-sm font-bold text-blue-700 transition-all hover:bg-blue-100 hover:shadow-md focus:outline-none">
                        <Laptop size={16} className="mr-2" />
                        Notre Produit SaaS
                    </Link>
                    <Link href="mailto:contact@nexusreussite.academy" className="inline-flex h-10 items-center justify-center rounded-full bg-slate-900 px-6 text-sm font-medium text-white shadow-lg transition-all hover:bg-slate-800 hover:scale-105 focus:outline-none">
                        Demander un devis
                    </Link>
                </div>
            </div>
        </nav>
    );
}
