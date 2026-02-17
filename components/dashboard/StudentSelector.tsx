'use client';

import { useEffect, useState, useCallback } from 'react';
import { User } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * StudentSelector — Discrete child selector for parent multi-children.
 *
 * Micro-copy: "Enfant suivi" / "Chaque trajectoire est pilotée individuellement."
 *
 * Fetches children from /api/parent/children and manages selection.
 * Persists selection in localStorage for cross-session continuity.
 */

interface ChildInfo {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  grade: string | null;
}

interface StudentSelectorProps {
  /** Callback when a child is selected */
  onSelect: (studentId: string) => void;
  /** Currently selected student ID */
  selectedId?: string | null;
}

const STORAGE_KEY = 'nexus-selected-child';

export function StudentSelector({ onSelect, selectedId }: StudentSelectorProps) {
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const handleSelect = useCallback((id: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage unavailable — ignore
    }
    onSelect(id);
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;

    async function fetchChildren() {
      try {
        const res = await fetch('/api/parent/children');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        // API returns array directly or { children: [...] }
        const raw = Array.isArray(data) ? data : (data.children ?? []);
        const kids: ChildInfo[] = raw.map((c: Record<string, unknown>) => ({
          id: String(c.id ?? ''),
          userId: String(c.userId ?? ''),
          firstName: String(c.firstName ?? ''),
          lastName: String(c.lastName ?? ''),
          grade: c.grade ? String(c.grade) : null,
        }));
        setChildren(kids);

        if (kids.length === 0) return;

        // Auto-select: use prop > localStorage > first child
        const stored = getStoredChild();
        const validStored = stored && kids.some((c) => c.id === stored) ? stored : null;
        const initial = selectedId || validStored || kids[0].id;

        handleSelect(initial);
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchChildren();
    return () => { cancelled = true; };
  }, [selectedId, handleSelect]);

  // Single child or loading: don't show selector
  if (loading || children.length <= 1) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 text-neutral-500" />
        <span className="text-xs font-medium text-neutral-400">Enfant suivi</span>
      </div>
      <Select value={selectedId ?? ''} onValueChange={handleSelect}>
        <SelectTrigger className="w-44 h-8 text-xs border-neutral-700 bg-surface-elevated text-neutral-200">
          <SelectValue placeholder="Sélectionner" />
        </SelectTrigger>
        <SelectContent className="bg-surface-card border border-neutral-700 text-neutral-200">
          {children.map((child) => (
            <SelectItem key={child.id} value={child.id} className="text-xs">
              {child.firstName} {child.lastName}
              {child.grade && <span className="text-neutral-500 ml-1">· {child.grade}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function getStoredChild(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
