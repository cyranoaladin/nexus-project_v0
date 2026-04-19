'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from 'lucide-react';
import { useMathsLabStore } from '../store';
import { useProgressionSync } from '../hooks/useProgressionSync';

// Layout & Views
import { Navigation } from './Navigation/Navigation';
import { CockpitView } from './Cockpit/CockpitView';
import { ChapterView } from './Course/ChapterView';
import { ExamenBlancView } from './Examen/ExamenBlancView';
import { TeacherView } from './Enseignant/TeacherView';
import { BilanView } from './Bilan/BilanView';
import { TopBar } from './layout/TopBar';
import { LoadingScreen } from './layout/LoadingScreen';
import { Toaster, toast } from 'sonner';

export type ActiveTab = 'cockpit' | 'cours' | 'examen' | 'enseignant' | 'bilan';

interface MathsRevisionClientProps {
  user: {
    id: string;
    name?: string | null;
    role?: string | null;
  };
}

const TEACHER_ROLES = new Set(['COACH', 'ADMIN', 'ASSISTANTE']);

export default function MathsRevisionClient({ user }: MathsRevisionClientProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('cockpit');
  const [activeCat, setActiveCat] = useState('algebre');
  const [activeChap, setActiveChap] = useState('second-degre');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const isTeacher = TEACHER_ROLES.has(user.role ?? '');
  const displayName = user.name ?? 'Élève';

  const { isHydrating, syncError } = useProgressionSync(user.id);
  const store = useMathsLabStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toast.info('Recherche globale bientôt disponible !');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setFocusMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (syncError) {
      toast.warning(syncError, { duration: 5000 });
    }
  }, [syncError]);

  if (isHydrating) {
    return <LoadingScreen />;
  }

  const handleNavigateToChap = (catKey: string, chapId: string) => {
    setActiveCat(catKey);
    setActiveChap(chapId);
    setActiveTab('cours');
  };

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
        isTeacher={isTeacher}
      />

      <main
        className={`transition-all duration-500 ease-in-out min-h-screen ${
          focusMode ? 'lg:pl-0' : 'lg:pl-80'
        } pt-16 lg:pt-0`}
      >
        <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-8 lg:py-12">
          <TopBar
            activeTab={activeTab}
            streak={store.streak}
            totalXP={store.totalXP}
            onToggleFocus={() => setFocusMode((prev) => !prev)}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (activeTab === 'cours' ? activeChap : '')}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            >
              {activeTab === 'cockpit' && (
                <CockpitView
                  displayName={displayName}
                  onSwitchTab={setActiveTab}
                  onNavigateToChap={handleNavigateToChap}
                />
              )}

              {activeTab === 'cours' && (
                <ChapterView
                  catKey={activeCat}
                  chapId={activeChap}
                  focusMode={focusMode}
                  onToggleFocus={() => setFocusMode(!focusMode)}
                />
              )}

              {activeTab === 'examen' && <ExamenBlancView />}

              {activeTab === 'enseignant' && isTeacher && (
                <TeacherView studentName={displayName} />
              )}

              {activeTab === 'enseignant' && !isTeacher && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="text-4xl mb-4">🔒</div>
                  <h2 className="text-xl font-bold text-white mb-2">Accès réservé aux encadrants</h2>
                  <p className="text-slate-400 text-sm max-w-md">
                    Cette vue est réservée aux enseignants, coaches et responsables pédagogiques Nexus.
                  </p>
                </div>
              )}

              {activeTab === 'bilan' && (
                <BilanView displayName={displayName} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Focus Mode Toggle */}
      {focusMode && (
        <button
          onClick={() => setFocusMode(false)}
          className="fixed bottom-8 left-8 p-4 bg-cyan-600 text-white rounded-2xl shadow-2xl shadow-cyan-600/40 z-[70] hover:scale-110 transition-transform active:scale-95 animate-in zoom-in duration-300"
          aria-label="Quitter le mode focus"
        >
          <Menu className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
