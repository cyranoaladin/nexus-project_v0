'use client';

import { useEffect, useId, useRef } from 'react';

interface Props {
  title: string;
  children: React.ReactNode;
  /** Bouton à focus initial : le choix le moins risqué. */
  actions: { label: string; onClick: () => void; variant?: 'primary' | 'secondary'; autoFocus?: boolean; disabled?: boolean }[];
  onEscape?: () => void;
}

/** Dialogue modal accessible : rôle alertdialog, focus piégé, Échap si une sortie existe. */
export function AlertDialog({ title, children, actions, onEscape }: Props) {
  const titleId = useId();
  const descId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const target = ref.current?.querySelector<HTMLElement>('[data-autofocus="true"]') ?? ref.current?.querySelector<HTMLElement>('button');
    target?.focus();
    return () => previous?.focus?.();
  }, []);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape' && onEscape) {
      event.stopPropagation();
      onEscape();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []);
    if (buttons.length === 0) return;
    const first = buttons[0]!;
    const last = buttons[buttons.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/15 bg-surface-card p-6 shadow-xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-neutral-50">
          {title}
        </h2>
        <div id={descId} className="mt-3 space-y-3 text-neutral-200">
          {children}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              disabled={a.disabled}
              data-autofocus={a.autoFocus ? 'true' : undefined}
              className={`h-11 rounded-lg px-4 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60 ${
                a.variant === 'primary' ? 'bg-brand-accent text-neutral-950 hover:opacity-90' : 'border border-white/20 text-neutral-100 hover:bg-white/5'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
