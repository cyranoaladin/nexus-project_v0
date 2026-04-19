'use client';

import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Target, 
  Calculator, 
  ChevronRight, 
  ChevronDown,
  Menu,
  X,
  Search,
  Command
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { programmeData } from '../../data';
import { useMathsLabStore } from '../../store';
import { resolveUiIcon } from '@/lib/ui-icons';

interface NavigationProps {
  activeTab: 'cockpit' | 'cours' | 'examen' | 'enseignant' | 'bilan';
  setActiveTab: (tab: 'cockpit' | 'cours' | 'examen' | 'enseignant' | 'bilan') => void;
  activeCat: string;
  setActiveCat: (cat: string) => void;
  activeChap: string;
  setActiveChap: (chap: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isTeacher: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  activeCat,
  setActiveCat,
  activeChap,
  setActiveChap,
  isSidebarOpen,
  setIsSidebarOpen,
  isTeacher,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCats, setExpandedCats] = useState<string[]>(['geometrie', 'analyse']); // Defaults
  const store = useMathsLabStore();

  const toggleCat = (key: string) => {
    setExpandedCats(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const navItems = [
    { id: 'cockpit', label: 'Cockpit Pédagogique', icon: LayoutDashboard },
    { id: 'cours', label: 'Programme & Cours', icon: BookOpen },
    { id: 'examen', label: 'Objectif Épreuve', icon: Target },
    { id: 'bilan', label: 'Mon Plan Final', icon: Calculator },
  ];

  if (isTeacher) {
    navItems.push({ id: 'enseignant', label: 'Pilotage Enseignant', icon: Command });
  }

  const filteredData = Object.entries(programmeData).filter(([key, cat]) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return cat.titre.toLowerCase().includes(q) || 
           cat.chapitres.some(c => c.titre.toLowerCase().includes(q));
  });

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center font-bold text-white">N</div>
          <span className="font-bold text-white tracking-tight">Nexus Maths</span>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400 hover:text-white">
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Sidebar / Desktop Navigation */}
      <aside className={`fixed inset-y-0 left-0 w-80 bg-slate-950 border-r border-slate-800/60 z-[60] transform transition-transform duration-500 ease-in-out lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-600/20">
                <span className="font-black text-white text-xl">N</span>
              </div>
              <div>
                <h1 className="font-bold text-white tracking-tight">Nexus Maths</h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Spécialité Première</p>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-500 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Rechercher..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-slate-700 font-bold px-1.5 py-0.5 rounded border border-slate-800 bg-slate-950">
              <Command className="h-2.5 w-2.5" /> K
            </div>
          </div>

          {/* Main Tabs */}
          <nav className="space-y-1 mb-8">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium text-sm ${
                  activeTab === item.id 
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                }`}
              >
                <item.icon className={`h-4 w-4 ${activeTab === item.id ? 'text-cyan-400' : 'text-slate-500'}`} />
                {item.label}
              </button>
            ))}
          </nav>

          {/* Course Tree */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4 px-4">Le Programme</div>
            <div className="space-y-4">
              {filteredData.map(([key, cat]) => {
                const isExpanded = expandedCats.includes(key);
                const Icon = resolveUiIcon(cat.icon);
                return (
                  <div key={key} className="space-y-1">
                    <button 
                      onClick={() => toggleCat(key)}
                      className="w-full flex items-center justify-between px-4 py-2 text-slate-500 hover:text-slate-300 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 transition-colors ${isExpanded ? 'text-cyan-400' : 'group-hover:text-slate-400'}`} />
                        <span className={`text-xs font-bold uppercase tracking-wider ${isExpanded ? 'text-white' : ''}`}>{cat.titre}</span>
                      </div>
                      <ChevronRight className={`h-3 w-3 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-cyan-400' : ''}`} />
                    </button>
                    
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pl-11 space-y-1"
                        >
                          {cat.chapitres.map((chap) => {
                            const isCurrent = activeChap === chap.id;
                            const isCompleted = store.completedChapters.includes(chap.id);
                            return (
                              <button
                                key={chap.id}
                                onClick={() => {
                                  setActiveTab('cours');
                                  setActiveCat(key);
                                  setActiveChap(chap.id);
                                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                                }}
                                className={`w-full text-left py-2 text-xs transition-all relative flex items-center gap-2 ${
                                  isCurrent ? 'text-cyan-400 font-bold' : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                {isCurrent && (
                                  <motion.div 
                                    layoutId="active-indicator" 
                                    className="absolute -left-4 w-1 h-4 bg-cyan-500 rounded-full" 
                                  />
                                )}
                                <span className="flex-1 truncate">{chap.titre}</span>
                                {isCompleted && <div className="w-1 h-1 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer User Info */}
          <div className="mt-8 pt-6 border-t border-slate-800/60">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
                {store.getNiveau().nom.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{store.getNiveau().nom}</p>
                <p className="text-[10px] text-slate-500 font-medium">{store.totalXP} XP cumulés</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 lg:hidden"
          />
        )}
      </AnimatePresence>
    </>
  );
};
