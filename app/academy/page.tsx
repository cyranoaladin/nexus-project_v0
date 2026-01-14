
import React from 'react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { GraduationCap, Code2, Bot, Clock, BarChart } from 'lucide-react';

export default function AcademyPage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <CorporateNavbar />

            <section className="bg-blue-900 text-white py-24">
                <div className="container mx-auto px-4 md:px-6 text-center">
                    <GraduationCap className="mx-auto text-blue-300 h-16 w-16 mb-6" />
                    <h1 className="text-5xl md:text-6xl font-bold mb-6">Nexus Academy</h1>
                    <p className="text-xl text-blue-100 max-w-2xl mx-auto">
                        Formez-vous aux compétences les plus demandées du marché. <br />
                        Blockchain, Intelligence Artificielle et Développement Moderne.
                    </p>
                </div>
            </section>

            <section className="py-24 container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

                    {/* Course Card 1 */}
                    <div className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-xl hover:border-blue-300 transition-all">
                        <div className="bg-slate-900 p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">POUR DÉVELOPPEURS</div>
                                <Code2 className="text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Développeur Blockchain & Smart Contracts</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-600 text-sm mb-6 h-20">
                                Maîtrisez Solidity et Rust. Apprenez à déployer des dApps sécurisées et à auditer des contrats intelligents.
                            </p>
                            <div className="flex items-center gap-4 text-xs font-bold text-slate-400 border-t border-slate-100 pt-4">
                                <span className="flex items-center gap-1"><Clock size={14} /> 6 Mois</span>
                                <span className="flex items-center gap-1"><BarChart size={14} /> Avancé</span>
                            </div>
                        </div>
                    </div>

                    {/* Course Card 2 */}
                    <div className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-xl hover:border-purple-300 transition-all">
                        <div className="bg-slate-900 p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded">POUR TOUS</div>
                                <Bot className="text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Prompt Engineering pour l'Éducation</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-600 text-sm mb-6 h-20">
                                Comment utiliser ChatGPT et Claude pour créer des cours, corriger des copies et personnaliser l'apprentissage.
                            </p>
                            <div className="flex items-center gap-4 text-xs font-bold text-slate-400 border-t border-slate-100 pt-4">
                                <span className="flex items-center gap-1"><Clock size={14} /> 4 Semaines</span>
                                <span className="flex items-center gap-1"><BarChart size={14} /> Débutant</span>
                            </div>
                        </div>
                    </div>

                    {/* Course Card 3 */}
                    <div className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-xl hover:border-teal-300 transition-all">
                        <div className="bg-slate-900 p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-teal-600 text-white text-xs font-bold px-2 py-1 rounded">MANAGEMENT</div>
                                <GraduationCap className="text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Direction d'Établissement 4.0</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-600 text-sm mb-6 h-20">
                                Piloter la transformation numérique de son école. Gestion de projet, choix des outils et management des équipes.
                            </p>
                            <div className="flex items-center gap-4 text-xs font-bold text-slate-400 border-t border-slate-100 pt-4">
                                <span className="flex items-center gap-1"><Clock size={14} /> 3 Jours (Intensif)</span>
                                <span className="flex items-center gap-1"><BarChart size={14} /> Expert</span>
                            </div>
                        </div>
                    </div>

                </div>
            </section>

            <CorporateFooter />
        </div>
    );
}

