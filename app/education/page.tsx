import React from 'react';
import Link from 'next/link';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { Heart, Users, Map, School } from 'lucide-react';

export default function EducationPage() {
    return (
        <div className="min-h-screen bg-surface-darker text-neutral-100 font-sans">
            <CorporateNavbar />

            {/* Hero */}
            <section className="bg-surface-darker py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-surface-darker via-surface-darker/70 to-surface-darker" />
                <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-brand-accent/5 blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-neutral-800/10 blur-3xl" />
                <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center gap-12 relative z-10">
                    <div className="md:w-1/2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-brand-accent text-sm font-medium mb-6 border border-brand-accent/30 backdrop-blur-md">
                            <Heart size={16} />
                            <span>Nexus Éducation</span>
                        </div>
                        <h1 className="marketing-hero-title mb-6">
                            L'Accompagnement <br /> <span className="text-brand-accent">Humain.</span>
                        </h1>
                        <p className="marketing-hero-copy">
                            Parce que la technologie ne remplace pas l'empathie. Nous sommes présents sur le terrain pour soutenir les élèves, les parents et les équipes éducatives.
                        </p>
                    </div>
                    <div className="md:w-1/2 flex justify-center">
                        <div className="relative w-80 h-80 bg-white/5 rounded-full flex items-center justify-center border border-white/10 backdrop-blur-md">
                            <div className="absolute inset-0 bg-brand-accent/10 rounded-full opacity-40 animate-pulse"></div>
                            <Users size={120} className="text-brand-accent" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Services Grid */}
            <section className="py-24 bg-surface-darker">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

                        {/* Service 1 */}
                        <div className="flex gap-6">
                            <div className="w-16 h-16 bg-white/5 rounded-2xl shadow-premium flex items-center justify-center text-brand-accent border border-white/10 shrink-0">
                                <School size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-2">Vie Scolaire & Soutien</h3>
                                <p className="text-neutral-300 leading-relaxed">
                                    Nous organisons des sessions de tutorat physique et des permanences d'aide aux devoirs. Un suivi personnalisé pour éviter le décrochage.
                                </p>
                            </div>
                        </div>

                        {/* Service 2 */}
                        <div className="flex gap-6">
                            <div className="w-16 h-16 bg-white/5 rounded-2xl shadow-premium flex items-center justify-center text-brand-accent border border-white/10 shrink-0">
                                <Map size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-2">Orientation & Parcoursup</h3>
                                <p className="text-neutral-300 leading-relaxed">
                                    Le choix de l'avenir est stressant. Nos conseillers d'orientation utilisent nos outils d'analyse pour proposer des parcours adaptés aux passions de chaque élève.
                                </p>
                            </div>
                        </div>

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
                                    Parlons de vos besoins éducatifs
                                </h3>
                                <p className="marketing-cta-copy">
                                    Un bilan gratuit ou un échange rapide pour cadrer l'accompagnement.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Link href="/bilan-gratuit" className="btn-primary">
                                    Démarrer un bilan gratuit
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
