"use client";

import React from 'react';
import { TechNavbar } from '@/components/layout/TechNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import {
    Brain,
    ChevronRight,
    Code2,
    LineChart,
    Blocks,
    Cpu,
    ShieldCheck,
    Users,
    Layout,
    Rocket,
    Compass,
    School,
    Database,
    Bot,
    Server,
    Workflow,
    Terminal,
    ArrowRight,
    Sparkles
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function HomePage() {
    const { t } = useLanguage();

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30 selection:text-blue-200">

            {/* --- NAVBAR --- */}
            <TechNavbar />

            {/* --- HERO SECTION --- */}
            <section className="relative overflow-hidden pt-32 pb-20 md:pt-48 md:pb-32">
                {/* Abstract Background with Animated Gradients */}
                <div className="absolute inset-0 bg-slate-950">
                    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
                    <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse delay-1000" />
                    {/* Fallback Radial Gradient */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-950 to-slate-950" />
                    <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
                </div>

                <div className="container relative mx-auto px-4 md:px-6 text-center z-10">
                    <div className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-300 mb-8 backdrop-blur-md shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)]">
                        <Rocket size={14} className="mr-2 text-blue-400" />
                        {t.hero.badge}
                    </div>

                    <h1 className="text-5xl font-extrabold tracking-tight text-white md:text-7xl lg:text-8xl mb-8 leading-tight">
                        {t.hero.headline.part1} <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 animate-gradient">
                            {t.hero.headline.part2}
                        </span>
                    </h1>

                    <p className="mx-auto max-w-3xl text-xl text-slate-400 mb-12 leading-relaxed font-light">
                        {t.hero.description}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
                        <a href="mailto:contact@nexusreussite.academy" className="group flex items-center justify-center h-14 px-8 rounded-full bg-white text-slate-950 font-bold text-lg hover:bg-blue-50 transition-all hover:scale-105 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]">
                            {t.hero.cta_audit}
                            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </a>
                        <a href="#factory" className="flex items-center justify-center h-14 px-8 rounded-full border border-slate-700 bg-slate-900/50 text-slate-300 font-medium text-lg hover:bg-slate-800 hover:border-slate-500 hover:text-white backdrop-blur-sm transition-all gap-2">
                            {t.hero.cta_tech} <ChevronRight size={18} />
                        </a>
                    </div>
                </div>
            </section>

            {/* --- TECH CREDIBILITY STRIP --- */}
            <section className="border-y border-slate-800 bg-slate-950/50 backdrop-blur-sm py-8 overflow-hidden">
                <div className="container mx-auto px-4">
                    <p className="text-center text-sm font-semibold text-slate-500 uppercase tracking-widest mb-6">{t.tech_strip}</p>
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-70 hover:opacity-100 transition-opacity duration-500">
                        {/* Tech Badges */}
                        <div className="flex items-center gap-2 text-slate-300 font-mono font-semibold hover:text-blue-400 transition-colors">
                            <Code2 className="w-6 h-6 text-blue-500" /> Python
                        </div>
                        <div className="flex items-center gap-2 text-slate-300 font-mono font-semibold hover:text-green-400 transition-colors">
                            <Database className="w-6 h-6 text-green-500" /> Vector DB
                        </div>
                        <div className="flex items-center gap-2 text-slate-300 font-mono font-semibold hover:text-purple-400 transition-colors">
                            <Blocks className="w-6 h-6 text-purple-500" /> Solana/Web3
                        </div>
                        <div className="flex items-center gap-2 text-slate-300 font-mono font-semibold hover:text-white transition-colors">
                            <Layout className="w-6 h-6 text-white" /> Next.js
                        </div>
                        <div className="flex items-center gap-2 text-slate-300 font-mono font-semibold hover:text-orange-400 transition-colors">
                            <Bot className="w-6 h-6 text-orange-500" /> LangChain
                        </div>
                        <div className="flex items-center gap-2 text-slate-300 font-mono font-semibold hover:text-blue-400 transition-colors">
                            <Server className="w-6 h-6 text-blue-400" /> Docker
                        </div>
                    </div>
                </div>
            </section>

            {/* --- DUAL DNA STRUCTURE --- */}
            <section className="py-24 bg-slate-950 relative">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium mb-6 border border-indigo-500/20">
                            <Sparkles size={16} />
                            <span>{t.dna.badge}</span>
                        </div>
                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                            {t.dna.title.part1} <span className="text-blue-400">{t.dna.title.part2}</span> {t.dna.title.part3}
                        </h2>
                        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                            {t.dna.description}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* LEFT: CONSULTING */}
                        <div className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-900/50 p-8 md:p-12 hover:border-blue-500/30 transition-all duration-500 hover:shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)]">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Compass size={120} className="text-blue-500" />
                            </div>

                            <div className="relative z-10">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium mb-6 border border-blue-500/20">
                                    <Users size={16} />
                                    <span>{t.dna.consulting.badge}</span>
                                </div>
                                <h3 className="text-3xl font-bold text-white mb-4">{t.dna.consulting.title}</h3>
                                <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                                    {t.dna.consulting.description}
                                </p>

                                <ul className="space-y-4 mb-8">
                                    <li className="flex items-start gap-3">
                                        <div className="mt-1 p-1 rounded bg-blue-500/20 text-blue-400"><LineChart size={16} /></div>
                                        <div>
                                            <h4 className="font-semibold text-slate-200">{t.dna.consulting.list.audit.title}</h4>
                                            <p className="text-sm text-slate-500">{t.dna.consulting.list.audit.desc}</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="mt-1 p-1 rounded bg-blue-500/20 text-blue-400"><School size={16} /></div>
                                        <div>
                                            <h4 className="font-semibold text-slate-200">{t.dna.consulting.list.training.title}</h4>
                                            <p className="text-sm text-slate-500">{t.dna.consulting.list.training.desc}</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="mt-1 p-1 rounded bg-blue-500/20 text-blue-400"><Users size={16} /></div>
                                        <div>
                                            <h4 className="font-semibold text-slate-200">{t.dna.consulting.list.hr.title}</h4>
                                            <p className="text-sm text-slate-500">{t.dna.consulting.list.hr.desc}</p>
                                        </div>
                                    </li>
                                </ul>

                                <a href="#contact" className="text-blue-400 font-semibold flex items-center gap-2 hover:text-blue-300 transition-colors group/link">
                                    {t.dna.consulting.cta} <ArrowRight size={16} className="group-hover/link:translate-x-1 transition-transform" />
                                </a>
                            </div>
                        </div>

                        {/* RIGHT: FACTORY */}
                        <div id="factory" className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-900/50 p-8 md:p-12 hover:border-purple-500/30 transition-all duration-500 hover:shadow-[0_0_50px_-12px_rgba(168,85,247,0.3)]">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Cpu size={120} className="text-purple-500" />
                            </div>

                            <div className="relative z-10">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-sm font-medium mb-6 border border-purple-500/20">
                                    <Code2 size={16} />
                                    <span>{t.dna.factory.badge}</span>
                                </div>
                                <h3 className="text-3xl font-bold text-white mb-4">{t.dna.factory.title}</h3>
                                <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                                    {t.dna.factory.description}
                                </p>

                                <ul className="space-y-4 mb-8">
                                    <li className="flex items-start gap-3">
                                        <div className="mt-1 p-1 rounded bg-purple-500/20 text-purple-400"><Bot size={16} /></div>
                                        <div>
                                            <h4 className="font-semibold text-slate-200">{t.dna.factory.list.agentic.title}</h4>
                                            <p className="text-sm text-slate-500">{t.dna.factory.list.agentic.desc}</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="mt-1 p-1 rounded bg-purple-500/20 text-purple-400"><Database size={16} /></div>
                                        <div>
                                            <h4 className="font-semibold text-slate-200">{t.dna.factory.list.rag.title}</h4>
                                            <p className="text-sm text-slate-500">{t.dna.factory.list.rag.desc}</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="mt-1 p-1 rounded bg-purple-500/20 text-purple-400"><Blocks size={16} /></div>
                                        <div>
                                            <h4 className="font-semibold text-slate-200">{t.dna.factory.list.web3.title}</h4>
                                            <p className="text-sm text-slate-500">{t.dna.factory.list.web3.desc}</p>
                                        </div>
                                    </li>
                                </ul>

                                <a href="#contact" className="text-purple-400 font-semibold flex items-center gap-2 hover:text-purple-300 transition-colors group/link">
                                    {t.dna.factory.cta} <ArrowRight size={16} className="group-hover/link:translate-x-1 transition-transform" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- DEEP DIVE: RAG & AI --- */}
            <section className="py-24 bg-slate-900 border-t border-slate-800">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="flex flex-col lg:flex-row items-center gap-16">
                        <div className="lg:w-1/2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium mb-6 border border-indigo-500/20">
                                <Brain size={16} />
                                <span>{t.ai.badge}</span>
                            </div>
                            <h2 className="text-4xl font-bold text-white mb-6">
                                {t.ai.title.part1} <br />
                                <span className="text-indigo-400">{t.ai.title.part2}</span>
                            </h2>
                            <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                                {t.ai.description}
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 backdrop-blur-sm hover:border-indigo-500/30 transition-colors">
                                    <div className="text-3xl font-bold text-white mb-1">98%</div>
                                    <div className="text-sm text-slate-400">{t.ai.stats.precision}</div>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 backdrop-blur-sm hover:border-indigo-500/30 transition-colors">
                                    <div className="text-3xl font-bold text-white mb-1">&lt;200ms</div>
                                    <div className="text-sm text-slate-400">{t.ai.stats.latency}</div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:w-1/2 w-full">
                            {/* Code Snippet Visualization */}
                            <div className="rounded-xl overflow-hidden bg-[#1E1E1E] shadow-2xl border border-slate-700 font-mono text-sm hover:shadow-[0_0_50px_-12px_rgba(99,102,241,0.5)] transition-shadow">
                                <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-black">
                                    <div className="flex gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#FF5F56]"></div>
                                        <div className="w-3 h-3 rounded-full bg-[#FFBD2E]"></div>
                                        <div className="w-3 h-3 rounded-full bg-[#27C93F]"></div>
                                    </div>
                                    <span className="text-slate-400 text-xs">nexus_agent_core.py</span>
                                </div>
                                <div className="p-6 text-slate-300 overflow-x-auto">
                                    <p><span className="text-purple-400">from</span> nexus_core <span className="text-purple-400">import</span> RAGAgent, VectorStore</p>
                                    <p>&nbsp;</p>
                                    <p><span className="text-slate-500"># Initialisation du Knowledge Graph</span></p>
                                    <p><span className="text-blue-400">knowledge_base</span> = VectorStore.connect(<span className="text-green-400">"curriculum_nsi_2024"</span>)</p>
                                    <p>&nbsp;</p>
                                    <p><span className="text-slate-500"># Déploiement de l'Agent Tuteur</span></p>
                                    <p><span className="text-blue-400">tutor</span> = RAGAgent(</p>
                                    <p>&nbsp;&nbsp;model=<span className="text-green-400">"gpt-4-turbo"</span>,</p>
                                    <p>&nbsp;&nbsp;temperature=<span className="text-orange-400">0.2</span>,</p>
                                    <p>&nbsp;&nbsp;context_window=<span className="text-orange-400">128000</span></p>
                                    <p>)</p>
                                    <p>&nbsp;</p>
                                    <p><span className="text-yellow-400">await</span> tutor.analyze_student_gap(<span className="text-green-400">"student_id_x89"</span>)</p>
                                    <p className="text-slate-500"># Output: Generating personalized remediation plan...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- WEB3 SECTION --- */}
            <section className="py-24 bg-gradient-to-b from-slate-900 to-slate-950 border-t border-slate-800">
                <div className="container mx-auto px-4 md:px-6 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium mb-6 border border-indigo-500/20">
                        <Blocks size={16} />
                        <span>{t.web3.badge}</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">{t.web3.title}</h2>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-16">
                        {t.web3.description}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800/70 transition-all text-left backdrop-blur-sm">
                            <ShieldCheck className="w-10 h-10 text-indigo-400 mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">{t.web3.cards.certification.title}</h3>
                            <p className="text-slate-400 text-sm">{t.web3.cards.certification.desc}</p>
                        </div>
                        <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800/70 transition-all text-left backdrop-blur-sm">
                            <Workflow className="w-10 h-10 text-indigo-400 mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">{t.web3.cards.governance.title}</h3>
                            <p className="text-slate-400 text-sm">{t.web3.cards.governance.desc}</p>
                        </div>
                        <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800/70 transition-all text-left backdrop-blur-sm">
                            <Terminal className="w-10 h-10 text-indigo-400 mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">{t.web3.cards.contracts.title}</h3>
                            <p className="text-slate-400 text-sm">{t.web3.cards.contracts.desc}</p>
                        </div>
                    </div>
                </div>
            </section>

             {/* --- BRIDGE CTA SECTION --- */}
            <section id="contact" className="py-20 border-t border-slate-900 bg-slate-950 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-900/10 blur-[100px] rounded-full pointer-events-none"></div>

                <div className="container mx-auto px-4 text-center relative z-10">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">
                        {t.bridge_cta.title}
                    </h2>
                    <div className="flex flex-col sm:flex-row gap-6 justify-center">
                        {/* Button 1 */}
                        <a href="mailto:contact@nexusreussite.academy?subject=Audit%20Institutionnel" className="group px-8 py-4 rounded-full border border-slate-600 text-white font-semibold hover:bg-slate-800 hover:border-slate-500 transition-all flex items-center justify-center gap-2">
                            <School size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                            <span>{t.bridge_cta.institution}</span>
                        </a>

                        {/* Button 2 */}
                        <a href="/studio" className="px-8 py-4 rounded-full bg-indigo-600 text-white font-semibold hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2">
                            <Cpu size={20} />
                            <span>{t.bridge_cta.tech}</span>
                        </a>
                    </div>
                </div>
            </section>

            {/* --- FOOTER --- */}
            <CorporateFooter />
        </div>
    );
}
