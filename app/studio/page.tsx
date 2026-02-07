import React from 'react';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { Database, Search, Bot, Cpu, ShieldCheck } from 'lucide-react';

export default function StudioPage() {
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
                        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight font-display">
                            Nexus Studio : Architectes d'Intelligence Artificielle.
                        </h1>
                        <p className="text-xl text-slate-300 leading-relaxed">
                            Ne vous contentez pas d'utiliser l'IA. Construisez vos propres Agents Autonomes et systèmes RAG.
                        </p>
                    </div>
                </div>
            </section>

            {/* High Tech Blocks */}
            <section className="py-24 bg-surface-darker">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-white/5 backdrop-blur-md p-8 rounded-2xl border border-white/10 hover:border-brand-accent/50 hover:bg-white/10 transition-all">
                            <div className="flex items-center gap-3 mb-4 text-brand-accent">
                                <Database className="h-6 w-6" strokeWidth={1.5} />
                                <Search className="h-6 w-6" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-white">RAG Enterprise</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Transformez vos PDF et bases documentaires en connaissances exploitables par chat.
                            </p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-md p-8 rounded-2xl border border-white/10 hover:border-brand-accent/50 hover:bg-white/10 transition-all">
                            <div className="flex items-center gap-3 mb-4 text-brand-accent">
                                <Bot className="h-6 w-6" strokeWidth={1.5} />
                                <Cpu className="h-6 w-6" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-white">Agents Autonomes</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Déploiement d'équipes d'agents (CrewAI, LangGraph) pour automatiser vos tâches complexes.
                            </p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-md p-8 rounded-2xl border border-white/10 hover:border-brand-accent/50 hover:bg-white/10 transition-all">
                            <div className="flex items-center gap-3 mb-4 text-brand-accent">
                                <ShieldCheck className="h-6 w-6" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-white">Audit Algorithmique</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Analyse de performance et conformité de vos modèles LLM.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <CorporateFooter />
        </div>
    );
}
