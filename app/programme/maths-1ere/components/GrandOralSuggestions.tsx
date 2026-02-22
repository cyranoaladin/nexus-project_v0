'use client';
import { useState } from 'react';
import { useMathsLabStore } from '../store';

const GRAND_ORAL_BY_CHAP: Record<string, { sujet: string; accroche: string; lien: string }[]> = {
  suites: [
    { sujet: 'La suite de Fibonacci dans la nature', accroche: 'Pourquoi certaines spirales biologiques suivent Fibonacci ?', lien: 'Modélisation - Suites - Géométrie' },
    { sujet: "Remboursement d'un emprunt", accroche: 'Comment modéliser des mensualités avec des suites ?', lien: 'Suites - Économie' },
  ],
  exponentielle: [
    { sujet: 'La décroissance radioactive', accroche: 'Comment dater avec la décroissance exponentielle ?', lien: 'Exponentielle - Sciences' },
    { sujet: 'La croissance bactérienne', accroche: 'Pourquoi les populations croissent exponentiellement au début ?', lien: 'Exponentielle - Biologie' },
  ],
  'probabilites-cond': [
    { sujet: 'Faux positifs en médecine', accroche: 'Comment interpréter un test de dépistage ?', lien: 'Proba cond. - Santé' },
    { sujet: 'Paradoxe de Monty Hall', accroche: 'Pourquoi changer de porte est rationnel ?', lien: 'Proba - Intuition' },
  ],
  trigonometrie: [
    { sujet: 'Musique et sinusoïdes', accroche: 'Pourquoi les sons purs sont-ils des sinusoïdes ?', lien: 'Trigonométrie - Physique' },
    { sujet: 'Archimède et π', accroche: 'Comment approcher π sans calculatrice moderne ?', lien: 'Trigonométrie - Histoire' },
  ],
  derivation: [
    { sujet: 'Optimisation économique', accroche: 'Comment maximiser une fonction de profit ?', lien: 'Dérivation - SES' },
    { sujet: 'Vitesse instantanée', accroche: 'Pourquoi la dérivée modélise la vitesse ?', lien: 'Dérivation - Physique' },
  ],
  'second-degre': [
    { sujet: 'Balistique et parabole', accroche: 'Pourquoi les trajectoires sont paraboliques ?', lien: 'Second degré - Physique' },
  ],
  'variables-aleatoires': [
    { sujet: 'Paradoxe de Saint-Pétersbourg', accroche: "Pourquoi une espérance infinie n'attire pas toujours ?", lien: 'Variables aléatoires - Économie' },
  ],
};

export default function GrandOralSuggestions({ chapId }: { chapId: string }) {
  const [expanded, setExpanded] = useState(false);
  const suggestions = GRAND_ORAL_BY_CHAP[chapId];
  const store = useMathsLabStore();
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-purple-900/15 to-slate-900 border border-purple-500/20 rounded-2xl overflow-hidden">
      <button onClick={() => {
        const next = !expanded;
        setExpanded(next);
        if (next) {
          store.addXP(2);
          store.trackGrandOralView(suggestions.length);
          if (suggestions.length >= 3) store.earnBadge('grand-oral-ready');
        }
      }} className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors" aria-label="Afficher les suggestions Grand Oral">
        <div className="flex items-center gap-2"><span className="text-lg">🎤</span><span className="font-bold text-purple-300 text-sm">Idées pour le Grand Oral</span><span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full">{suggestions.length} sujet{suggestions.length > 1 ? 's' : ''}</span></div>
        <span className="text-slate-500 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="p-4 pt-0 space-y-3">
          {suggestions.map((s, i) => (
            <div key={s.sujet} className="bg-slate-800/50 rounded-xl p-4 border border-purple-500/10">
              <h4 className="font-bold text-white text-sm mb-1">💡 {s.sujet}</h4>
              <p className="text-slate-300 text-xs mb-2">{s.accroche}</p>
              <div className="flex flex-wrap gap-1">{s.lien.split(' - ').map((tag, j) => <span key={`${tag}-${j}`} className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded-full">{tag}</span>)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
