'use client';

import React from 'react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[100]">
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full" />
        <div className="absolute inset-0 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-2xl font-black text-white">N</div>
      </div>
      <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] animate-pulse">
        Synchronisation Nexus...
      </p>
    </div>
  );
};
