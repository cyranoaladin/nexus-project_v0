'use client';

/**
 * Interaction réelle locale (P3 §12) : cases à cocher non persistées — état
 * React local uniquement. Le reset UTICA remet l'état à zéro.
 */
import { useState } from 'react';
import type { ResourceChecklistItem } from '@/lib/demo/utica-2026/resources';

export function ChecklistInteractive({ items }: { items: ResourceChecklistItem[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const doneCount = Object.values(checked).filter(Boolean).length;

  return (
    <div>
      <p className="text-xs text-neutral-500">
        {doneCount} / {items.length} vérifié{doneCount > 1 ? 's' : ''}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/10 bg-surface-darker/40 px-3 py-2 text-sm text-neutral-300 hover:bg-white/5">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-primary"
                checked={!!checked[item.id]}
                onChange={() => setChecked((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
              />
              <span className={checked[item.id] ? 'text-neutral-500 line-through' : ''}>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
