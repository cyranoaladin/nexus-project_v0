import React from 'react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { Terminal, Sigma, Blocks, Award } from 'lucide-react';

export default function AcademyPage() {
    return (
        <div className="min-h-screen bg-deep-midnight text-slate-200 font-sans selection:bg-gold-500/20 selection:text-gold-400">
            <CorporateNavbar />

            {/* Hero */}
            <section className="bg-deep-midnight text-white py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-deep-midnight via-deep-midnight/70 to-deep-midnight" />
                <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-gold-500/5 blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-midnight-blue/10 blur-3xl" />
                <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
                    <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight font-serif">
                        Nexus Academy : Formez les élites de demain.
                    </h1>
                    <p className="text-xl text-slate-300 max-w-3xl mx-auto">
                        Des Mathématiques fondamentales au Web3 Solana. Des cursus d'excellence pour élèves et enseignants.
                    </p>
                </div>
            </section>

            {/* Tracks */}
            <section className="py-24 container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="group bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:border-gold-600/50 hover:bg-white/10 transition-all p-8">
                        <Terminal className="text-gold-500 h-10 w-10 mb-4" strokeWidth={1.5} />
                        <h3 className="text-xl font-bold mb-2 text-white">Parcours NSI & Python</h3>
                        <p className="text-sm text-slate-300 mb-3">Cible : Lycée & Prépas.</p>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Algorithmique, Structures de données, Projets Web. Un accompagnement pointu pour exceller au Bac et au-delà.
                        </p>
                    </div>

                    <div className="group bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:border-gold-600/50 hover:bg-white/10 transition-all p-8">
                        <Sigma className="text-gold-500 h-10 w-10 mb-4" strokeWidth={1.5} />
                        <h3 className="text-xl font-bold mb-2 text-white">Mathématiques d'Excellence</h3>
                        <p className="text-sm text-slate-300 mb-3">Cible : Cycle Terminal.</p>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Rigueur du raisonnement, Analyse, Algèbre. Préparation aux concours et renforcement des acquis fondamentaux.
                        </p>
                    </div>

                    <div className="group bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:border-gold-600/50 hover:bg-white/10 transition-all p-8">
                        <Blocks className="text-gold-500 h-10 w-10 mb-4" strokeWidth={1.5} />
                        <h3 className="text-xl font-bold mb-2 text-white">Web3 & Solana</h3>
                        <p className="text-sm text-slate-300 mb-3">Cible : Post-Bac & Pro.</p>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Développement de Smart Contracts sur Solana (Rust). Comprendre et bâtir l'internet décentralisé.
                        </p>
                    </div>
                </div>
            </section>

            {/* Certification On-Chain */}
            <section className="py-20 border-t border-white/10 bg-deep-midnight">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="max-w-3xl mx-auto text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 text-gold-500 mb-6">
                            <Award className="h-6 w-6" strokeWidth={1.5} />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-4 font-serif">Certifiez vos compétences.</h2>
                        <p className="text-slate-300 mb-8">
                            Chaque module validé chez Nexus Academy délivre un certificat numérique infalsifiable, sécurisé et vérifiable instantanément par les recruteurs.
                        </p>
                        <a
                            href="/contact?subject=Catalogue%20Academy"
                            className="inline-flex h-12 items-center justify-center rounded-full border border-gold-500 px-8 text-sm font-semibold text-white transition-all hover:bg-gold-500 hover:text-slate-950"
                        >
                            Découvrir le catalogue
                        </a>
                    </div>
                </div>
            </section>

            <CorporateFooter />
        </div>
    );
}
