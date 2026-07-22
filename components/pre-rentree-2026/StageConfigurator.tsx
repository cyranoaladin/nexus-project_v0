'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { toPreRentreeEntryLevel, track } from '@/lib/analytics';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import {
  buildSelectionSummary,
  buildWhatsAppMessage,
  classifyProfileSubjectCompatibility,
  getNextConfiguratorStep,
  getPreviousConfiguratorStep,
  isAcademicProfileComplete,
  toggleLimitedSelection,
  type AcademicProfileSelection,
  type LandingLevel,
  type LandingPack,
  type LandingScheduleSlot,
  type LandingSubject,
  type SelectionSummary,
} from '@/lib/campaigns/pre-rentree-2026/configurator';
import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';
import {
  formatDetailedDates,
  formatPresenceRange,
} from '@/lib/campaigns/pre-rentree-2026/presentation';
import { getSubjectTheme } from '@/lib/campaigns/pre-rentree-2026/subject-theme';
import { SubjectBadge } from './SubjectBadge';
import { useCampaignExperience } from './CampaignExperienceContext';

interface ProfileOption {
  id: string;
  label: string;
}

interface AcademicProfiles {
  TROISIEME: Record<string, never>;
  SECONDE: Record<string, never>;
  PREMIERE: {
    voies: ProfileOption[];
    mathsProfiles: ProfileOption[];
    eafProfiles: ProfileOption[];
    specialtyPlans: ProfileOption[];
  };
  TERMINALE: {
    retainedSpecialties: {
      label: string;
      minSelections: number;
      maxSelections: number;
      options: ProfileOption[];
    };
    mathsOptions: ProfileOption[];
  };
}

interface StageConfiguratorProps {
  levels: LandingLevel[];
  subjects: LandingSubject[];
  packs: LandingPack[];
  schedule: LandingScheduleSlot[];
  academicProfiles: AcademicProfiles;
  groupCompositionNotice: string;
  campaignPublicStatus: string;
}

function ChoiceCard({
  name,
  option,
  checked,
  onChange,
}: {
  name: string;
  option: ProfileOption;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-center rounded-xl border-2 px-4 py-3 ${checked ? 'border-lux-gold bg-lux-gold/10' : 'border-lux-line bg-white'}`}>
      <input
        className="mr-3 h-4 w-4 accent-lux-gold"
        type="radio"
        name={name}
        value={option.id}
        checked={checked}
        onChange={onChange}
      />
      <span className="text-sm font-medium text-lux-ink">{option.label}</span>
    </label>
  );
}

function SummaryCard({
  summary,
  profileComplete,
  notice,
  publicStatus,
  expanded,
  onToggle,
  onNavigate,
}: {
  summary: SelectionSummary | null;
  profileComplete: boolean;
  notice: string;
  publicStatus: string;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  if (!summary) {
    return (
      <div aria-live="polite" className="rounded-2xl border border-lux-line bg-lux-paper p-5">
        <h3 className="font-semibold text-lux-ink">Votre résumé</h3>
        <p className="mt-2 text-sm text-lux-slate">Choisissez d'abord la classe de rentrée.</p>
      </div>
    );
  }

  if (!profileComplete) {
    return (
      <div aria-live="polite" className="rounded-2xl border border-lux-line bg-lux-paper p-5">
        <h3 className="font-semibold text-lux-ink">Votre résumé</h3>
        <p className="mt-2 text-sm text-lux-slate">Complétez le profil pédagogique pour poursuivre.</p>
      </div>
    );
  }

  if (!summary.pack) {
    return (
      <div aria-live="polite" className="rounded-2xl border border-lux-line bg-lux-paper p-5">
        <h3 className="font-semibold text-lux-ink">Votre résumé</h3>
        <p className="mt-2 text-sm text-lux-slate">Sélectionnez au moins une matière pour afficher le pack.</p>
      </div>
    );
  }

  const whatsappUrl = buildWhatsAppUrl(buildWhatsAppMessage(summary), { exactMessage: true });
  const pack = summary.pack;

  return (
    <div aria-live="polite" className="max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-lux-gold/40 bg-lux-paper p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-lux-ink">Votre résumé</h3>
        <span className="rounded-full bg-lux-evergreen/10 px-3 py-1 text-xs font-semibold text-lux-evergreen">{publicStatus}</span>
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="campaign-selection-summary"
        onClick={onToggle}
        className="mt-3 flex min-h-11 w-full items-center justify-between rounded-lg border border-lux-line bg-white px-4 py-2 text-left text-sm font-semibold text-lux-ink lg:hidden"
      >
        <span>{expanded ? 'Réduire le résumé' : 'Afficher le résumé'}</span>
        <span aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>
      <div id="campaign-selection-summary" className={`${expanded ? 'block' : 'hidden'} lg:block`}>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-lux-slate">Classe de rentrée</dt><dd className="text-right font-medium text-lux-ink">{summary.levelLabel}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-lux-slate">Profil</dt><dd className="text-right font-medium text-lux-ink">{summary.profileLabel}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-lux-slate">Matières</dt><dd className="text-right font-medium text-lux-ink">{summary.subjectLabels.join(', ')}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-lux-slate">Volume</dt><dd className="font-medium text-lux-ink">{summary.sessionCount} séances · {summary.totalHours} heures</dd></div>
      </dl>
      <ul className="mt-4 space-y-2 border-t border-lux-line pt-4 text-xs text-lux-slate">
        {summary.scheduleLines.map((line) => (
          <li key={line.subjectId} aria-label={`${line.subjectLabel} : ${formatDetailedDates(line.dates)}, ${line.startTime} à ${line.endTime}`}>
            <SubjectBadge subjectId={line.subjectId} label={line.subjectLabel} /><br />
            <span className="mt-1 inline-block">{formatPresenceRange(line.dates)} · {line.startTime}–{line.endTime}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-xl bg-white p-4">
        <p className="font-fraunces text-2xl text-lux-ink">{pack.price.toLocaleString('fr-TN')} TND</p>
        <p className="mt-1 text-sm text-lux-slate">Acompte : {pack.deposit.toLocaleString('fr-TN')} TND</p>
        <p className="text-sm text-lux-slate">Solde : {pack.balance.toLocaleString('fr-TN')} TND</p>
      </div>
      {summary.requiresValidation && (
        <div className="mt-4 rounded-xl border border-lux-gold/30 bg-lux-gold/10 p-3 text-sm text-lux-ink">
          <p className="font-semibold">Profil pédagogique déclaré — validation du groupe par l'équipe Nexus.</p>
          <p className="mt-1 text-lux-slate">{notice}</p>
        </div>
      )}
      <div className="mt-5 grid gap-3">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            onNavigate();
            track.preRentreeWhatsAppClicked('configurator_summary', pack.code);
          }}
          className="lux-cta-reserve flex min-h-11 items-center justify-center rounded-lg px-4 py-3 text-center text-sm font-semibold"
        >
          Demander ce parcours sur WhatsApp <span className="sr-only">(nouvel onglet)</span>
        </a>
      </div>
      </div>
    </div>
  );
}

export default function StageConfigurator({
  levels,
  subjects,
  packs,
  schedule,
  academicProfiles,
  groupCompositionNotice,
  campaignPublicStatus,
}: StageConfiguratorProps) {
  const [step, setStep] = useState(1);
  const [level, setLevel] = useState<EntryLevelCode | null>(null);
  const [profile, setProfile] = useState<AcademicProfileSelection>({});
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const { setConfiguredEntryLevel } = useCampaignExperience();

  const availableSubjects = useMemo(
    () => (level ? subjects.filter((subject) => subject.levels.includes(level)) : []),
    [level, subjects],
  );
  const profileLabels = useMemo(
    () => Object.fromEntries([
      ...academicProfiles.PREMIERE.voies,
      ...academicProfiles.PREMIERE.mathsProfiles,
      ...academicProfiles.PREMIERE.eafProfiles,
      ...academicProfiles.PREMIERE.specialtyPlans,
      ...academicProfiles.TERMINALE.retainedSpecialties.options,
      ...academicProfiles.TERMINALE.mathsOptions,
    ].map((option) => [option.id, option.label])),
    [academicProfiles],
  );
  const summary = useMemo(
    () =>
      level
        ? buildSelectionSummary({ level, profile, profileLabels, subjectIds, levels, subjects, packs, schedule })
        : null,
    [level, profile, profileLabels, subjectIds, levels, subjects, packs, schedule],
  );
  const profileComplete = isAcademicProfileComplete(level, profile);
  const compatibility = useMemo(
    () => level
      ? classifyProfileSubjectCompatibility(level, profile, subjectIds)
      : { status: 'COMPATIBLE' as const, messages: [] },
    [level, profile, subjectIds],
  );
  const profileIncompatible = compatibility.status === 'INCOMPATIBLE';

  function chooseLevel(nextLevel: EntryLevelCode) {
    setLevel(nextLevel);
    setConfiguredEntryLevel(nextLevel);
    setProfile({});
    setSubjectIds([]);
    setMobileSummaryOpen(false);
    track.preRentreeLevelSelected(toPreRentreeEntryLevel(nextLevel));
  }

  function toggleSubject(subjectId: string) {
    const next = subjectIds.includes(subjectId)
      ? subjectIds.filter((id) => id !== subjectId)
      : [...subjectIds, subjectId];
    setSubjectIds(next);
    if (level) {
      track.preRentreeSubjectSelected(
        toPreRentreeEntryLevel(level),
        subjectId.toLowerCase(),
        next.length,
      );
    }
  }

  function continueTo(nextStep: number) {
    setStep(nextStep);
    if (nextStep === 4 && summary?.pack) {
      setMobileSummaryOpen(true);
      track.preRentreePriceSummaryViewed(summary.pack.code);
    }
  }

  const inputClass = 'grid gap-3 sm:grid-cols-2';
  const buttonClass = 'min-h-11 rounded-lg px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lux-gold';

  return (
    <section className="bg-white px-4 py-14 md:py-20" aria-labelledby="configurator-heading">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lux-gold-deep">Demande d’information sans paiement</p>
          <h2 id="configurator-heading" className="mt-3 font-fraunces text-3xl text-lux-ink md:text-4xl">Composer le stage de votre enfant</h2>
          <p className="mt-3 text-lux-slate">Sélectionnez la classe de rentrée, le profil et les matières pour obtenir un résumé exact.</p>
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-lux-line bg-lux-paper p-5 sm:p-7">
            <p className="mb-6 text-sm font-medium text-lux-slate">Étape {(level === 'TROISIEME' || level === 'SECONDE') && step >= 3 ? step - 1 : step} sur {level === 'TROISIEME' || level === 'SECONDE' ? 3 : 4}</p>

            {step === 1 && (
              <fieldset>
                <legend className="font-semibold text-lux-ink">Classe de rentrée 2026</legend>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {levels.map((option) => (
                    <ChoiceCard key={option.id} name="level" option={option} checked={level === option.id} onChange={() => chooseLevel(option.id)} />
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <button type="button" className={`${buttonClass} lux-cta-reserve disabled:opacity-50`} disabled={!level} onClick={() => continueTo(getNextConfiguratorStep(step, level))}>Continuer</button>
                </div>
              </fieldset>
            )}

            {step === 2 && level === 'PREMIERE' && (
              <div className="space-y-6">
                <fieldset><legend className="font-semibold text-lux-ink">Voie</legend><div className={`mt-3 ${inputClass}`}>{academicProfiles.PREMIERE.voies.map((option) => <ChoiceCard key={option.id} name="voie" option={option} checked={profile.voie === option.id} onChange={() => { setProfile((value) => ({ ...value, voie: option.id })); track.preRentreeTrackSelected('premiere', option.id.toLowerCase()); }} />)}</div></fieldset>
                <fieldset><legend className="font-semibold text-lux-ink">Profil Mathématiques</legend><div className={`mt-3 ${inputClass}`}>{academicProfiles.PREMIERE.mathsProfiles.map((option) => <ChoiceCard key={option.id} name="maths-profile" option={option} checked={profile.mathsProfile === option.id} onChange={() => { setProfile((value) => ({ ...value, mathsProfile: option.id })); track.preRentreeTrackSelected('premiere', option.id.toLowerCase()); }} />)}</div></fieldset>
                <fieldset><legend className="font-semibold text-lux-ink">Profil Français EAF</legend><div className={`mt-3 ${inputClass}`}>{academicProfiles.PREMIERE.eafProfiles.map((option) => <ChoiceCard key={option.id} name="eaf-profile" option={option} checked={profile.eafProfile === option.id} onChange={() => { setProfile((value) => ({ ...value, eafProfile: option.id })); track.preRentreeTrackSelected('premiere', option.id.toLowerCase()); }} />)}</div></fieldset>
                <fieldset><legend className="font-semibold text-lux-ink">Enseignements envisagés en Première</legend><div className={`mt-3 ${inputClass}`}>{academicProfiles.PREMIERE.specialtyPlans.map((option) => <ChoiceCard key={option.id} name="premiere-specialty-plan" option={option} checked={profile.premiereSpecialtyPlan === option.id} onChange={() => { setProfile((value) => ({ ...value, premiereSpecialtyPlan: option.id })); track.preRentreeTrackSelected('premiere', option.id.toLowerCase()); }} />)}</div></fieldset>
                {profileIncompatible && <p role="alert" className="rounded-xl border border-lux-gold/40 bg-lux-gold/10 p-3 text-sm text-lux-ink">{compatibility.messages.join(' ')}</p>}
                <div className="flex justify-between gap-3"><button type="button" className={`${buttonClass} border border-lux-line`} onClick={() => continueTo(getPreviousConfiguratorStep(step, level))}>Retour</button><button type="button" className={`${buttonClass} lux-cta-reserve disabled:opacity-50`} disabled={!profileComplete || profileIncompatible} onClick={() => continueTo(3)}>Continuer</button></div>
              </div>
            )}

            {step === 2 && level === 'TERMINALE' && (
              <div className="space-y-6">
                <fieldset>
                  <legend className="font-semibold text-lux-ink">{academicProfiles.TERMINALE.retainedSpecialties.label} — deux maximum</legend>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {academicProfiles.TERMINALE.retainedSpecialties.options.map((option) => (
                      <label key={option.id} className="flex min-h-11 items-center rounded-xl border border-lux-line bg-white px-4 py-3 text-sm text-lux-ink">
                        <input className="mr-3 h-4 w-4 accent-lux-gold" type="checkbox" checked={profile.retainedSpecialties?.includes(option.id) ?? false} onChange={() => { setProfile((value) => ({ ...value, retainedSpecialties: toggleLimitedSelection(value.retainedSpecialties ?? [], option.id, academicProfiles.TERMINALE.retainedSpecialties.maxSelections) })); track.preRentreeTrackSelected('terminale', option.id.toLowerCase()); }} />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset><legend className="font-semibold text-lux-ink">Option de Mathématiques</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">{academicProfiles.TERMINALE.mathsOptions.map((option) => <ChoiceCard key={option.id} name="maths-option" option={option} checked={profile.mathsOption === option.id} onChange={() => { setProfile((value) => ({ ...value, mathsOption: option.id })); track.preRentreeTrackSelected('terminale', option.id.toLowerCase()); }} />)}</div></fieldset>
                {profileIncompatible && <p role="alert" className="rounded-xl border border-lux-gold/40 bg-lux-gold/10 p-3 text-sm text-lux-ink">{compatibility.messages.join(' ')}</p>}
                <div className="flex justify-between gap-3"><button type="button" className={`${buttonClass} border border-lux-line`} onClick={() => continueTo(1)}>Retour</button><button type="button" className={`${buttonClass} lux-cta-reserve disabled:opacity-50`} disabled={!profileComplete || profileIncompatible} onClick={() => continueTo(3)}>Continuer</button></div>
              </div>
            )}

            {step === 3 && level && (
              <fieldset>
                <legend className="font-semibold text-lux-ink">Matières — une à quatre</legend>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {availableSubjects.map((subject) => {
                    const selected = subjectIds.includes(subject.id);
                    const slots = schedule.filter((slot) => slot.level === level && slot.subject === subject.id);
                    const first = slots[0];
                    const label = subject.labelByLevel?.[level] ?? subject.label;
                    const hours = packs.find((pack) => pack.subjectsCount === 1 && pack.level === level)?.totalHours;
                    const theme = getSubjectTheme(subject.id, label);
                    return (
                      <article
                        key={subject.id}
                        data-subject-family={theme.family}
                        className={cn(
                          'min-h-11 rounded-xl border-2 p-4',
                          theme.printClass,
                          selected
                            ? 'border-lux-gold bg-lux-gold/10'
                            : `${theme.borderClass} ${theme.surfaceClass}`,
                        )}
                      >
                        <label className="flex cursor-pointer items-start gap-3"><input className="mt-1 h-4 w-4 accent-lux-gold" type="checkbox" checked={selected} onChange={() => toggleSubject(subject.id)} /><span><SubjectBadge subjectId={subject.id} label={label} /><span className="mt-2 block text-sm text-lux-slate">{subject.summaryByLevel[level]}</span><span className="mt-2 block text-sm text-lux-slate">{slots.length} séances · {hours} heures</span>{first && <span className="block text-sm text-lux-slate">Semaine {first.week} · {first.startTime}–{first.endTime}</span>}</span></label>
                        <a className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-lux-gold-deep underline" href={`#programme-${subject.moduleIdsByLevel[level]}`}>Consulter le programme</a>
                      </article>
                    );
                  })}
                </div>
                <div className="mt-6 flex justify-between gap-3"><button type="button" className={`${buttonClass} border border-lux-line`} onClick={() => continueTo(getPreviousConfiguratorStep(step, level))}>Retour</button><button type="button" className={`${buttonClass} lux-cta-reserve disabled:opacity-50`} disabled={subjectIds.length === 0} onClick={() => continueTo(4)}>Voir mon résumé</button></div>
              </fieldset>
            )}

            {step === 4 && (
              <div>
                <h3 className="font-semibold text-lux-ink">Résumé de votre sélection</h3>
                <p className="mt-2 text-sm text-lux-slate">Vous pouvez modifier vos choix avant d’envoyer votre demande.</p>
                <button type="button" className={`${buttonClass} mt-5 border border-lux-line`} onClick={() => continueTo(3)}>Modifier les matières</button>
              </div>
            )}
          </div>

          <aside className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 lg:top-24 lg:bottom-auto" aria-label="Résumé persistant">
            <SummaryCard
              summary={summary}
              profileComplete={profileComplete}
              notice={groupCompositionNotice}
              publicStatus={campaignPublicStatus}
              expanded={mobileSummaryOpen}
              onToggle={() => setMobileSummaryOpen((open) => !open)}
              onNavigate={() => setMobileSummaryOpen(false)}
            />
          </aside>
        </div>
      </div>
    </section>
  );
}
