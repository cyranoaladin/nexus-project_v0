'use client';

/**
 * État vide honnête (§32).
 *
 * Utilisé partout où la donnée n'existe pas. Ne jamais remplacer par une
 * valeur de démonstration, un score fictif ou une analyse inventée.
 */

interface EmptyStateProps {
  title: string;
  body?: string;
  children?: React.ReactNode;
}

export function EmptyState({ title, body, children }: EmptyStateProps) {
  return (
    <div className="rounded-card border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center">
      <p className="text-sm font-medium text-neutral-200">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-xs text-neutral-400">{body}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
