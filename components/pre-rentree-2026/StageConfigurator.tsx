'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

/* ─────────────────────────────────────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────────────────────────────────── */

interface LevelOption {
  id: string;
  label: string;
}

interface SubjectOption {
  id: string;
  label: string;
  levels: string[];
  labelByLevel?: Record<string, string>;
}

interface Pack {
  id: string;
  subjectsCount: number;
  totalHours: number;
  price: number;
  deposit: number;
  balance: number;
}

interface ScheduleSlot {
  date: string;
  level: string;
  subject: string;
  block: string;
  startTime: string;
  endTime: string;
  room: string;
  week: number;
  sessionNumber: number;
}

interface Module {
  id: string;
  level: string;
  subject: string;
  title: string;
  subtitle: string;
  sessions: Array<{ number: number; title: string; objective: string }>;
}

interface StageConfiguratorProps {
  levels: LevelOption[];
  subjects: SubjectOption[];
  packs: Pack[];
  schedule: ScheduleSlot[];
  modules: Module[];
}

interface AcademicTrack {
  voie?: string;
  mathsOption?: string;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────────────────────── */

function needsTrackStep(level: string | null): boolean {
  return level === 'premiere' || level === 'terminale';
}

function needsValidation(
  level: string | null,
  track: AcademicTrack,
): boolean {
  if (level === 'premiere' && track.mathsOption) return true;
  if (level === 'terminale' && track.mathsOption && track.mathsOption !== 'aucune') return true;
  return false;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Component
   ─────────────────────────────────────────────────────────────────────────── */

export default function StageConfigurator({
  levels,
  subjects,
  packs,
  schedule,
  modules,
}: StageConfiguratorProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [academicTrack, setAcademicTrack] = useState<AcademicTrack>({});
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  /* ── Derived data ──────────────────────────────────────────────────────── */

  const availableSubjects = useMemo(() => {
    if (!selectedLevel) return [];
    return subjects.filter((s) => s.levels.includes(selectedLevel));
  }, [selectedLevel, subjects]);

  const matchedPack = useMemo(() => {
    if (selectedSubjects.length === 0) return null;
    return (
      packs.find((p) => p.subjectsCount === selectedSubjects.length) ??
      packs[packs.length - 1] // fallback to largest pack
    );
  }, [selectedSubjects.length, packs]);

  const selectedScheduleSlots = useMemo(() => {
    if (!selectedLevel) return [];
    return schedule.filter(
      (slot) =>
        slot.level === selectedLevel &&
        selectedSubjects.includes(slot.subject),
    );
  }, [schedule, selectedLevel, selectedSubjects]);

  const getSubjectLabel = useCallback(
    (subject: SubjectOption): string => {
      if (selectedLevel && subject.labelByLevel?.[selectedLevel]) {
        return subject.labelByLevel[selectedLevel];
      }
      return subject.label;
    },
    [selectedLevel],
  );

  const getSubjectScheduleInfo = useCallback(
    (subjectId: string) => {
      const slots = schedule.filter(
        (s) => s.level === selectedLevel && s.subject === subjectId,
      );
      if (slots.length === 0) return null;
      const weeks = [...new Set(slots.map((s) => s.week))];
      const firstSlot = slots[0];
      return {
        week: weeks.length === 1 ? `Semaine ${weeks[0]}` : `Semaines ${weeks.join(' et ')}`,
        time: `${firstSlot.startTime}–${firstSlot.endTime}`,
      };
    },
    [schedule, selectedLevel],
  );

  /* ── Navigation ────────────────────────────────────────────────────────── */

  const effectiveStep = useMemo(() => {
    // For Seconde, skip step 2
    if (currentStep === 2 && !needsTrackStep(selectedLevel)) return 3;
    return currentStep;
  }, [currentStep, selectedLevel]);

  function goNext() {
    if (currentStep === 1 && !needsTrackStep(selectedLevel)) {
      setCurrentStep(3);
    } else {
      setCurrentStep((s) => Math.min(s + 1, 4));
    }
  }

  function goBack() {
    if (currentStep === 3 && !needsTrackStep(selectedLevel)) {
      setCurrentStep(1);
    } else {
      setCurrentStep((s) => Math.max(s - 1, 1));
    }
  }

  /* ── Handlers ──────────────────────────────────────────────────────────── */

  function handleLevelChange(levelId: string) {
    setSelectedLevel(levelId);
    setAcademicTrack({});
    setSelectedSubjects([]);
  }

  function handleSubjectToggle(subjectId: string) {
    setSelectedSubjects((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId],
    );
  }

  /* ── WhatsApp message ──────────────────────────────────────────────────── */

  const whatsAppUrl = useMemo(() => {
    if (!selectedLevel || selectedSubjects.length === 0) return '#';
    const levelLabel = levels.find((l) => l.id === selectedLevel)?.label ?? selectedLevel;
    const subjectLabels = selectedSubjects
      .map((id) => {
        const s = subjects.find((sub) => sub.id === id);
        return s ? getSubjectLabel(s) : id;
      })
      .join(', ');
    const hours = matchedPack?.totalHours ?? '—';
    const price = matchedPack?.price ?? '—';
    const context = `le stage pré-rentrée 2026 (${levelLabel}, ${subjectLabels}, ${hours}h, ${price} TND)`;
    return buildWhatsAppUrl(context);
  }, [selectedLevel, selectedSubjects, levels, subjects, matchedPack, getSubjectLabel]);

  /* ── CTA URL ───────────────────────────────────────────────────────────── */

  const bilanUrl = useMemo(() => {
    if (!selectedLevel) return '/bilan-gratuit';
    const params = new URLSearchParams({
      programme: 'pre-rentree-2026',
      level: selectedLevel,
    });
    if (selectedSubjects.length > 0) {
      params.set('subjects', selectedSubjects.join(','));
    }
    return `/bilan-gratuit?${params.toString()}`;
  }, [selectedLevel, selectedSubjects]);

  /* ── Step indicators ───────────────────────────────────────────────────── */

  const totalSteps = needsTrackStep(selectedLevel) ? 4 : 3;
  const displayStep = useMemo(() => {
    if (!needsTrackStep(selectedLevel)) {
      if (currentStep >= 3) return currentStep - 1;
    }
    return currentStep;
  }, [currentStep, selectedLevel]);

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <section
      className="mx-auto w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6 md:p-8"
      aria-label="Configurateur de stage pré-rentrée"
    >
      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-2" aria-hidden="true">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`h-2 w-8 rounded-full transition-colors ${
              i + 1 <= displayStep ? 'bg-brand-600' : 'bg-neutral-200'
            }`}
          />
        ))}
      </div>
      <p className="mb-6 text-center text-sm text-neutral-500">
        Étape {displayStep} sur {totalSteps}
      </p>

      {/* ─── Step 1: Level ──────────────────────────────────────────────── */}
      {currentStep === 1 && (
        <fieldset className="space-y-4">
          <legend className="mb-2 text-lg font-semibold text-neutral-900">
            Classe de rentrée
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {levels.map((level) => (
              <label
                key={level.id}
                className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border-2 px-4 py-3 text-center font-medium transition-colors ${
                  selectedLevel === level.id
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                }`}
              >
                <input
                  type="radio"
                  name="level"
                  value={level.id}
                  checked={selectedLevel === level.id}
                  onChange={() => handleLevelChange(level.id)}
                  className="sr-only"
                />
                {level.label}
              </label>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={goNext}
              disabled={!selectedLevel}
              className="min-h-[44px] min-w-[44px] rounded-lg bg-brand-600 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuer
            </button>
          </div>
        </fieldset>
      )}

      {/* ─── Step 2: Academic Track ─────────────────────────────────────── */}
      {currentStep === 2 && needsTrackStep(selectedLevel) && (
        <div className="space-y-6">
          {selectedLevel === 'premiere' && (
            <>
              <fieldset className="space-y-3">
                <legend className="mb-2 text-lg font-semibold text-neutral-900">
                  Voie
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { id: 'generale', label: 'Générale' },
                    { id: 'technologique', label: 'Technologique' },
                  ].map((option) => (
                    <label
                      key={option.id}
                      className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border-2 px-4 py-3 text-center font-medium transition-colors ${
                        academicTrack.voie === option.id
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="voie"
                        value={option.id}
                        checked={academicTrack.voie === option.id}
                        onChange={() =>
                          setAcademicTrack((prev) => ({ ...prev, voie: option.id }))
                        }
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="mb-2 text-lg font-semibold text-neutral-900">
                  Mathématiques
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { id: 'eds', label: 'EDS Maths (spécialité)' },
                    { id: 'hors-eds', label: 'Hors EDS Maths' },
                  ].map((option) => (
                    <label
                      key={option.id}
                      className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border-2 px-4 py-3 text-center font-medium transition-colors ${
                        academicTrack.mathsOption === option.id
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="mathsOption"
                        value={option.id}
                        checked={academicTrack.mathsOption === option.id}
                        onChange={() =>
                          setAcademicTrack((prev) => ({ ...prev, mathsOption: option.id }))
                        }
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {selectedLevel === 'terminale' && (
            <fieldset className="space-y-3">
              <legend className="mb-2 text-lg font-semibold text-neutral-900">
                Option Mathématiques
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { id: 'aucune', label: 'Aucune' },
                  { id: 'expertes', label: 'Maths expertes' },
                  { id: 'complementaires', label: 'Maths complémentaires' },
                ].map((option) => (
                  <label
                    key={option.id}
                    className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border-2 px-4 py-3 text-center font-medium transition-colors ${
                      academicTrack.mathsOption === option.id
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mathsOption"
                      value={option.id}
                      checked={academicTrack.mathsOption === option.id}
                      onChange={() =>
                        setAcademicTrack((prev) => ({ ...prev, mathsOption: option.id }))
                      }
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={goBack}
              className="min-h-[44px] min-w-[44px] rounded-lg border border-neutral-300 px-6 py-3 font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={goNext}
              className="min-h-[44px] min-w-[44px] rounded-lg bg-brand-600 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-700"
            >
              Continuer
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Subjects ───────────────────────────────────────────── */}
      {currentStep === 3 && (
        <fieldset className="space-y-4">
          <legend className="mb-2 text-lg font-semibold text-neutral-900">
            Matières
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {availableSubjects.map((subject) => {
              const isSelected = selectedSubjects.includes(subject.id);
              const scheduleInfo = getSubjectScheduleInfo(subject.id);
              return (
                <label
                  key={subject.id}
                  className={`flex min-h-[44px] cursor-pointer flex-col rounded-lg border-2 px-4 py-3 transition-colors ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="subjects"
                      value={subject.id}
                      checked={isSelected}
                      onChange={() => handleSubjectToggle(subject.id)}
                      className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-medium text-neutral-900">
                      {getSubjectLabel(subject)}
                    </span>
                  </span>
                  <span className="mt-1 pl-6 text-sm text-neutral-500">
                    5 séances · 10 heures
                  </span>
                  {scheduleInfo && (
                    <span className="mt-0.5 pl-6 text-xs text-neutral-400">
                      {scheduleInfo.week} · {scheduleInfo.time}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={goBack}
              className="min-h-[44px] min-w-[44px] rounded-lg border border-neutral-300 px-6 py-3 font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={selectedSubjects.length === 0}
              className="min-h-[44px] min-w-[44px] rounded-lg bg-brand-600 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Voir le récapitulatif
            </button>
          </div>
        </fieldset>
      )}

      {/* ─── Step 4: Summary ────────────────────────────────────────────── */}
      {currentStep === 4 && (
        <div className="space-y-6" aria-live="polite">
          <h2 className="text-lg font-semibold text-neutral-900">Récapitulatif</h2>

          {/* Selection summary */}
          <div className="rounded-lg bg-neutral-50 p-4 text-sm">
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="font-medium text-neutral-600">Niveau</dt>
                <dd className="text-neutral-900">
                  {levels.find((l) => l.id === selectedLevel)?.label ?? '—'}
                </dd>
              </div>
              {needsTrackStep(selectedLevel) && (
                <>
                  {academicTrack.voie && (
                    <div className="flex justify-between">
                      <dt className="font-medium text-neutral-600">Voie</dt>
                      <dd className="capitalize text-neutral-900">
                        {academicTrack.voie}
                      </dd>
                    </div>
                  )}
                  {academicTrack.mathsOption && (
                    <div className="flex justify-between">
                      <dt className="font-medium text-neutral-600">Maths</dt>
                      <dd className="capitalize text-neutral-900">
                        {academicTrack.mathsOption}
                      </dd>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between">
                <dt className="font-medium text-neutral-600">Matières</dt>
                <dd className="text-right text-neutral-900">
                  {selectedSubjects
                    .map((id) => {
                      const s = subjects.find((sub) => sub.id === id);
                      return s ? getSubjectLabel(s) : id;
                    })
                    .join(', ')}
                </dd>
              </div>
            </dl>
          </div>

          {/* Pack pricing */}
          {matchedPack && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-brand-700">
                  {matchedPack.totalHours}h de stage
                </span>
                <span className="text-2xl font-bold text-brand-800">
                  {matchedPack.price} TND
                </span>
              </div>
              <div className="mt-2 flex justify-between text-sm text-brand-600">
                <span>Acompte à l&apos;inscription</span>
                <span className="font-medium">{matchedPack.deposit} TND</span>
              </div>
              <div className="flex justify-between text-sm text-brand-600">
                <span>Solde avant le début</span>
                <span className="font-medium">{matchedPack.balance} TND</span>
              </div>
            </div>
          )}

          {/* Schedule */}
          {selectedScheduleSlots.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-700">Planning</h3>
              <ul className="space-y-1 text-sm text-neutral-600">
                {selectedScheduleSlots.map((slot, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-brand-400" aria-hidden="true" />
                    <span>
                      {slot.date} · {slot.startTime}–{slot.endTime} · {slot.subject}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Validation notice */}
          {needsValidation(selectedLevel, academicTrack) && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Profil pédagogique déclaré — validation du groupe par l&apos;équipe Nexus.
            </p>
          )}

          {/* CTAs */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={bilanUrl}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-center font-medium text-white transition-colors hover:bg-brand-700"
            >
              Continuer vers le bilan
            </Link>
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border-2 border-green-600 px-6 py-3 text-center font-medium text-green-700 transition-colors hover:bg-green-50"
            >
              Contacter sur WhatsApp
            </a>
          </div>

          {/* Back button */}
          <div className="flex justify-start">
            <button
              type="button"
              onClick={goBack}
              className="min-h-[44px] min-w-[44px] rounded-lg border border-neutral-300 px-6 py-3 font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Modifier ma sélection
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
