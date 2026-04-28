/**
 * Re-export for backward compatibility (Lot E Vague 3)
 * Component moved to: components/programme/shared/Cockpit/SeanceDuJour.tsx
 */
/**
 * interface SeanceDuJourProps {
  onNavigateToChap: (catKey: string, chapId: string) => void;
  stageConfig: {
    getTodaySession: (baseDate?: Date, matiere?: 'Mathématiques' | 'Français') => any;
    formatDateFr: (date: string) => string;
  };
  programmeData: Record<string, any>;
}
 */
export { SeanceDuJour } from '@/components/programme/shared/Cockpit/SeanceDuJour';
