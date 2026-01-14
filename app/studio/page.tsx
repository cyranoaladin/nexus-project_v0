import React from 'react';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { Code2, Database, ShieldCheck, Cpu, Layers, GraduationCap } from 'lucide-react';

export default function StudioPage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            <CorporateNavbar />

            {/* Hero Section */}
            <section className="bg-slate-950 text-white py-24">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-sm font-medium mb-6">
                            <Code2 size={16} />
                            <span>Nexus Studio</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
                            L'Ingénierie Éducative <br /> de Pointe.
                        </h1>
                        <p className="text-xl text-slate-400 leading-relaxed">
                            Nous ne nous contentons pas d'utiliser des outils, nous les construisons.
                            Développement sur mesure, architectures robustes et innovation radicale.
                        </p>
                    </div>
                </div>
            </section>

            {/* Tech Stack & Services */}
            <section className="py-24">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        <div className="space-y-4">
                            <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center text-blue-600">
                                <Layers size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900">LMS Sur Mesure</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Oubliez les solutions génériques. Nous développons des plateformes d'apprentissage (LMS) adaptées à votre pédagogie, basées sur **Next.js** et des architectures scalables.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center text-purple-600">
                                <Cpu size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900">Agents IA & RAG</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Intégration de pipelines **Retrieval-Augmented Generation** (RAG) avec Python et LangChain. Vos données institutionnelles deviennent une base de connaissance interactive pour vos étudiants.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-indigo-100 w-12 h-12 rounded-lg flex items-center justify-center text-indigo-600">
                                <ShieldCheck size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900">Blockchain & Identité</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Certification des diplômes on-chain et systèmes de réputation pour les étudiants. Transparence et portabilité des acquis.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why Web3 Section */}
            <section className="py-24 bg-slate-100 border-y border-slate-200">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="flex flex-col lg:flex-row items-center gap-16">
                        <div className="lg:w-1/2">
                            <h2 className="text-4xl font-bold text-slate-900 mb-6">Pourquoi le Web3 dans l'éducation ?</h2>
                            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                                L'avenir de l'éducation passe par la souveraineté des données. Le Web3 permet de redonner aux étudiants le contrôle de leurs accomplissements académiques.
                            </p>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <div className="mt-1 bg-green-100 text-green-600 p-1 rounded">
                                        <Database size={16} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900">Souveraineté des Données</h4>
                                        <p className="text-sm text-slate-500">Les dossiers scolaires ne sont plus enfermés dans des silos propriétaires.</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="mt-1 bg-blue-100 text-blue-600 p-1 rounded">
                                        <GraduationCap size={16} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900">Diplômes Infalsifiables</h4>
                                        <p className="text-sm text-slate-500">Emission de certificats vérifiables instantanément par les employeurs.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                        <div className="lg:w-1/2 bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
                            <pre className="text-xs font-mono bg-slate-900 text-slate-50 p-6 rounded-lg overflow-x-auto">
                                {`// Exemple de Smart Contract : Certification
contract NexusDegree {
    struct Degree {
        address student;
        string courseId;
        uint256 timestamp;
        string ipfsHash;
    }

    mapping(uint256 => Degree) public degrees;

    function issueDegree(address _student, string memory _courseId) public onlyAdmin {
        // Minting logic securing the degree on-chain
        emit DegreeIssued(_student, _courseId);
    }
}`}
                            </pre>
                            <div className="mt-4 text-center text-sm text-slate-500 italic">
                                Nos ingénieurs codent l'avenir de la certification académique (Solidity / Rust).
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <CorporateFooter />
        </div>
    );
}
