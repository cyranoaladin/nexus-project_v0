import React from 'react';
import Link from 'next/link';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { LineChart, Server, Brain, Blocks, Code2 } from 'lucide-react';

export default function ConsultingPage() {
    return (
        <div className="min-h-screen bg-surface-darker text-slate-200 font-sans selection:bg-brand-accent/20 selection:text-brand-accent">
            <CorporateNavbar />

            {/* Hero */}
            <section className="bg-surface-darker text-white py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-surface-darker via-surface-darker/70 to-surface-darker" />
                <div className="absolute top-1/3 left-1/4 h-72 w-72 rounded-full bg-brand-accent/5 blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-neutral-800/10 blur-3xl" />
                <div className="container mx-auto px-4 md:px-6 relative z-10">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-brand-accent text-sm font-medium mb-6 border border-brand-accent/30 backdrop-blur-md">
                            <LineChart size={16} strokeWidth={1.5} />
                            <span>Nexus Consulting</span>
                        </div>
                        <h1 className="marketing-hero-title mb-6 tracking-tight">
                            Expertise 360° : L'Alliance de la Pédagogie et de la Technologie.
                        </h1>
                        <p className="marketing-hero-copy">
                            De l'audit de votre infrastructure réseau à l'intégration de l'IA en classe. Nous accompagnons la transformation numérique de votre établissement.
                        </p>
                    </div>
                </div>
            </section>

            {/* Services */}
            <section className="py-24 bg-surface-darker">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="text-center mb-16 max-w-2xl mx-auto">
                        <h2 className="marketing-section-title text-center mb-4">Nos 4 Piliers d'Intervention</h2>
                        <p className="marketing-section-copy text-center">
                            Une approche complète pour moderniser votre établissement et sécuriser vos parcours pédagogiques.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white/5 backdrop-blur-md p-8 rounded-2xl border border-white/10 hover:border-brand-accent/50 hover:bg-white/10 transition-all">
                            <Server className="text-brand-accent mb-4 h-10 w-10" strokeWidth={1.5} />
                            <h3 className="text-xl font-bold mb-3 text-white">Audit & Infrastructure</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Diagnostic complet de votre réseau, sécurité des données (RGPD) et équipement des salles. Optimisation pour les exigences de la spécialité NSI.
                            </p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-md p-8 rounded-2xl border border-white/10 hover:border-brand-accent/50 hover:bg-white/10 transition-all">
                            <Brain className="text-brand-accent mb-4 h-10 w-10" strokeWidth={1.5} />
                            <h3 className="text-xl font-bold mb-3 text-white">Ingénierie Pédagogique IA</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Formation des équipes enseignantes à l'IA générative. Comment intégrer ChatGPT/Claude dans les cours sans triche, mais avec intelligence.
                            </p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-md p-8 rounded-2xl border border-white/10 hover:border-brand-accent/50 hover:bg-white/10 transition-all">
                            <Blocks className="text-brand-accent mb-4 h-10 w-10" strokeWidth={1.5} />
                            <h3 className="text-xl font-bold mb-3 text-white">Certification Sécurisée</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Sécurisation des diplômes et bulletins avec des certificats numériques vérifiables. Garantissez l'authenticité des parcours de vos élèves à vie.
                            </p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-md p-8 rounded-2xl border border-white/10 hover:border-brand-accent/50 hover:bg-white/10 transition-all">
                            <Code2 className="text-brand-accent mb-4 h-10 w-10" strokeWidth={1.5} />
                            <h3 className="text-xl font-bold mb-3 text-white">Développement Sur Mesure</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Création d'outils métiers spécifiques et de Dashboards de pilotage pour la Vie Scolaire.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA final */}
            <section className="py-16 border-t border-white/10 bg-surface-darker">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 md:p-10">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div>
                                <p className="marketing-eyebrow">
                                    Prochaine étape
                                </p>
                                <h2 className="marketing-cta-title">
                                    Un projet spécifique ?
                                </h2>
                                <p className="marketing-cta-copy">
                                    Échangeons sur vos besoins techniques et pédagogiques.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Link href="/contact" className="btn-primary">
                                    Contacter la Direction Technique
                                </Link>
                                <Link href="/contact" className="btn-outline">
                                    Demander un devis
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
