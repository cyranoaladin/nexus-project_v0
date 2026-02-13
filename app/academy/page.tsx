import React from 'react';
import Link from 'next/link';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { Terminal, Sigma, Blocks, Award } from 'lucide-react';

export default function AcademyPage() {
    return (
        <div className="min-h-screen bg-surface-darker text-slate-200 font-sans selection:bg-brand-accent/20 selection:text-brand-accent">
            <CorporateNavbar />

            {/* Hero */}
            <section className="bg-surface-darker text-white py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-surface-darker via-surface-darker/70 to-surface-darker" />
                <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-brand-accent/5 blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-neutral-800/10 blur-3xl" />
                <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
                    <h1 className="marketing-hero-title mb-6 tracking-tight">
                        Nexus Academy : Formez les élites de demain.
                    </h1>
                    <p className="marketing-hero-copy max-w-3xl mx-auto">
                        Des Mathématiques fondamentales au Web3 Solana. Des cursus d'excellence pour élèves et enseignants.
                    </p>
                </div>
            </section>

            {/* Tracks */}
            <section className="py-24 container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="group bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:border-brand-accent/50 hover:bg-white/10 transition-all p-8">
                        <Terminal className="text-brand-accent h-10 w-10 mb-4" strokeWidth={1.5} />
                        <h3 className="text-xl font-bold mb-2 text-white">Parcours NSI & Python</h3>
                        <p className="text-sm text-slate-300 mb-3">Cible : Lycée & Prépas.</p>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Algorithmique, Structures de données, Projets Web. Un accompagnement pointu pour exceller au Bac et au-delà.
                        </p>
                    </div>

                    <div className="group bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:border-brand-accent/50 hover:bg-white/10 transition-all p-8">
                        <Sigma className="text-brand-accent h-10 w-10 mb-4" strokeWidth={1.5} />
                        <h3 className="text-xl font-bold mb-2 text-white">Mathématiques d'Excellence</h3>
                        <p className="text-sm text-slate-300 mb-3">Cible : Cycle Terminal.</p>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Rigueur du raisonnement, Analyse, Algèbre. Préparation aux concours et renforcement des acquis fondamentaux.
                        </p>
                    </div>

                    <div className="group bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:border-brand-accent/50 hover:bg-white/10 transition-all p-8">
                        <Blocks className="text-brand-accent h-10 w-10 mb-4" strokeWidth={1.5} />
                        <h3 className="text-xl font-bold mb-2 text-white">Web3 & Solana</h3>
                        <p className="text-sm text-slate-300 mb-3">Cible : Post-Bac & Pro.</p>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Développement de Smart Contracts sur Solana (Rust). Comprendre et bâtir l'internet décentralisé.
                        </p>
                    </div>
                </div>
            </section>

            {/* Certification On-Chain */}
            <section className="py-20 border-t border-white/10 bg-surface-darker">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="max-w-3xl mx-auto text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 text-brand-accent mb-6">
                            <Award className="h-6 w-6" strokeWidth={1.5} />
                        </div>
                        <h2 className="marketing-section-title mb-4">Certifiez vos compétences.</h2>
                        <p className="text-slate-300 mb-8">
                            Chaque module validé chez Nexus Academy délivre un certificat numérique infalsifiable, sécurisé et vérifiable instantanément par les recruteurs.
                        </p>
                        <a
                            href="/contact?subject=Catalogue%20Academy"
                            className="btn-outline-strong"
                        >
                            Découvrir le catalogue
                        </a>
                    </div>
                </div>
            </section>

            <section className="py-16">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 md:p-10">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div>
                                <p className="marketing-eyebrow">
                                    Prochaine étape
                                </p>
                                <h3 className="marketing-cta-title">
                                    Recevez le catalogue complet
                                </h3>
                                <p className="marketing-cta-copy">
                                    Programmes, prérequis et calendrier. Réponse rapide par notre équipe.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Link href="/contact?subject=Catalogue%20Academy" className="btn-primary">
                                    Demander le catalogue
                                </Link>
                                <Link href="/contact" className="btn-outline">
                                    Parler à un expert
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <CorporateFooter />
        </div>
    );
}
