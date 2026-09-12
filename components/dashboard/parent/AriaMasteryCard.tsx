'use client';

/**
 * Parent-facing ARIA Mastery card (P6b) — the Suivi offer's first real UI
 * surface. Shows exactly what the child's own cockpit would show them
 * (same real computeMastery projection, via the parent-authorized read
 * path built in P6a), never more, never fabricated: no course selector
 * shown at all when the family has no ARIA course, no skill badge shown
 * for a skill with no real evidence beyond NOT_STARTED.
 *
 * P7a adds two more real, parent-authorized read paths alongside Mastery
 * — recent activity and the same Next Best Action recommendation the
 * child's own cockpit would show — never the child's private chat: both
 * are built on `LearningEvidence` (PRACTICE_ATTEMPT source only), the
 * same append-only, chat-free evidence store Mastery itself already
 * reads. This card never fetches, imports, or renders anything from
 * `AriaMessage`/`AriaConversation`.
 */

import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Loader2, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AriaParentChildCourse {
  readonly courseKey: string;
  readonly label: string;
}
interface AriaCourseSkillMastery {
  readonly skillId: string;
  readonly skillLabel: string;
  readonly level: 'NOT_STARTED' | 'DEVELOPING' | 'PROFICIENT' | 'MASTERED';
  readonly activityId: string | null;
}
interface AriaNextBestAction {
  readonly skillId: string;
  readonly skillLabel: string;
}
interface AriaRecentActivityItem {
  readonly skillId: string;
  readonly skillLabel: string;
  readonly outcome: 'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT';
  readonly observedAt: string;
}

const RECENT_ACTIVITY_OUTCOME_LABELS: Record<AriaRecentActivityItem['outcome'], string> = {
  CORRECT: 'Correct',
  PARTIALLY_CORRECT: 'Partiellement correct',
  INCORRECT: 'À revoir',
};

const MASTERY_BADGE_LABELS: Record<AriaCourseSkillMastery['level'], string> = {
  NOT_STARTED: 'À commencer',
  DEVELOPING: 'En progrès',
  PROFICIENT: 'Presque acquis',
  MASTERED: 'Maîtrisé',
};
const MASTERY_BADGE_TONE: Record<AriaCourseSkillMastery['level'], string> = {
  NOT_STARTED: 'bg-white/5 text-neutral-400',
  DEVELOPING: 'bg-amber-500/10 text-amber-300',
  PROFICIENT: 'bg-sky-500/10 text-sky-300',
  MASTERED: 'bg-emerald-500/10 text-emerald-300',
};
// Skills with no real practice content yet are noise for a parent
// (nothing to act on) — shown only once the student has started.
const SKIPPED_WHEN_UNSTARTED: readonly AriaCourseSkillMastery['level'][] = ['NOT_STARTED'];

export function AriaMasteryCard({ studentId }: Readonly<{ studentId: string }>) {
  const [courses, setCourses] = useState<readonly AriaParentChildCourse[] | null>(null);
  const [selectedCourseKey, setSelectedCourseKey] = useState<string | null>(null);
  const [skills, setSkills] = useState<readonly AriaCourseSkillMastery[] | null>(null);
  const [nextBestAction, setNextBestAction] = useState<AriaNextBestAction | null>(null);
  const [recentActivity, setRecentActivity] = useState<readonly AriaRecentActivityItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/parent/children/${encodeURIComponent(studentId)}/aria/courses`);
      if (!response.ok) throw new Error('load failed');
      const body = (await response.json()) as { courses: readonly AriaParentChildCourse[] };
      setCourses(body.courses);
      setSelectedCourseKey(body.courses[0]?.courseKey ?? null);
    } catch {
      // A read-only progress card is a non-essential enhancement — a
      // failed fetch simply leaves it absent, never blocks the rest of
      // the parent dashboard.
      setCourses(null);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    if (!selectedCourseKey) {
      setSkills(null);
      return;
    }
    let cancelled = false;
    setSkills(null);
    void (async () => {
      try {
        const response = await fetch(
          `/api/parent/children/${encodeURIComponent(studentId)}/aria/mastery?courseKey=${encodeURIComponent(selectedCourseKey)}`,
        );
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { skills: readonly AriaCourseSkillMastery[] };
        if (!cancelled) setSkills(body.skills);
      } catch {
        // Same reasoning as loadCourses: stays empty, never blocks.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, selectedCourseKey]);

  useEffect(() => {
    if (!selectedCourseKey) {
      setNextBestAction(null);
      return;
    }
    let cancelled = false;
    setNextBestAction(null);
    void (async () => {
      try {
        const response = await fetch(
          `/api/parent/children/${encodeURIComponent(studentId)}/aria/next-best-action?courseKey=${encodeURIComponent(selectedCourseKey)}`,
        );
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { action: AriaNextBestAction | null };
        if (!cancelled) setNextBestAction(body.action);
      } catch {
        // Same reasoning as the mastery fetch: stays empty, never blocks.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, selectedCourseKey]);

  useEffect(() => {
    if (!selectedCourseKey) {
      setRecentActivity(null);
      return;
    }
    let cancelled = false;
    setRecentActivity(null);
    void (async () => {
      try {
        const response = await fetch(
          `/api/parent/children/${encodeURIComponent(studentId)}/aria/recent-activity?courseKey=${encodeURIComponent(selectedCourseKey)}`,
        );
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { activity: readonly AriaRecentActivityItem[] };
        if (!cancelled) setRecentActivity(body.activity);
      } catch {
        // Same reasoning as the mastery fetch: stays empty, never blocks.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, selectedCourseKey]);

  if (loading) {
    return (
      <Card className="bg-surface-card border-white/10 shadow-premium">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-brand-accent" aria-label="Chargement" />
        </CardContent>
      </Card>
    );
  }

  // No ARIA course for this family: this card simply doesn't exist —
  // never a placeholder implying a capability that isn't real for them.
  if (!courses || courses.length === 0) return null;

  const started = (skills ?? []).filter((skill) => !SKIPPED_WHEN_UNSTARTED.includes(skill.level));

  return (
    <Card className="bg-surface-card border-white/10 shadow-premium" data-testid="aria-mastery-card">
      <CardHeader>
        <CardTitle className="text-white text-base flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-brand-accent" aria-hidden="true" />
          Progression ARIA
        </CardTitle>
        {courses.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {courses.map((course) => (
              <button
                key={course.courseKey}
                type="button"
                onClick={() => setSelectedCourseKey(course.courseKey)}
                data-testid={`aria-mastery-course-tab-${course.courseKey}`}
                className={`rounded-micro px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedCourseKey === course.courseKey
                    ? 'bg-brand-accent/15 text-brand-accent'
                    : 'bg-white/5 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {course.label}
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {started.length === 0 ? (
          <p className="text-sm text-neutral-400">
            {courses.find((c) => c.courseKey === selectedCourseKey)?.label ?? 'Ce cours'} — aucun exercice réalisé pour le moment.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {started.map((skill) => (
              <li
                key={skill.skillId}
                className="flex items-center justify-between gap-2 rounded-micro border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-neutral-300"
              >
                <span>{skill.skillLabel}</span>
                <span className={`shrink-0 rounded-micro px-1.5 py-0.5 text-[10px] font-medium ${MASTERY_BADGE_TONE[skill.level]}`}>
                  {MASTERY_BADGE_LABELS[skill.level]}
                </span>
              </li>
            ))}
          </ul>
        )}

        {nextBestAction && (
          <div
            data-testid="aria-parent-next-best-action"
            className="mt-4 flex items-center gap-2 rounded-micro border border-brand-accent/30 bg-brand-accent/5 px-2.5 py-2 text-xs text-neutral-200"
          >
            <Target className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
            <span>
              Prochaine recommandation ARIA : <span className="font-medium">{nextBestAction.skillLabel}</span>
            </span>
          </div>
        )}

        {recentActivity && recentActivity.length > 0 && (
          <div className="mt-4" data-testid="aria-parent-recent-activity">
            <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500">Activité récente</h3>
            <ul className="mt-2 space-y-1.5">
              {recentActivity.map((item, index) => (
                <li
                  // No stable per-attempt id is exposed to the parent view
                  // (deliberately: this is an outcome trail, not an
                  // attempt-management UI) — index is safe here since the
                  // list is a static server snapshot per render, never
                  // reordered or filtered client-side.
                  key={`${item.skillId}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-micro border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-neutral-300"
                >
                  <span>{item.skillLabel}</span>
                  <span className="shrink-0 text-neutral-400">
                    {RECENT_ACTIVITY_OUTCOME_LABELS[item.outcome]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
