import React from 'react';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { LineChart, ClipboardCheck, Users, BookOpen, Presentation, Target } from 'lucide-react';

export default function ConsultingPage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <CorporateNavbar />

            {/* Hero */}
            <section className="bg-slate-900 text-white py-24 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-blue-900/20 blur-3xl"></div>
                <div className="container mx-auto px-4 md:px-6 relative z-10">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-sm font-medium mb-6">
                            <LineChart size={16} />
                            <span>Nexus Consulting</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
                            Stratégie & <br /> Gouvernance Numérique.
                        </h1>
                        <p className="text-xl text-slate-300 leading-relaxed">
                            Nous accompagnons les établissements scolaires dans leur mutation. Audit, formation des équipes et mise en place d'une feuille de route claire.
                        </p>
                    </div>
                </div>
            </section>

            {/* Audit & Transformation */}
            <section className="py-24">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="text-center mb-16 max-w-2xl mx-auto">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">Notre Offre d'Audit</h2>
                        <p className="text-slate-600">
                            Pour les collèges, lycées et universités. Nous analysons vos processus actuels pour identifier les leviers de performance numérique.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-200 transition-all">
                            <ClipboardCheck className="text-blue-600 mb-4 h-10 w-10" />
                            <h3 className="text-xl font-bold mb-3">Audit des Outils & Infrastructures</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                Vos outils actuels sont-ils performants ? Sont-ils sécurisés ? Nous scannons votre stack technique et vos usages pour optimiser les coûts et l'efficacité.
                            </p>
                        </div>
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-200 transition-all">
                            <Users className="text-indigo-600 mb-4 h-10 w-10" />
                            <h3 className="text-xl font-bold mb-3">Conduite du Changement</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                La technique n'est rien sans l'humain. Nous formons vos équipes pédagogiques et administratives à l'usage des nouveaux outils IA et collaboratifs.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Ingénierie Pédagogique */}
            <section className="py-24 bg-white border-t border-slate-100">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="flex flex-col md:flex-row items-center gap-16">
                        <div className="md:w-1/2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-6 rounded-xl">
                                    <BookOpen className="text-orange-500 mb-2" />
                                    <div className="font-bold">Syllabus</div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-xl transform translate-y-8">
                                    <Presentation className="text-blue-500 mb-2" />
                                    <div className="font-bold">Supports IA</div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-xl">
                                    <Target className="text-green-500 mb-2" />
                                    <div className="font-bold">KPIs Suivi</div>
                                </div>
                            </div>
                        </div>
                        <div className="md:w-1/2">
                            <h2 className="text-3xl font-bold text-slate-900 mb-6">Ingénierie Pédagogique</h2>
                            <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                                Créer un cours n'est plus suffisant. Il faut créer une **expérience d'apprentissage**.
                            </p>
                            <p className="text-slate-600 mb-4">
                                Nous concevons avec vous des cursus complets, intégrant :
                            </p>
                            <ul className="list-disc list-inside space-y-2 text-slate-700 font-medium">
                                <li>Parcours hybrides (Présentiel / Distanciel)</li>
                                <li>Systèmes d'évaluation adaptatifs</li>
                                <li>Contenus augmentés par l'Intelligence Artificielle</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            <CorporateFooter />
        </div>
    );
}
