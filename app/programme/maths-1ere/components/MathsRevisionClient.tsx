'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from 'lucide-react';
import { useMathsLabStore } from '../store';
import { useProgressionSync } from '../hooks/useProgressionSync';

// Layout & Views
import { Navigation } from './Navigation/Navigation';
import { DashboardView } from './Dashboard/DashboardView';
import { ChapterView } from './Course/ChapterView';
import { QuizEngine } from './Quiz/QuizEngine';
import { FormulaireView } from './FormulaireView';
import { TopBar } from './layout/TopBar';
import { LoadingScreen } from './layout/LoadingScreen';
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
    return <LoadingScreen />;
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
          
          <TopBar 
            activeTab={activeTab}
            streak={store.streak}
            totalXP={store.totalXP}
            onToggleFocus={() => setFocusMode(prev => !prev)}
          />

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
          className="fixed bottom-8 left-8 p-4 bg-cyan-600 text-white rounded-2xl shadow-2xl shadow-cyan-600/40 z-[70] hover:scale-110 transition-transform active:scale-95 animate-in zoom-in duration-300"
        >
          <Menu className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
