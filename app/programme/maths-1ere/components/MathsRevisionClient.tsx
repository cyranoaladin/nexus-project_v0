'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Target, 
  ChevronRight, 
  Bell, 
  Search,
  Command,
  HelpCircle,
  Menu,
  X
} from 'lucide-react';
import { useMathsLabStore } from '../store';
import { useProgressionSync } from '../hooks/useProgressionSync';
import { Navigation } from './Navigation/Navigation';
import { DashboardView } from './Dashboard/DashboardView';
import { ChapterView } from './Course/ChapterView';
import { QuizEngine } from './Quiz/QuizEngine';
import { FormulaireView } from './FormulaireView';
import { Toaster, toast } from 'sonner';

interface MathsRevisionClientProps {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
  };
}

export default function MathsRevisionClient({ user }: MathsRevisionClientProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cours' | 'entrainement' | 'formulaire'>('dashboard');
  const [activeCat, setActiveCat] = useState('algebre');
  const [activeChap, setActiveChap] = useState('second-degre');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  
  const { isHydrating, syncError } = useProgressionSync(user.id);
  const store = useMathsLabStore();

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Trigger search focus in Navigation component would be better
        // but for now let's just show a toast as a placeholder for global search
        toast.info("Recherche globale bientôt disponible !");
      }
      if (e.key === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setFocusMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Show sync errors
  useEffect(() => {
    if (syncError) {
      toast.warning(syncError, { duration: 5000 });
    }
  }, [syncError]);

  if (isHydrating) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[100]">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-black text-white">N</div>
        </div>
        <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] animate-pulse">Synchronisation Nexus...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      <Toaster theme="dark" position="bottom-right" richColors />
      
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeCat={activeCat}
        setActiveCat={setActiveCat}
        activeChap={activeChap}
        setActiveChap={setActiveChap}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      <main className={`transition-all duration-500 ease-in-out min-h-screen ${focusMode ? 'lg:pl-0' : 'lg:pl-80'} pt-16 lg:pt-0`}>
        <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-8 lg:py-12">
          
          {/* Top Bar / Stats Header */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/50" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{activeTab}</span>
                <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-800 text-[8px] font-bold text-slate-500 border border-slate-700">V2.0-KATEX</span>
              </div>
              <div className="hidden sm:flex items-center gap-4 border-l border-slate-800 pl-6">
                <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800">
                  <Zap className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-xs font-bold text-white">{store.streak}j</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800">
                  <Target className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-xs font-bold text-white">{store.totalXP} XP</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-white hover:border-slate-700 transition-all">
                <Bell className="h-4 w-4" />
              </button>
              <button className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 hover:text-white hover:border-slate-700 transition-all">
                <HelpCircle className="h-4 w-4" />
              </button>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-600">
                <Command className="h-3 w-3" /> F
                <span className="ml-1 opacity-60">Focus Mode</span>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (activeTab === 'cours' ? activeChap : '')}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            >
              {activeTab === 'dashboard' && <DashboardView onSwitchTab={setActiveTab} />}
              {activeTab === 'cours' && (
                <ChapterView 
                  catKey={activeCat} 
                  chapId={activeChap} 
                  focusMode={focusMode}
                  onToggleFocus={() => setFocusMode(!focusMode)}
                />
              )}
              {activeTab === 'entrainement' && <QuizEngine onSwitchTab={setActiveTab} />}
              {activeTab === 'formulaire' && <FormulaireView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Focus Mode Toggle (Floating if in focus mode) */}
      {focusMode && (
        <button 
          onClick={() => setFocusMode(false)}
          className="fixed bottom-8 left-8 p-4 bg-cyan-600 text-white rounded-2xl shadow-2xl shadow-cyan-600/40 z-[70] hover:scale-110 transition-transform active:scale-95"
        >
          <Menu className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
