import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function BilanParentPreview({ bilanText }: { bilanText: string }) {
  if (!bilanText) return (
    <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
      Aucune synthèse générée pour le moment.
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12 w-full max-w-4xl mx-auto my-8">
      
      <div className="flex justify-between items-start mb-10 pb-6 border-b border-gray-100">
        <img 
          src="/images/logo_slogan_nexus.png" 
          alt="Nexus Réussite - L'accompagnement d'excellence" 
          className="h-14 w-auto object-contain" 
        />
        <span className="px-4 py-1.5 bg-amber-50 text-amber-700 text-sm font-semibold rounded-full border border-amber-200 flex items-center gap-2 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Confidentiel
        </span>
      </div>

      
      <div className="prose prose-slate max-w-none w-full break-words whitespace-pre-wrap prose-headings:text-indigo-900 prose-headings:font-bold prose-headings:mt-8 prose-headings:mb-4 prose-strong:text-indigo-800 prose-hr:border-indigo-100 prose-ul:list-disc prose-ul:pl-5 prose-li:my-1">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {bilanText}
        </ReactMarkdown>
      </div>

      
      <div className="mt-12 pt-6 border-t border-gray-100 text-center text-sm text-gray-400">
        Ce document a été rédigé par l'équipe pédagogique Nexus Réussite.<br/>
        Strictement confidentiel et à usage exclusif des parents de l'élève.
      </div>
    </div>
  );
}
