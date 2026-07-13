import { cn } from '@/lib/utils';
import { getSubjectTheme } from '@/lib/campaigns/pre-rentree-2026/subject-theme';

export function SubjectBadge({
  subjectId,
  label,
  className,
}: {
  subjectId: string;
  label: string;
  className?: string;
}) {
  const theme = getSubjectTheme(subjectId, label);
  return (
    <span
      data-subject-family={theme.family}
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm font-semibold',
        theme.surfaceClass,
        theme.borderClass,
        theme.textClass,
        theme.printClass,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1 text-[0.65rem] font-bold tracking-tight',
          theme.markerClass,
          'print:border print:border-slate-700 print:bg-white print:text-black',
        )}
      >
        {theme.marker}
      </span>
      <span>{label}</span>
    </span>
  );
}
