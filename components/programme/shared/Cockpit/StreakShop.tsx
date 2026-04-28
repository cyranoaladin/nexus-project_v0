'use client';

import React from 'react';
import { Snowflake } from 'lucide-react';

interface StreakShopProps {
  store: {
    streakFreezes: number;
    totalXP: number;
    buyStreakFreeze: () => void;
  };
}

export const StreakShop: React.FC<StreakShopProps> = ({ store }) => (
  <div className="rounded-3xl border border-slate-700/30 bg-slate-800/30 p-6">
    <div className="flex items-center gap-3 mb-4">
      <div className="rounded-lg bg-blue-500/10 p-2">
        <Snowflake className="h-4 w-4 text-blue-300" />
      </div>
      <div>
        <h3 className="font-bold text-white">Boutique Série</h3>
        <p className="text-[10px] text-slate-500">{store.streakFreezes} gel(s) disponible(s)</p>
      </div>
    </div>
    <p className="text-xs text-slate-400 mb-4">
      Protège ta série si tu ne peux pas te connecter. Indispensable pour maintenir ton rythme !
    </p>
    <div className="flex items-center justify-between">
      <div className="text-xs text-slate-500">
        Coût : <span className="font-bold text-slate-300">100 XP</span>
        <br />
        <span className="text-[10px]">Solde : {store.totalXP} XP</span>
      </div>
      <button
        onClick={() => store.buyStreakFreeze()}
        disabled={store.totalXP < 100}
        className={`rounded-xl px-5 py-2.5 font-bold text-sm transition-all ${
          store.totalXP >= 100
            ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/10'
            : 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed'
        }`}
      >
        Acheter
      </button>
    </div>
  </div>
);
