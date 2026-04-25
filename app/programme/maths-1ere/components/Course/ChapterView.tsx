'use client';

import React from 'react';
import { programmeData } from '../../data';
import { useChapterProgress } from '../../hooks/useChapterProgress';
import { resolveUiIcon } from '@/lib/ui-icons';

// Sections
import { ChapterHeader } from './sections/ChapterHeader';
import { ChapterCourse } from './sections/ChapterCourse';
import { ChapterPractice } from './sections/ChapterPractice';
import { ChapterFooter } from './sections/ChapterFooter';

interface ChapterViewProps {
  catKey: string;
  chapId: string;
  focusMode: boolean;
  onToggleFocus: () => void;
}

export const ChapterView: React.FC<ChapterViewProps> = ({ 
  catKey, 
  chapId, 
  focusMode, 
  onToggleFocus 
}) => {
  const cat = programmeData[catKey];
  const chap = cat?.chapitres.find((c) => c.id === chapId);
  
  const {
    recordDiagnostic,
    recordExerciseResult,
    recordHintUsage,
    recordSRSReview,
    toggleChapterComplete,
    markPrinted,
    isCompleted
  } = useChapterProgress(chapId, chap?.pointsXP || 0);

  if (!cat || !chap) return null;

  const handlePrint = () => {
    window.print();
    markPrinted();
  };

  return (
    <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/30 rounded-3xl p-6 md:p-10 relative overflow-hidden transition-all duration-500 shadow-2xl">
      {/* Background Decor */}
      {(() => {
        const ThemeIcon = resolveUiIcon(cat.icon);
        return (
          <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none transform translate-x-1/4 -translate-y-1/4 transition-transform duration-700 hover:rotate-12">
            <ThemeIcon className="w-48 h-48" aria-hidden="true" />
          </div>
        );
      })()}

      <ChapterHeader 
        cat={cat}
        chap={chap}
        isCompleted={isCompleted}
        focusMode={focusMode}
        onPrint={handlePrint}
        onToggleFocus={onToggleFocus}
        onToggleComplete={toggleChapterComplete}
      />

      <div className="space-y-16 relative z-10">
        <ChapterCourse chap={chap} />
        
        <ChapterPractice 
          catKey={catKey}
          cat={cat}
          chap={chap}
          chapId={chapId}
          onRecordDiagnostic={recordDiagnostic}
          onRecordExerciseResult={recordExerciseResult}
          onRecordHintUsage={recordHintUsage}
        />

        <ChapterFooter 
          chapId={chapId}
          chap={chap}
          onRecordSRSReview={recordSRSReview}
        />
      </div>
    </div>
  );
};
