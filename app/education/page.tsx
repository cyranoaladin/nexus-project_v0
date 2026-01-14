import React from 'react';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { Heart, Users, Map, School } from 'lucide-react';

export default function EducationPage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <CorporateNavbar />

            {/* Hero */}
            <section className="bg-white py-24 border-b border-slate-100">
                <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center gap-12">
                    <div className="md:w-1/2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-sm font-medium mb-6">
                            <Heart size={16} />
                            <span>Nexus Éducation</span>
                        </div>
                        <h1 className="text-5xl font-bold mb-6 text-slate-900">
                            L'Accompagnement <br /> <span className="text-teal-600">Humain.</span>
                        </h1>
                        <p className="text-xl text-slate-600 leading-relaxed">
                            Parce que la technologie ne remplace pas l'empathie. Nous sommes présents sur le terrain pour soutenir les élèves, les parents et les équipes éducatives.
                        </p>
                    </div>
                    <div className="md:w-1/2 flex justify-center">
                        <div className="relative w-80 h-80 bg-teal-50 rounded-full flex items-center justify-center">
                            <div className="absolute inset-0 bg-teal-200 rounded-full opacity-20 animate-pulse"></div>
                            <Users size={120} className="text-teal-600" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Services Grid */}
            <section className="py-24">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

                        {/* Service 1 */}
                        <div className="flex gap-6">
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-md flex items-center justify-center text-teal-600 border border-teal-100 shrink-0">
                                <School size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Vie Scolaire & Soutien</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    Nous organisons des sessions de tutorat physique et des permanences d'aide aux devoirs. Un suivi personnalisé pour éviter le décrochage.
                                </p>
                            </div>
                        </div>

                        {/* Service 2 */}
                        <div className="flex gap-6">
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-md flex items-center justify-center text-indigo-600 border border-indigo-100 shrink-0">
                                <Map size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Orientation & Parcoursup</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    Le choix de l'avenir est stressant. Nos conseillers d'orientation utilisent nos outils d'analyse pour proposer des parcours adaptés aux passions de chaque élève.
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            <CorporateFooter />
        </div>
    );
}
