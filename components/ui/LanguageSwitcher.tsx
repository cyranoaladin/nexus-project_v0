"use client";

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-2 text-xs font-bold border border-slate-700 rounded-full p-1 bg-slate-900/50 backdrop-blur-sm">
      <button
        onClick={() => setLanguage('fr')}
        className={`px-3 py-1 rounded-full transition-all ${
          language === 'fr'
            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        FR
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1 rounded-full transition-all ${
          language === 'en'
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20'
            : 'text-slate-400 hover:text-white'
        }`}
      >
        EN
      </button>
    </div>
  );
}
