'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { useMathsLabStore } from '../store';
import { resolveUiIcon } from '@/lib/ui-icons';
import { MathInline } from './MathContent';

type FormulaSection = { 
  id: string; 
  titre: string; 
  icon: string; 
  formules: { nom: string; f: string; fp: string }[] 
};

const sections: FormulaSection[] = [
  {
    id: 'derivation',
    titre: 'Dérivation',
    icon: 'sigma',
    formules: [
      { nom: 'Constante', f: 'k', fp: '0' },
      { nom: 'Puissance', f: 'x^n', fp: 'nx^{n-1}' },
      { nom: 'Inverse', f: '\\frac{1}{x}', fp: '-\\frac{1}{x^2}' },
      { nom: 'Racine', f: '\\sqrt{x}', fp: '\\frac{1}{2\\sqrt{x}}' },
      { nom: 'Exponentielle', f: 'e^x', fp: 'e^x' },
      { nom: 'Sinus', f: '\\sin(x)', fp: '\\cos(x)' },
      { nom: 'Cosinus', f: '\\cos(x)', fp: '-\\sin(x)' },
      { nom: 'Somme', f: 'u+v', fp: "u'+v'" },
      { nom: 'Produit', f: 'uv', fp: "u'v+uv'" },
      { nom: 'Quotient', f: '\\frac{u}{v}', fp: "\\frac{u'v-uv'}{v^2}" },
      { nom: 'Composée affine', f: 'f(ax+b)', fp: "af'(ax+b)" },
    ],
  },
  {
    id: 'suites',
    titre: 'Suites',
    icon: 'trendingUp',
    formules: [
      { nom: 'Terme général arith.', f: 'u_n = u_0 + nr', fp: 'raison r' },
      { nom: 'Somme arith.', f: '\\sum_{k=0}^n k = \\frac{n(n+1)}{2}', fp: '' },
      { nom: 'Terme général géom.', f: 'u_n = u_0 \\times q^n', fp: 'raison q' },
      { nom: 'Somme géom.', f: '\\sum_{k=0}^n q^k = \\frac{1-q^{n+1}}{1-q}', fp: 'q \\neq 1' },
      { nom: 'Fibonacci', f: 'F_{n+2} = F_{n+1} + F_n', fp: 'F_0=0, F_1=1' },
    ],
  },
  {
    id: 'second-degre',
    titre: 'Second Degré',
    icon: 'trendingDown',
    formules: [
      { nom: 'Discriminant', f: '\\Delta = b^2 - 4ac', fp: '' },
      { nom: 'Racines', f: 'x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}', fp: '\\Delta > 0' },
      { nom: 'Forme canonique', f: 'a(x-\\alpha)^2 + \\beta', fp: '\\alpha = -b/2a' },
      { nom: 'Somme des racines', f: 'x_1 + x_2 = -b/a', fp: '' },
      { nom: 'Produit des racines', f: 'x_1 \\times x_2 = c/a', fp: '' },
    ],
  },
  {
    id: 'trigo',
    titre: 'Trigonométrie',
    icon: 'sparkles',
    formules: [
      { nom: 'Relation fondamentale', f: '\\cos^2(x) + \\sin^2(x) = 1', fp: '' },
      { nom: 'Parité', f: '\\cos(-x) = \\cos(x)', fp: '\\sin(-x)=-\\sin(x)' },
      { nom: 'Périodicité', f: '\\cos(x+2\\pi) = \\cos(x)', fp: '\\sin(x+2\\pi)=\\sin(x)' },
      { nom: 'Valeur Pi/6', f: '\\cos = \\sqrt{3}/2', fp: '\\sin = 1/2' },
      { nom: 'Valeur Pi/4', f: '\\cos = \\sqrt{2}/2', fp: '\\sin = \\sqrt{2}/2' },
      { nom: 'Valeur Pi/3', f: '\\cos = 1/2', fp: '\\sin = \\sqrt{3}/2' },
    ],
  },
  {
    id: 'proba',
    titre: 'Probabilités',
    icon: 'barChart',
    formules: [
      { nom: 'Probas cond.', f: 'P_A(B) = \\frac{P(A \\cap B)}{P(A)}', fp: '' },
      { nom: 'Probas totales', f: 'P(B)=P(A)P_A(B)+P(\\bar{A})P_{\\bar{A}}(B)', fp: '' },
      { nom: 'Indépendance', f: 'P(A \\cap B)=P(A)P(B)', fp: '' },
      { nom: 'Espérance', f: 'E(X)=\\sum x_iP(X=x_i)', fp: '' },
      { nom: 'Variance', f: 'V(X)=E(X^2)-[E(X)]^2', fp: '' },
      { nom: 'Écart-type', f: '\\sigma(X)=\\sqrt{V(X)}', fp: '' },
    ],
  },
  {
    id: 'geo',
    titre: 'Géométrie',
    icon: 'sigma',
    formules: [
      { nom: 'Produit scalaire', f: '\\vec{u}\\cdot\\vec{v}=xx\'+yy\'', fp: '\\vec{u}(x;y),\\vec{v}(x\';y\')' },
      { nom: 'Norme', f: '||\\vec{u}||=\\sqrt{x^2+y^2}', fp: '' },
      { nom: 'Al-Kashi', f: 'a^2=b^2+c^2-2bc\\cos(A)', fp: '' },
      { nom: 'Orthogonalité', f: '\\vec{u}\\perp\\vec{v} \\iff \\vec{u}\\cdot\\vec{v}=0', fp: '' },
      { nom: 'Vecteur normal', f: 'ax+by+c=0 \\Rightarrow \\vec{n}(a;b)', fp: '' },
      { nom: 'Cercle', f: '(x-a)^2+(y-b)^2=r^2', fp: 'centre \\Omega(a;b)' },
    ],
  },
];

export function FormulaireView() {
  const [activeSection, setActiveSection] = useState('derivation');
  const markFormulaireViewed = useMathsLabStore((s) => s.markFormulaireViewed);
  const earnBadge = useMathsLabStore((s) => s.earnBadge);

  useEffect(() => {
    markFormulaireViewed();
    earnBadge('formulaire');
  }, [markFormulaireViewed, earnBadge]);

  const currentSection = sections.find((s) => s.id === activeSection) || sections[0];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-0">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">Formulaire de Première</h2>
        <p className="text-slate-400 text-lg">Toutes les formules essentielles du programme officiel 2025-2026.</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3 mb-10">
        {sections.map((s) => {
          const SectionIcon = resolveUiIcon(s.icon);
          const isActive = activeSection === s.id;
          return (
            <button 
              key={s.id} 
              onClick={() => setActiveSection(s.id)} 
              className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-3 border ${
                isActive 
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-lg shadow-cyan-500/10' 
                : 'bg-slate-800/50 text-slate-400 hover:text-white border-slate-700/50 hover:bg-slate-800'
              }`}
            >
              <SectionIcon className="h-4 w-4" />
              {s.titre}
            </button>
          );
        })}
      </div>

      <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/30 rounded-[2rem] overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-slate-700/30 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
              {(() => { const Icon = resolveUiIcon(currentSection.icon); return <Icon className="h-5 w-5 text-cyan-400" />; })()}
            </div>
            {currentSection.titre}
          </h3>
          <button 
            onClick={() => window.print()} 
            className="p-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all print:hidden"
          >
            <Printer className="h-5 w-5" />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                <th className="px-8 py-5">Notation / Concept</th>
                <th className="px-8 py-5">Formule KaTeX</th>
                <th className="px-8 py-5">Remarque / Condition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {currentSection.formules.map((row, i) => (
                <tr key={`${row.nom}-${i}`} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-8 py-6">
                    <div className="text-sm font-bold text-white mb-1">{row.nom}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-cyan-400 text-lg">
                      <MathInline math={row.f} />
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-sm text-slate-400 font-medium italic">
                      <MathInline math={row.fp} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-12 text-center pb-8">
        <p className="text-slate-500 text-sm mb-6">Nexus Réussite — Outil de révision certifié conforme au B.O.</p>
        <button 
          onClick={() => {
            window.print();
            earnBadge('imprimeur');
          }} 
          className="bg-slate-800 text-white font-bold py-4 px-10 rounded-2xl hover:bg-slate-700 transition-all border border-slate-700 inline-flex items-center gap-3 shadow-xl print:hidden"
        >
          <Printer className="h-5 w-5" />
          Générer ma fiche mémo PDF
        </button>
      </div>
    </div>
  );
}
