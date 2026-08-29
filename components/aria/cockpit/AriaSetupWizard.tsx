'use client';

/**
 * Assistant de première configuration (5 étapes).
 *
 * ── Point capital ────────────────────────────────────────────────────────────
 * L'étape 1 AFFICHE et fait CONFIRMER le profil scolaire ; elle ne le modifie
 * jamais. Aucune API self-service n'existe pour changer classe, voie ou
 * spécialités, et P0 n'en crée pas : ces champs restent la source de vérité
 * portée par Student et gérée par l'équipe Nexus.
 */

import { useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ARIA_LEARNING_GOALS,
  ARIA_WEEKLY_GOAL_MAX_MINUTES,
  ARIA_WEEKLY_GOAL_MIN_MINUTES,
  type AriaCockpitDTO,
  type AriaLearningGoal,
} from '@/lib/aria/contracts';
import { LEARNING_GOAL_LABELS, ROLE_LABELS, SUPPORT_LABELS, SUPPORT_TONE } from './support-labels';

const STEPS = [
  'Mon profil scolaire',
  'Ma carte',
  'Mes matières ARIA',
  'Mon rythme',
  'Mes objectifs',
] as const;

const RHYTHM_PRESETS = [90, 180, 300, 480];

export interface AriaSetupSubmission {
  selectedCourseKeys: string[];
  weeklyGoalMinutes: number;
  learningGoals: AriaLearningGoal[];
  completeOnboarding: true;
}

interface AriaSetupWizardProps {
  cockpit: AriaCockpitDTO;
  saving: boolean;
  error: string | null;
  onSubmit: (submission: AriaSetupSubmission) => void;
}

export function AriaSetupWizard({ cockpit, saving, error, onSubmit }: AriaSetupWizardProps) {
  const { academicProfile } = cockpit.curriculum;
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([...cockpit.profile.selectedCourseKeys]);
  const [weeklyGoal, setWeeklyGoal] = useState(cockpit.profile.weeklyGoalMinutes);
  const [goals, setGoals] = useState<AriaLearningGoal[]>([...cockpit.profile.learningGoals]);

  const selectableCourses = cockpit.curriculum.courses.filter(
    (view) => view.access.productSupported,
  );

  function toggleCourse(key: string) {
    setSelected((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function toggleGoal(goal: AriaLearningGoal) {
    setGoals((current) =>
      current.includes(goal) ? current.filter((item) => item !== goal) : [...current, goal],
    );
  }

  const blockedByProfile = academicProfile.incomplete;
  const isLastStep = step === STEPS.length - 1;

  return (
    <Card className="border-white/10 bg-surface-card" data-testid="aria-setup-wizard">
      <CardHeader>
        <CardTitle className="text-white">Configurer mon cockpit ARIA</CardTitle>
        <ol className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-5" aria-label="Étapes">
          {STEPS.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? 'step' : undefined}
              className={`rounded-micro px-2 py-1 text-[11px] ${
                index === step
                  ? 'bg-brand-accent/15 text-brand-accent'
                  : index < step
                    ? 'bg-white/5 text-neutral-400'
                    : 'bg-white/[0.02] text-neutral-600'
              }`}
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Étape 1 : profil scolaire (lecture seule) ───────────────── */}
        {step === 0 && (
          <div className="space-y-3">
            {blockedByProfile && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-amber-100">Profil scolaire incomplet</p>
                  <p className="mt-0.5 text-xs text-amber-200/80">
                    Il manque&nbsp;: {academicProfile.missingFields.join(', ')}.
                  </p>
                </div>
              </div>
            )}
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                ['Classe', academicProfile.gradeLevel],
                ['Voie', academicProfile.academicTrack],
                [
                  'Spécialités',
                  academicProfile.specialties.length > 0
                    ? academicProfile.specialties.join(', ')
                    : null,
                ],
                ['Parcours STMG', academicProfile.stmgPathway],
                ['Établissement', academicProfile.school],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="rounded-lg border border-white/10 bg-white/5 p-3"
                >
                  <dt className="text-xs text-neutral-500">{label}</dt>
                  <dd className="mt-0.5 text-sm text-neutral-100">
                    {value ?? <span className="text-neutral-600">Non renseigné</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Ces informations sont gérées par l’équipe Nexus. ARIA les lit sans jamais les modifier.
            </p>
          </div>
        )}

        {/* ── Étape 2 : carte complète ────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-2">
            <p className="text-sm text-neutral-400">
              Voici toutes les matières que ton profil implique, avec ce qu’ARIA sait réellement
              faire pour chacune.
            </p>
            <ul className="space-y-1.5">
              {cockpit.curriculum.courses.map((view) => (
                <li
                  key={view.course.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                >
                  <span className="text-sm text-neutral-100">{view.course.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-neutral-500">
                      {ROLE_LABELS[view.course.role] ?? view.course.role}
                    </span>
                    <span
                      className={`rounded-micro px-2 py-0.5 text-[11px] ${SUPPORT_TONE[view.course.support]}`}
                    >
                      {SUPPORT_LABELS[view.course.support]}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Étape 3 : sélection ─────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-2">
            <p className="text-sm text-neutral-400">
              Choisis les matières que tu veux travailler dans ton cockpit. Ce choix ne modifie
              pas ton abonnement.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {selectableCourses.map((view) => {
                const locked = !view.access.commerciallyEntitled;
                const isSelected = selected.includes(view.course.key);
                return (
                  <button
                    key={view.course.key}
                    type="button"
                    disabled={locked}
                    onClick={() => toggleCourse(view.course.key)}
                    data-testid={`aria-wizard-course-${view.course.key}`}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? 'border-brand-accent/50 bg-brand-accent/10'
                        : 'border-white/10 bg-white/5'
                    } ${locked ? 'cursor-not-allowed opacity-60' : 'hover:border-brand-accent/40'}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-neutral-100">
                        {view.course.shortLabel}
                      </span>
                      <span className="block text-[11px] text-neutral-500">
                        {SUPPORT_LABELS[view.course.support]}
                      </span>
                    </span>
                    {locked ? (
                      <Lock className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                    ) : isSelected ? (
                      <Check className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            {selectableCourses.length === 0 && (
              <p className="text-sm text-neutral-500">
                Aucune matière de ta carte n’est encore outillée par ARIA.
              </p>
            )}
          </div>
        )}

        {/* ── Étape 4 : rythme ────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-3">
            <label htmlFor="aria-weekly-goal" className="block text-sm text-neutral-300">
              Combien de temps veux-tu travailler avec ARIA chaque semaine&nbsp;?
            </label>
            <div className="flex flex-wrap gap-2">
              {RHYTHM_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setWeeklyGoal(preset)}
                  className={`rounded-micro border px-3 py-1.5 text-sm transition-colors ${
                    weeklyGoal === preset
                      ? 'border-brand-accent/50 bg-brand-accent/10 text-brand-accent'
                      : 'border-white/10 bg-white/5 text-neutral-300 hover:border-brand-accent/40'
                  }`}
                >
                  {preset} min
                </button>
              ))}
            </div>
            <input
              id="aria-weekly-goal"
              type="number"
              min={ARIA_WEEKLY_GOAL_MIN_MINUTES}
              max={ARIA_WEEKLY_GOAL_MAX_MINUTES}
              step={15}
              value={weeklyGoal}
              onChange={(event) => setWeeklyGoal(Number(event.target.value))}
              className="w-40 rounded-micro border border-white/10 bg-surface-darker px-3 py-2 text-sm text-neutral-100"
            />
            <p className="text-xs text-neutral-500">
              Entre {ARIA_WEEKLY_GOAL_MIN_MINUTES} et {ARIA_WEEKLY_GOAL_MAX_MINUTES} minutes.
            </p>
          </div>
        )}

        {/* ── Étape 5 : objectifs ─────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-2">
            <p className="text-sm text-neutral-400">Qu’attends-tu d’ARIA cette année&nbsp;?</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ARIA_LEARNING_GOALS.map((goal) => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => toggleGoal(goal)}
                  data-testid={`aria-wizard-goal-${goal}`}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    goals.includes(goal)
                      ? 'border-brand-accent/50 bg-brand-accent/10 text-brand-accent'
                      : 'border-white/10 bg-white/5 text-neutral-200 hover:border-brand-accent/40'
                  }`}
                >
                  {LEARNING_GOAL_LABELS[goal] ?? goal}
                  {goals.includes(goal) && <Check className="h-4 w-4" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-rose-300">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            className="text-neutral-400"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Retour
          </Button>

          {isLastStep ? (
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() =>
                onSubmit({
                  selectedCourseKeys: selected,
                  weeklyGoalMinutes: weeklyGoal,
                  learningGoals: goals,
                  completeOnboarding: true,
                })
              }
              className="bg-brand-accent text-surface-darker hover:bg-brand-accent/90"
              data-testid="aria-wizard-submit"
            >
              {saving ? 'Enregistrement…' : 'Terminer'}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))}
              className="bg-brand-accent text-surface-darker hover:bg-brand-accent/90"
              data-testid="aria-wizard-next"
            >
              Continuer
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
