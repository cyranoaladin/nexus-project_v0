'use client';

import React from 'react';
import { 
  BookOpen, 
  Wrench, 
  AlertTriangle, 
  Lightbulb, 
  GraduationCap
} from 'lucide-react';
import { type Chapitre } from '../../../data';
import { MathInline, MathBlock, MathRichText } from '../../MathContent';

interface ChapterCourseProps {
  chap: Chapitre;
}

export const ChapterCourse: React.FC<ChapterCourseProps> = ({ chap }) => {
  return (
    <div className="space-y-10">
      {/* L'Essentiel */}
      <section className="bg-slate-900/30 border border-slate-700/30 rounded-3xl p-8 transition-colors hover:border-cyan-500/20">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-cyan-400" />
          </div>
          L&apos;essentiel du cours
        </h3>
        <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed text-lg">
          <MathRichText content={chap.contenu.rappel} />
        </div>
      </section>

      {/* Méthode & Formules */}
      <section className="bg-blue-900/10 border border-blue-500/20 rounded-3xl p-8">
        <h3 className="text-xl font-bold text-blue-300 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Wrench className="h-5 w-5 text-blue-400" />
          </div>
          Méthodes & Formules
        </h3>
        <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-700/50">
          <MathBlock math={chap.contenu.methode} />
        </div>
        
        {/* Formules Table */}
        {chap.contenu.tableau && chap.contenu.tableau.length > 0 && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-700/30 bg-slate-900/20">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-800/50 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-700/30">
                  <th className="px-6 py-4">Fonction</th>
                  <th className="px-6 py-4">Dérivée / Propriété</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {chap.contenu.tableau.map((row, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-white font-mono text-sm"><MathRichText content={row.f} /></td>
                    <td className="px-6 py-4 text-cyan-400 font-mono text-sm"><MathRichText content={row.derivee} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cas Table */}
        {chap.contenu.cas && chap.contenu.cas.length > 0 && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-700/30 bg-slate-900/20">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-800/50 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-700/30">
                  <th className="px-6 py-4">Condition</th>
                  <th className="px-6 py-4">Conclusion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {chap.contenu.cas.map((row, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-white font-mono text-sm"><MathInline math={row.delta} /></td>
                    <td className="px-6 py-4 text-slate-300 text-sm"><MathRichText content={row.solution} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Erreurs Classiques & Astuces */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {chap.contenu.erreursClassiques && chap.contenu.erreursClassiques.length > 0 && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-8">
            <h3 className="text-lg font-bold text-red-400 mb-6 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              Erreurs Classiques
            </h3>
            <ul className="space-y-4">
              {chap.contenu.erreursClassiques.map((err, i) => (
                <li key={i} className="flex gap-3 text-slate-300 text-sm">
                  <span className="text-red-500 mt-1 font-bold">✕</span>
                  <MathRichText content={err} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-8">
          <h3 className="text-lg font-bold text-amber-400 mb-6 flex items-center gap-3">
            <Lightbulb className="h-5 w-5" />
            Astuce du prof
          </h3>
          <div className="prose prose-invert text-slate-300 text-sm italic">
            <MathRichText content={chap.contenu.astuce} />
          </div>
        </div>
      </div>

      {/* Methodologie Bac */}
      {chap.contenu.methodologieBac && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-8">
          <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-3">
            <GraduationCap className="h-6 w-6" />
            Méthodologie Bac
          </h3>
          <div className="text-slate-300 text-sm leading-relaxed">
            <MathRichText content={chap.contenu.methodologieBac} />
          </div>
        </div>
      )}
    </div>
  );
};
