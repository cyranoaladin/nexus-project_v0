"use client";

import React from 'react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { useLanguage } from '@/context/LanguageContext';
import { Info } from 'lucide-react';

export default function MentionsLegalesPage() {
    const { language } = useLanguage();

    return (
        <div className="min-h-screen bg-surface-darker text-neutral-100 font-sans">
            <CorporateNavbar />
            
            <main className="pt-32 pb-20">
                <div className="container mx-auto px-4 max-w-4xl">
                    <h1 className="text-4xl font-bold mb-8 text-white">
                        {language === 'en' ? 'Legal Notice & Terms of Use' : 'Mentions Légales & Conditions Générales'}
                    </h1>

                    {language === 'en' && (
                        <div className="mb-8 p-6 bg-brand-accent/10 border border-brand-accent/30 rounded-xl flex items-start gap-4">
                            <Info className="text-brand-accent shrink-0 mt-1" size={24} />
                            <p className="text-neutral-200 text-sm leading-relaxed">
                                <strong>Please note:</strong> Nexus Réussite is a Tunisian entity. The binding legal terms are drafted in French in accordance with local regulations. The version below is the original French text.
                            </p>
                        </div>
                    )}
                    
                    <div className="bg-surface-card p-8 md:p-12 rounded-2xl shadow-premium border border-white/10 space-y-8">
                        
                        <section>
                            <h2 className="text-2xl font-bold mb-4 text-white">1. Éditeur du Site</h2>
                            <p className="text-neutral-300 leading-relaxed">
                                Le site <strong>Nexus Réussite</strong> (ci-après "la Plateforme") est édité par la structure Nexus, agissant en qualité de Holding Technologique et de Conseil.
                            </p>
                            <ul className="mt-4 space-y-2 text-neutral-300">
                                <li><strong>Dénomination sociale :</strong> Nexus Réussite</li>
                                <li><strong>Forme juridique :</strong> Société à Responsabilité Limitée (SARL)</li>
                                <li><strong>Siège social :</strong> Centre Urbain Nord, Immeuble VENUS, Apt. C13, 1082 – Tunis, Tunisie.</li>
                                <li><strong>Email de contact :</strong> contact@nexusreussite.academy</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4 text-white">2. Nature des Activités (Double ADN)</h2>
                            <p className="text-neutral-300 leading-relaxed mb-4">
                                Nexus Réussite opère selon deux pôles d'activités distincts, régis par des obligations contractuelles spécifiques :
                            </p>
                            
                            <div className="pl-4 border-l-4 border-blue-500 mb-4">
                                <h3 className="font-bold text-lg text-white">2.1. Pôle Consulting (Advisory)</h3>
                                <p className="text-neutral-300">
                                    Les prestations de conseil en gouvernance, audit stratégique et ingénierie pédagogique sont soumises à une <strong>obligation de moyens</strong>. Nexus Réussite s'engage à mobiliser toute son expertise (académique et technique) pour accompagner le client, sans garantir l'atteinte d'un résultat chiffré spécifique, sauf disposition contractuelle contraire.
                                </p>
                            </div>

                            <div className="pl-4 border-l-4 border-purple-500">
                                <h3 className="font-bold text-lg text-white">2.2. Pôle Factory (Tech & Web3)</h3>
                                <p className="text-neutral-300">
                                    La fourniture de solutions logicielles (SaaS, RAG Pipelines, Smart Contracts) est régie par les Conditions Générales de Vente (CGV) spécifiques aux produits numériques. Nexus Réussite garantit la conformité du code livré aux spécifications fonctionnelles validées.
                                </p>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4 text-white">3. Hébergement & Infrastructure</h2>
                            <p className="text-neutral-300 leading-relaxed">
                                L'infrastructure technique est assurée par des prestataires répondant aux standards de sécurité internationaux (ISO 27001).
                            </p>
                            <ul className="mt-2 list-disc pl-5 text-neutral-300">
                                <li><strong>Hébergement Web :</strong> VPS Ubuntu (Docker, Nginx reverse proxy)</li>
                                <li><strong>Base de Données & Auth :</strong> PostgreSQL + NextAuth (JWT)</li>
                                <li><strong>Paiements :</strong> ClicToPay (Banque Zitouna, TND) & Virement bancaire</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4 text-white">4. Propriété Intellectuelle</h2>
                            <p className="text-neutral-300 leading-relaxed">
                                L'ensemble des éléments graphiques, logiciels, codes sources (notamment les agents IA et les contrats intelligents non open-source) et contenus éditoriaux présents sur le site sont la propriété exclusive de Nexus Réussite.
                                <br /><br />
                                Toute reproduction, modification ou utilisation non autorisée est strictement interdite et pourra faire l'objet de poursuites judiciaires.
                            </p>
                        </section>

                        <section id="cgu">
                            <h2 className="text-2xl font-bold mb-4 text-white">5. Données Personnelles (RGPD / Instances Tunisiennes)</h2>
                            <p className="text-neutral-300 leading-relaxed">
                                Nexus Réussite s'engage à protéger la confidentialité des données de ses utilisateurs (étudiants, parents, institutions). Les données collectées (notamment via les formulaires d'audit ou d'inscription) sont utilisées exclusivement pour l'exécution des services.
                                <br /><br />
                                Conformément à la législation en vigueur, vous disposez d'un droit d'accès, de rectification et de suppression de vos données en nous contactant à : <a href="mailto:dpo@nexusreussite.academy" className="text-brand-accent underline">dpo@nexusreussite.academy</a>.
                            </p>
                        </section>

                    </div>
                </div>
            </main>

            <CorporateFooter />
        </div>
    );
}
