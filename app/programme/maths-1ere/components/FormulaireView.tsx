'use client';
import { useEffect, useState } from 'react';
import { useMathJax } from './MathJaxProvider';
import { useMathsLabStore } from '../store';

type FormulaSection = { id: string; titre: string; formules: { nom: string; f: string; fp: string }[] };

const sections: FormulaSection[] = [
  {
    id: 'derivation',
    titre: '📐 Dérivation',
    formules: [
      { nom: 'Constante', f: '$k$', fp: '$0$' },
      { nom: 'Puissance', f: '$x^n$', fp: '$nx^{n-1}$' },
      { nom: 'Inverse', f: '$\\frac{1}{x}$', fp: '$-\\frac{1}{x^2}$' },
      { nom: 'Racine', f: '$\\sqrt{x}$', fp: '$\\frac{1}{2\\sqrt{x}}$' },
      { nom: 'Exponentielle', f: '$e^x$', fp: '$e^x$' },
      { nom: 'Sinus', f: '$\\sin(x)$', fp: '$\\cos(x)$' },
      { nom: 'Cosinus', f: '$\\cos(x)$', fp: '$-\\sin(x)$' },
      { nom: 'Somme', f: '$u+v$', fp: "$u'+v'$" },
      { nom: 'Produit', f: '$uv$', fp: "$u'v+uv'$" },
      { nom: 'Quotient', f: '$\\frac{u}{v}$', fp: "$\\frac{u'v-uv'}{v^2}$" },
      { nom: 'Composée affine', f: '$f(ax+b)$', fp: "$af'(ax+b)$" },
    ],
  },
  {
    id: 'suites',
    titre: '📈 Suites',
    formules: [
      { nom: 'Terme général arith.', f: '$u_n = u_0 + nr$', fp: 'raison $r$' },
      { nom: 'Somme arith.', f: '$\\sum_{k=0}^n k = \\frac{n(n+1)}{2}$', fp: '' },
      { nom: 'Terme général géom.', f: '$u_n = u_0 \\times q^n$', fp: 'raison $q$' },
      { nom: 'Somme géom.', f: '$\\sum_{k=0}^n q^k = \\frac{1-q^{n+1}}{1-q}$', fp: '$q \\neq 1$' },
      { nom: 'Fibonacci', f: '$F_{n+2} = F_{n+1} + F_n$', fp: '$F_0=0, F_1=1$' },
    ],
  },
  {
    id: 'second-degre',
    titre: '📉 Second Degré',
    formules: [
      { nom: 'Discriminant', f: '$\\Delta = b^2 - 4ac$', fp: '' },
      { nom: 'Racines', f: '$x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$', fp: '$\\Delta > 0$' },
      { nom: 'Forme canonique', f: '$a(x-\\alpha)^2 + \\beta$', fp: '$\\alpha = -b/2a$' },
      { nom: 'Somme des racines', f: '$x_1 + x_2 = -b/a$', fp: '' },
      { nom: 'Produit des racines', f: '$x_1 \\times x_2 = c/a$', fp: '' },
    ],
  },
  {
    id: 'trigo',
    titre: '🔄 Trigonométrie',
    formules: [
      { nom: 'Relation fondamentale', f: '$\\cos^2(x) + \\sin^2(x) = 1$', fp: '' },
      { nom: 'Parité', f: '$\\cos(-x) = \\cos(x)$', fp: '$\\sin(-x)=-\\sin(x)$' },
      { nom: 'Périodicité', f: '$\\cos(x+2\\pi) = \\cos(x)$', fp: '$\\sin(x+2\\pi)=\\sin(x)$' },
      { nom: '$\\pi/6$', f: '$\\cos = \\sqrt{3}/2$', fp: '$\\sin = 1/2$' },
      { nom: '$\\pi/4$', f: '$\\cos = \\sqrt{2}/2$', fp: '$\\sin = \\sqrt{2}/2$' },
      { nom: '$\\pi/3$', f: '$\\cos = 1/2$', fp: '$\\sin = \\sqrt{3}/2$' },
    ],
  },
  {
    id: 'proba',
    titre: '🎲 Probabilités',
    formules: [
      { nom: 'Probas cond.', f: '$P_A(B) = \\frac{P(A \\cap B)}{P(A)}$', fp: '' },
      { nom: 'Probas totales', f: '$P(B)=P(A)P_A(B)+P(\\bar{A})P_{\\bar{A}}(B)$', fp: '' },
      { nom: 'Indépendance', f: '$P(A \\cap B)=P(A)P(B)$', fp: '' },
      { nom: 'Espérance', f: '$E(X)=\\sum x_iP(X=x_i)$', fp: '' },
      { nom: 'Variance', f: '$V(X)=E(X^2)-[E(X)]^2$', fp: '' },
      { nom: 'Écart-type', f: '$\\sigma(X)=\\sqrt{V(X)}$', fp: '' },
    ],
  },
  {
    id: 'geo',
    titre: '📐 Géométrie',
    formules: [
      { nom: 'Produit scalaire', f: '$\\vec{u}\\cdot\\vec{v}=xx\'+yy\'$', fp: '$\\vec{u}(x;y),\\vec{v}(x\';y\')$' },
      { nom: 'Norme', f: '$||\\vec{u}||=\\sqrt{x^2+y^2}$', fp: '' },
      { nom: 'Al-Kashi', f: '$a^2=b^2+c^2-2bc\\cos(A)$', fp: '' },
      { nom: 'Orthogonalité', f: '$\\vec{u}\\perp\\vec{v} \\iff \\vec{u}\\cdot\\vec{v}=0$', fp: '' },
      { nom: 'Vecteur normal', f: '$ax+by+c=0 \\Rightarrow \\vec{n}(a;b)$', fp: '' },
      { nom: 'Cercle', f: '$(x-a)^2+(y-b)^2=r^2$', fp: 'centre $\\Omega(a;b)$' },
    ],
  },
];

export default function FormulaireView() {
  const [activeSection, setActiveSection] = useState('derivation');
  const markFormulaireViewed = useMathsLabStore((s) => s.markFormulaireViewed);
  const earnBadge = useMathsLabStore((s) => s.earnBadge);
  useMathJax([activeSection]);

  useEffect(() => {
    markFormulaireViewed();
    earnBadge('formulaire');
  }, [markFormulaireViewed, earnBadge]);

  const currentSection = sections.find((s) => s.id === activeSection) || sections[0];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Formulaire de Première</h2>
        <p className="text-slate-400">Toutes les formules essentielles du programme officiel.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {sections.map((s) => (
          <button key={s.id} onClick={() => {
            setActiveSection(s.id);
            markFormulaireViewed();
          }} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeSection === s.id ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400' : 'bg-slate-800/50 text-slate-300 hover:text-white border border-transparent'}`} aria-label={`Afficher section ${s.titre}`}>
            {s.titre}
          </button>
        ))}
      </div>

      <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/10 rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-slate-700/30"><h3 className="font-bold text-white">{currentSection.titre}</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-slate-700/30"><th className="text-left p-4 font-medium">Notation</th><th className="text-left p-4 font-medium">Formule</th><th className="text-left p-4 font-medium">Remarque</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {currentSection.formules.map((row, i) => (
                <tr key={`${row.nom}-${i}`} className="hover:bg-slate-700/20 transition-colors">
                  <td className="p-4 text-slate-300 font-medium text-xs">{row.nom}</td>
                  <td className="p-4 text-cyan-300 font-mono text-sm">{row.f}</td>
                  <td className="p-4 text-slate-400 text-xs">{row.fp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-center mt-4">
        <button onClick={() => {
          window.print();
          earnBadge('imprimeur');
        }} className="text-sm px-6 py-2 rounded-xl bg-slate-700 text-slate-300 hover:bg-slate-600 flex items-center gap-2 mx-auto print:hidden" aria-label="Imprimer le formulaire">
          🖨️ Imprimer le formulaire
        </button>
      </div>
    </div>
  );
}
