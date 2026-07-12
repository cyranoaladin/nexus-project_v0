'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { track } from '@/lib/analytics';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import {
  buildBilanUrl,
  buildSelectionSummary,
  buildWhatsAppMessage,
  getNextConfiguratorStep,
  getPreviousConfiguratorStep,
  toggleLimitedSelection,
  type AcademicProfileSelection,
  type LandingLevel,
  type LandingPack,
  type LandingScheduleSlot,
  type LandingSubject,
  type SelectionSummary,
} from '@/lib/campaigns/pre-rentree-2026/configurator';

interface ProfileOption {
  id: string;
  label: string;
}

interface AcademicProfiles {
  SECONDE: Record<string, never>;
  PREMIERE: {
    voies: ProfileOption[];
    mathsProfiles: ProfileOption[];
    eafProfiles: ProfileOption[];
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
  campaignStatus: string;
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

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-TN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Tunis',
  }).format(new Date(`${date}T12:00:00+01:00`));
}

function SummaryCard({
  summary,
  notice,
  status,
  expanded,
  onToggle,
  onNavigate,
}: {
  summary: SelectionSummary | null;
  notice: string;
  status: string;
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

  if (!summary.pack) {
    return (
      <div aria-live="polite" className="rounded-2xl border border-lux-line bg-lux-paper p-5">
        <h3 className="font-semibold text-lux-ink">Votre résumé</h3>
        <p className="mt-2 text-sm text-lux-slate">Sélectionnez au moins une matière pour afficher le pack.</p>
      </div>
    );
  }

  const bilanUrl = buildBilanUrl({
    packId: summary.pack.id,
    level: summary.level,
    subjectIds: summary.subjectIds,
    profile: summary.profile,
  });
  const whatsappUrl = buildWhatsAppUrl(buildWhatsAppMessage(summary), { exactMessage: true });
  const pack = summary.pack;

  return (
    <div aria-live="polite" className="max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-lux-gold/40 bg-lux-paper p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-lux-ink">Votre résumé</h3>
        <span className="rounded-full bg-lux-evergreen/10 px-3 py-1 text-xs font-semibold text-lux-evergreen">{status}</span>
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
        <div className="flex justify-between gap-4"><dt className="text-lux-slate">Niveau</dt><dd className="text-right font-medium text-lux-ink">{summary.levelLabel}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-lux-slate">Profil</dt><dd className="text-right font-medium text-lux-ink">{summary.profileLabel}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-lux-slate">Matières</dt><dd className="text-right font-medium text-lux-ink">{summary.subjectLabels.join(', ')}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-lux-slate">Volume</dt><dd className="font-medium text-lux-ink">{summary.sessionCount} séances · {summary.totalHours} heures</dd></div>
      </dl>
      <ul className="mt-4 space-y-2 border-t border-lux-line pt-4 text-xs text-lux-slate">
        {summary.scheduleLines.map((line) => (
          <li key={line.subjectId}>
            <strong className="text-lux-ink">{line.subjectLabel}</strong><br />
            {line.dates.map(formatDate).join(', ')} · {line.startTime}–{line.endTime}
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
        <Link
          href={bilanUrl}
          onClick={() => {
            onNavigate();
            track.preRentreeBilanClicked('configurator_summary', pack.id);
            track.preRentreePreregistrationStarted(pack.id, summary.level, summary.subjectIds.length);
          }}
          className="lux-cta-reserve flex min-h-11 items-center justify-center rounded-lg px-4 py-3 text-center text-sm font-semibold"
        >
          Poursuivre vers le bilan prérempli
        </Link>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            onNavigate();
            track.preRentreeWhatsAppClicked('configurator_summary', pack.id);
          }}
          className="flex min-h-11 items-center justify-center rounded-lg border border-lux-evergreen px-4 py-3 text-center text-sm font-semibold text-lux-evergreen"
        >
          Vérifier sur WhatsApp <span className="sr-only">(nouvel onglet)</span>
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
  campaignStatus,
}: StageConfiguratorProps) {
  const [step, setStep] = useState(1);
  const [level, setLevel] = useState<string | null>(null);
  const [profile, setProfile] = useState<AcademicProfileSelection>({});
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

  const availableSubjects = useMemo(
    () => (level ? subjects.filter((subject) => subject.levels.includes(level)) : []),
    [level, subjects],
  );
  const summary = useMemo(
    () =>
      level
        ? buildSelectionSummary({ level, profile, subjectIds, levels, subjects, packs, schedule })
        : null,
    [level, profile, subjectIds, levels, subjects, packs, schedule],
  );
  const profileComplete =
    level === 'SECONDE' ||
    (level === 'PREMIERE' && Boolean(profile.voie && profile.mathsProfile && profile.eafProfile)) ||
    (level === 'TERMINALE' && Boolean(profile.mathsOption));

  function chooseLevel(nextLevel: string) {
    setLevel(nextLevel);
    setProfile({});
    setSubjectIds([]);
    setMobileSummaryOpen(false);
    track.preRentreeLevelSelected(nextLevel.toLowerCase());
  }

  function toggleSubject(subjectId: string) {
    const next = subjectIds.includes(subjectId)
      ? subjectIds.filter((id) => id !== subjectId)
      : [...subjectIds, subjectId];
    setSubjectIds(next);
    track.preRentreeSubjectSelected(subjectId.toLowerCase(), next.length);
  }

  function continueTo(nextStep: number) {
    setStep(nextStep);
    if (nextStep === 4 && summary?.pack) {
      setMobileSummaryOpen(true);
      track.preRentreePriceSummaryViewed(summary.pack.id);
    }
  }

  const inputClass = 'grid gap-3 sm:grid-cols-2';
  const buttonClass = 'min-h-11 rounded-lg px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lux-gold';

  return (
    <section id="configurateur" className="scroll-mt-24 bg-white px-4 py-14 md:py-20" aria-labelledby="configurator-heading">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="sr-only">Statut de campagne : {campaignStatus}</p>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lux-gold-deep">Pré-inscription sans paiement</p>
          <h2 id="configurator-heading" className="mt-3 font-fraunces text-3xl text-lux-ink md:text-4xl">Composer le stage de votre enfant</h2>
          <p className="mt-3 text-lux-slate">Sélectionnez le niveau, le profil et les matières pour obtenir un résumé exact.</p>
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-lux-line bg-lux-paper p-5 sm:p-7">
            <p className="mb-6 text-sm font-medium text-lux-slate">Étape {level === 'SECONDE' && step >= 3 ? step - 1 : step} sur {level === 'SECONDE' ? 3 : 4}</p>

            {step === 1 && (
              <fieldset>
                <legend className="font-semibold text-lux-ink">Classe de rentrée 2026</legend>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
                <fieldset><legend className="font-semibold text-lux-ink">Voie</legend><div className={`mt-3 ${inputClass}`}>{academicProfiles.PREMIERE.voies.map((option) => <ChoiceCard key={option.id} name="voie" option={option} checked={profile.voie === option.id} onChange={() => { setProfile((value) => ({ ...value, voie: option.id })); track.preRentreeTrackSelected(option.id.toLowerCase()); }} />)}</div></fieldset>
                <fieldset><legend className="font-semibold text-lux-ink">Profil Mathématiques</legend><div className={`mt-3 ${inputClass}`}>{academicProfiles.PREMIERE.mathsProfiles.map((option) => <ChoiceCard key={option.id} name="maths-profile" option={option} checked={profile.mathsProfile === option.id} onChange={() => setProfile((value) => ({ ...value, mathsProfile: option.id }))} />)}</div></fieldset>
                <fieldset><legend className="font-semibold text-lux-ink">Profil Français EAF</legend><div className={`mt-3 ${inputClass}`}>{academicProfiles.PREMIERE.eafProfiles.map((option) => <ChoiceCard key={option.id} name="eaf-profile" option={option} checked={profile.eafProfile === option.id} onChange={() => setProfile((value) => ({ ...value, eafProfile: option.id }))} />)}</div></fieldset>
                <div className="flex justify-between gap-3"><button type="button" className={`${buttonClass} border border-lux-line`} onClick={() => continueTo(getPreviousConfiguratorStep(step, level))}>Retour</button><button type="button" className={`${buttonClass} lux-cta-reserve disabled:opacity-50`} disabled={!profileComplete} onClick={() => continueTo(3)}>Continuer</button></div>
              </div>
            )}

            {step === 2 && level === 'TERMINALE' && (
              <div className="space-y-6">
                <fieldset>
                  <legend className="font-semibold text-lux-ink">{academicProfiles.TERMINALE.retainedSpecialties.label} — deux maximum</legend>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {academicProfiles.TERMINALE.retainedSpecialties.options.map((option) => (
                      <label key={option.id} className="flex min-h-11 items-center rounded-xl border border-lux-line bg-white px-4 py-3 text-sm text-lux-ink">
                        <input className="mr-3 h-4 w-4 accent-lux-gold" type="checkbox" checked={profile.retainedSpecialties?.includes(option.id) ?? false} onChange={() => setProfile((value) => ({ ...value, retainedSpecialties: toggleLimitedSelection(value.retainedSpecialties ?? [], option.id, academicProfiles.TERMINALE.retainedSpecialties.maxSelections) }))} />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset><legend className="font-semibold text-lux-ink">Option de Mathématiques</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">{academicProfiles.TERMINALE.mathsOptions.map((option) => <ChoiceCard key={option.id} name="maths-option" option={option} checked={profile.mathsOption === option.id} onChange={() => setProfile((value) => ({ ...value, mathsOption: option.id }))} />)}</div></fieldset>
                <div className="flex justify-between gap-3"><button type="button" className={`${buttonClass} border border-lux-line`} onClick={() => continueTo(1)}>Retour</button><button type="button" className={`${buttonClass} lux-cta-reserve disabled:opacity-50`} disabled={!profileComplete} onClick={() => continueTo(3)}>Continuer</button></div>
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
                    const hours = packs.find((pack) => pack.subjectsCount === 1)?.totalHours;
                    return (
                      <label key={subject.id} className={`min-h-11 cursor-pointer rounded-xl border-2 p-4 ${selected ? 'border-lux-gold bg-lux-gold/10' : 'border-lux-line bg-white'}`}>
                        <span className="flex items-start gap-3"><input className="mt-1 h-4 w-4 accent-lux-gold" type="checkbox" checked={selected} onChange={() => toggleSubject(subject.id)} /><span><strong className="block text-lux-ink">{label}</strong><span className="mt-1 block text-sm text-lux-slate">{slots.length} séances · {hours} heures</span>{first && <span className="block text-sm text-lux-slate">Semaine {first.week} · {first.startTime}–{first.endTime}</span>}<a className="mt-2 inline-block text-sm font-semibold text-lux-gold-deep underline" href={`#programme-${subject.id.toLowerCase()}`}>Consulter le programme</a></span></span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-6 flex justify-between gap-3"><button type="button" className={`${buttonClass} border border-lux-line`} onClick={() => continueTo(getPreviousConfiguratorStep(step, level))}>Retour</button><button type="button" className={`${buttonClass} lux-cta-reserve disabled:opacity-50`} disabled={subjectIds.length === 0} onClick={() => continueTo(4)}>Voir mon résumé</button></div>
              </fieldset>
            )}

            {step === 4 && (
              <div>
                <h3 className="font-semibold text-lux-ink">Résumé de votre sélection</h3>
                <p className="mt-2 text-sm text-lux-slate">Vous pouvez modifier vos choix avant de poursuivre vers le formulaire.</p>
                <button type="button" className={`${buttonClass} mt-5 border border-lux-line`} onClick={() => continueTo(3)}>Modifier les matières</button>
              </div>
            )}
          </div>

          <aside className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 lg:top-24 lg:bottom-auto" aria-label="Résumé persistant">
            <SummaryCard
              summary={summary}
              notice={groupCompositionNotice}
              status={campaignStatus}
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
