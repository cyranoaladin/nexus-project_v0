'use client';

/**
 * /dashboard/eleve/aria — Cockpit d'apprentissage ARIA.
 *
 * Suit l'idiome du dashboard élève existant : composant client, chargement du
 * payload par `fetch`, garde de rôle côté client doublée par la garde serveur
 * de `/api/aria/cockpit`.
 *
 * Le chat utilise le widget ARIA EXISTANT (`AriaWidget`) : P0 ne refond pas le
 * pipeline `/api/aria/chat`.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AriaWidget } from '@/components/ui/aria-widget';
import {
  AriaCockpitShell,
  AriaSetupWizard,
  type AriaSetupSubmission,
} from '@/components/aria/cockpit';
import type { AriaCockpitDTO, AriaLearningGoal } from '@/lib/aria/contracts';

/** Champs que le cockpit est autorisé à écrire (miroir du schéma serveur). */
type AriaProfileUpdatePayload = {
  selectedCourseKeys?: string[];
  weeklyGoalMinutes?: number;
  learningGoals?: AriaLearningGoal[];
  completeOnboarding?: boolean;
};

export default function AriaCockpitPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cockpit, setCockpit] = useState<AriaCockpitDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [chatSubject, setChatSubject] = useState<string | undefined>(undefined);
  const [chatOpen, setChatOpen] = useState(false);

  const loadCockpit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/aria/cockpit');
      if (!response.ok) throw new Error('Chargement du cockpit impossible');
      setCockpit((await response.json()) as AriaCockpitDTO);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'ELEVE') {
      router.push('/auth/signin');
      return;
    }
    void loadCockpit();
  }, [session, status, router, loadCockpit]);

  const saveProfile = useCallback(
    async (payload: AriaProfileUpdatePayload) => {
      setSaving(true);
      setSaveError(null);
      try {
        const response = await fetch('/api/aria/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? 'Enregistrement impossible');
        }
        await loadCockpit();
      } catch (caught) {
        setSaveError(caught instanceof Error ? caught.message : 'Erreur inconnue');
      } finally {
        setSaving(false);
      }
    },
    [loadCockpit],
  );

  /** Ouvre le chat existant avec la matière du cours présélectionnée. */
  const handleOpenChat = useCallback(
    (courseKey: string) => {
      const view = cockpit?.curriculum.courses.find(
        (candidate) => candidate.course.key === courseKey,
      );
      if (!view?.course.chatSubject) return;
      setChatSubject(view.course.chatSubject);
      setChatOpen(true);
    },
    [cockpit],
  );

  const handleToggleCourse = useCallback(
    (courseKey: string) => {
      if (!cockpit) return;
      const current = cockpit.profile.selectedCourseKeys;
      const next = current.includes(courseKey)
        ? current.filter((key) => key !== courseKey)
        : [...current, courseKey];
      void saveProfile({ selectedCourseKeys: next });
    },
    [cockpit, saveProfile],
  );

  const handleSetupSubmit = useCallback(
    (submission: AriaSetupSubmission) => {
      void saveProfile(submission);
    },
    [saveProfile],
  );

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-surface-darker">
        <Loader2 className="h-6 w-6 animate-spin text-brand-accent" aria-label="Chargement" />
      </div>
    );
  }

  if (error || !cockpit) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-surface-darker text-center">
        <AlertCircle className="h-6 w-6 text-rose-400" aria-hidden="true" />
        <p className="text-sm text-neutral-300">{error ?? 'Cockpit indisponible'}</p>
        <Button size="sm" onClick={() => void loadCockpit()}>
          Réessayer
        </Button>
      </div>
    );
  }

  const needsOnboarding =
    cockpit.setup.state === 'ONBOARDING_REQUIRED' ||
    cockpit.setup.state === 'ACADEMIC_PROFILE_INCOMPLETE';

  return (
    <div className="text-neutral-100" data-testid="aria-cockpit-page">
      {needsOnboarding ? (
        <AriaSetupWizard
          cockpit={cockpit}
          saving={saving}
          error={saveError}
          onSubmit={handleSetupSubmit}
        />
      ) : (
        <>
          {saveError && (
            <p role="alert" className="mb-4 text-sm text-rose-300">
              {saveError}
            </p>
          )}
          <AriaCockpitShell
            cockpit={cockpit}
            onOpenChat={handleOpenChat}
            onToggleCourse={handleToggleCourse}
          />
        </>
      )}

      <AriaWidget
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        defaultSubject={chatSubject}
      />
    </div>
  );
}
