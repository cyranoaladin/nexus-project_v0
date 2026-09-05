'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { gradeLevelLabel, trackLabel, courseKindLabel, COURSE_KIND_DISPLAY_ORDER } from '@/lib/aria-preview/labels';
import type { AriaFeatureStatus } from '@/lib/aria-preview/capability-status';
import type { AriaPreviewData, CoursePreviewViewModel } from '@/lib/aria-preview/view-model';

const STATUS_LABEL: Record<AriaFeatureStatus, string> = {
  READY: 'Prêt',
  IN_QUALIFICATION: 'En qualification',
  NOT_CONFIGURED: 'Non configuré',
};

const STATUS_VARIANT: Record<AriaFeatureStatus, 'success' | 'warning' | 'outline'> = {
  READY: 'success',
  IN_QUALIFICATION: 'warning',
  NOT_CONFIGURED: 'outline',
};

const STATUS_RANK: Record<AriaFeatureStatus, number> = {
  NOT_CONFIGURED: 0,
  IN_QUALIFICATION: 1,
  READY: 2,
};

function StatusBadge({ status, label }: { status: AriaFeatureStatus; label?: string }) {
  return <Badge variant={STATUS_VARIANT[status]}>{label ?? STATUS_LABEL[status]}</Badge>;
}

function overallStatus(course: CoursePreviewViewModel): AriaFeatureStatus {
  const ranks = [
    course.summary.skillGraphStatus,
    course.summary.resourcesStatus,
    course.summary.ragStatus,
    course.summary.chatStatus,
  ].map((status) => STATUS_RANK[status]);
  const worst = Math.min(...ranks);
  return (Object.keys(STATUS_RANK) as AriaFeatureStatus[]).find((status) => STATUS_RANK[status] === worst)!;
}

export function AriaPreviewWorkspace({ data }: { data: AriaPreviewData }) {
  const [activeTab, setActiveTab] = useState<'espace' | 'carte'>('espace');

  const defaultGradeLevel = data.gradeLevels.includes('TERMINALE') ? 'TERMINALE' : (data.gradeLevels[0] ?? '');
  const [gradeLevel, setGradeLevel] = useState(defaultGradeLevel);

  const tracksForGrade = data.tracksByGradeLevel[gradeLevel] ?? [];
  const [track, setTrack] = useState(tracksForGrade.includes('EDS_GENERALE') ? 'EDS_GENERALE' : (tracksForGrade[0] ?? ''));

  const coursesForSelection = useMemo(
    () => data.courses.filter((course) => course.gradeLevel === gradeLevel && course.tracks.includes(track)),
    [data.courses, gradeLevel, track],
  );

  const defaultCourseKey = useMemo(() => {
    const nsi = coursesForSelection.find((course) => course.courseKey.includes('nsi'));
    return (nsi ?? coursesForSelection[0])?.courseKey ?? '';
  }, [coursesForSelection]);
  const [courseKey, setCourseKey] = useState(defaultCourseKey);

  const selectedCourse = data.courses.find((course) => course.courseKey === courseKey) ?? coursesForSelection[0];

  const [simulatedSpecialties, setSimulatedSpecialties] = useState<Set<string>>(new Set());

  function selectGradeLevel(nextGradeLevel: string) {
    setGradeLevel(nextGradeLevel);
    const nextTracks = data.tracksByGradeLevel[nextGradeLevel] ?? [];
    const nextTrack = nextTracks.includes('EDS_GENERALE') ? 'EDS_GENERALE' : (nextTracks[0] ?? '');
    setTrack(nextTrack);
    const nextCourses = data.courses.filter(
      (course) => course.gradeLevel === nextGradeLevel && course.tracks.includes(nextTrack),
    );
    setCourseKey(nextCourses[0]?.courseKey ?? '');
    // Les clés simulées appartiennent au niveau précédent : les conserver
    // produirait un compteur faux (ex. "3/2" juste après le changement).
    setSimulatedSpecialties(new Set());
  }

  function selectTrack(nextTrack: string) {
    setTrack(nextTrack);
    const nextCourses = data.courses.filter(
      (course) => course.gradeLevel === gradeLevel && course.tracks.includes(nextTrack),
    );
    setCourseKey(nextCourses[0]?.courseKey ?? '');
    setSimulatedSpecialties(new Set());
  }

  const specialtyRule = data.specialtyRules.find((rule) => rule.gradeLevel === gradeLevel);
  const specialtyCandidates = coursesForSelection.filter((course) => course.kind === 'SPECIALTY');
  const specialtyCandidateKeys = useMemo(
    () => new Set(specialtyCandidates.map((course) => course.courseKey)),
    [specialtyCandidates],
  );
  // Second filet de sécurité : même si l'état simulé n'était pas réinitialisé
  // (ex. état persistant réintroduit plus tard), le compteur ne doit jamais
  // porter une clé qui n'appartient plus à la sélection courante.
  const effectiveSimulatedSpecialties = useMemo(
    () => new Set([...simulatedSpecialties].filter((key) => specialtyCandidateKeys.has(key))),
    [simulatedSpecialties, specialtyCandidateKeys],
  );

  function toggleSpecialty(key: string) {
    setSimulatedSpecialties((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const groupedCourses = COURSE_KIND_DISPLAY_ORDER.map((kind) => ({
    kind,
    courses: coursesForSelection.filter((course) => course.kind === kind),
  })).filter((group) => group.courses.length > 0);

  return (
    <div className="min-h-screen bg-lux-paper text-lux-ink" data-testid="aria-preview-root">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'espace' | 'carte')}>
        <header className="flex flex-col gap-2 border-b border-lux-gold/20 bg-lux-ink px-6 py-4 text-lux-on-dark sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">ARIA</h1>
            <Badge variant="outline" className="border-lux-gold/40 text-lux-gold-wash">
              Aperçu interne • Non commercial
            </Badge>
          </div>
          <TabsList>
            <TabsTrigger value="espace" data-testid="tab-espace">Espace ARIA</TabsTrigger>
            <TabsTrigger value="carte" data-testid="tab-carte-scolaire">Carte scolaire</TabsTrigger>
          </TabsList>
        </header>

        <TabsContent value="carte">
          <CoverageMatrixPanel data={data} />
        </TabsContent>

        <TabsContent value="espace">
          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[280px_1fr_320px] lg:gap-6 lg:p-6">
            <SchoolMapPanel
              data={data}
              gradeLevel={gradeLevel}
              track={track}
              tracksForGrade={tracksForGrade}
              groupedCourses={groupedCourses}
              selectedCourseKey={selectedCourse?.courseKey ?? ''}
              onSelectGradeLevel={selectGradeLevel}
              onSelectTrack={selectTrack}
              onSelectCourse={setCourseKey}
              specialtyRule={specialtyRule}
              specialtyCandidates={specialtyCandidates}
              simulatedSpecialties={effectiveSimulatedSpecialties}
              onToggleSpecialty={toggleSpecialty}
            />

            <AriaWorkspacePanel gradeLevel={gradeLevel} course={selectedCourse} />

            <ConfigurationPanel course={selectedCourse} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SchoolMapPanel(props: {
  data: AriaPreviewData;
  gradeLevel: string;
  track: string;
  tracksForGrade: readonly string[];
  groupedCourses: { kind: string; courses: CoursePreviewViewModel[] }[];
  selectedCourseKey: string;
  onSelectGradeLevel: (gradeLevel: string) => void;
  onSelectTrack: (track: string) => void;
  onSelectCourse: (courseKey: string) => void;
  specialtyRule?: AriaPreviewData['specialtyRules'][number];
  specialtyCandidates: CoursePreviewViewModel[];
  simulatedSpecialties: Set<string>;
  onToggleSpecialty: (courseKey: string) => void;
}) {
  const {
    data, gradeLevel, track, tracksForGrade, groupedCourses, selectedCourseKey,
    onSelectGradeLevel, onSelectTrack, onSelectCourse,
    specialtyRule, specialtyCandidates, simulatedSpecialties, onToggleSpecialty,
  } = props;

  const showSpecialtySimulation = specialtyRule !== undefined && specialtyCandidates.length > 0;
  const overLimit = specialtyRule ? simulatedSpecialties.size > specialtyRule.maxSpecialties : false;

  return (
    <section className="space-y-4 rounded-2xl border border-lux-gold/15 bg-white/60 p-4" aria-label="Carte scolaire">
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-lux-slate">Niveau</h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Niveau">
          {data.gradeLevels.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={level === gradeLevel}
              data-testid={`grade-level-${level}`}
              onClick={() => onSelectGradeLevel(level)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                level === gradeLevel
                  ? 'bg-lux-ink text-lux-on-dark'
                  : 'bg-lux-ivory text-lux-ink hover:bg-lux-gold-wash'
              }`}
            >
              {gradeLevelLabel(level)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-lux-slate">Voie</h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Voie">
          {tracksForGrade.map((candidateTrack) => (
            <button
              key={candidateTrack}
              type="button"
              aria-pressed={candidateTrack === track}
              data-testid={`track-${candidateTrack}`}
              onClick={() => onSelectTrack(candidateTrack)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                candidateTrack === track
                  ? 'border-lux-gold bg-lux-gold-wash text-lux-ink'
                  : 'border-lux-gold/20 text-lux-slate hover:border-lux-gold/50'
              }`}
            >
              {trackLabel(candidateTrack)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-lux-slate">Enseignements</h2>
        {groupedCourses.map((group) => (
          <div key={group.kind}>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-lux-gold-deep">
              {courseKindLabel(group.kind)}
            </p>
            <ul className="space-y-1">
              {group.courses.map((course) => (
                <li key={course.courseKey}>
                  <button
                    type="button"
                    aria-pressed={course.courseKey === selectedCourseKey}
                    data-testid={`course-${course.courseKey}`}
                    onClick={() => onSelectCourse(course.courseKey)}
                    className={`flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                      course.courseKey === selectedCourseKey
                        ? 'bg-lux-ink text-lux-on-dark'
                        : 'text-lux-ink hover:bg-lux-ivory'
                    }`}
                  >
                    <span>{course.label}</span>
                    <span
                      className={`text-[10px] ${
                        course.courseKey === selectedCourseKey ? 'text-lux-on-dark-subtle' : 'text-lux-slate'
                      }`}
                    >
                      {course.courseKey}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {showSpecialtySimulation && specialtyRule && (
        <div className="rounded-xl border border-lux-gold/20 bg-lux-ivory p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-lux-slate">
            Carte académique simulée
          </p>
          {specialtyRule.note && (
            <p className="mb-2 text-xs text-lux-slate" data-testid="specialty-rule-note">
              {specialtyRule.note}
            </p>
          )}
          <ul className="space-y-1.5">
            {specialtyCandidates.map((course) => (
              <li key={course.courseKey} className="flex items-center gap-2">
                <Checkbox
                  id={`specialty-${course.courseKey}`}
                  data-testid={`specialty-checkbox-${course.courseKey}`}
                  checked={simulatedSpecialties.has(course.courseKey)}
                  onCheckedChange={() => onToggleSpecialty(course.courseKey)}
                />
                <label htmlFor={`specialty-${course.courseKey}`} className="text-sm text-lux-ink">
                  {course.label}
                </label>
              </li>
            ))}
          </ul>
          <p
            data-testid="specialty-count"
            className={`mt-2 text-xs ${overLimit ? 'font-semibold text-red-600' : 'text-lux-slate'}`}
          >
            {simulatedSpecialties.size} / {specialtyRule.maxSpecialties} spécialités sélectionnées
            {overLimit ? ' — dépasse la règle en vigueur' : ''}
          </p>
        </div>
      )}
    </section>
  );
}

function AriaWorkspacePanel({ gradeLevel, course }: { gradeLevel: string; course?: CoursePreviewViewModel }) {
  if (!course) {
    return (
      <section className="rounded-2xl border border-lux-gold/15 bg-white/60 p-6 text-sm text-lux-slate">
        Aucun enseignement disponible pour cette sélection.
      </section>
    );
  }

  const overall = overallStatus(course);

  return (
    <section className="flex flex-col rounded-2xl border border-lux-gold/15 bg-white/60 p-4" aria-label="Espace ARIA">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-lux-ink">ARIA — Assistant pédagogique</h2>
          <p className="text-sm text-lux-slate" data-testid="workspace-subtitle">
            {gradeLevelLabel(gradeLevel)} • {course.label}
          </p>
        </div>
        <StatusBadge status={overall} />
      </div>

      <div className="mb-3 flex-1 rounded-xl border border-dashed border-lux-gold/25 bg-lux-ivory/60 p-4">
        <p className="text-xs uppercase tracking-wide text-lux-slate">Historique</p>
        <p className="mt-2 text-sm text-lux-slate">Aucune conversation dans cet aperçu.</p>
      </div>

      <div className="rounded-xl border border-lux-gold/20 bg-lux-gold-wash/40 p-3 text-sm text-lux-ink">
        Conversation non activée dans cet aperçu. Le moteur documentaire et le modèle sont en cours de qualification.
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          disabled
          placeholder="Écrire à ARIA…"
          data-testid="aria-preview-input"
          className="flex-1 rounded-lg border border-lux-gold/20 bg-white/70 px-3 py-2 text-sm text-lux-slate placeholder:text-lux-slate/70 disabled:cursor-not-allowed"
        />
        <Button disabled data-testid="aria-preview-send">
          Envoyer
        </Button>
      </div>
    </section>
  );
}

function ConfigurationPanel({ course }: { course?: CoursePreviewViewModel }) {
  if (!course) return null;
  const { summary } = course;

  return (
    <section className="space-y-4 rounded-2xl border border-lux-gold/15 bg-white/60 p-4" aria-label="Configuration ARIA">
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-lux-slate">Cours sélectionné</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-lux-slate">Niveau</dt>
            <dd className="text-lux-ink">{gradeLevelLabel(course.gradeLevel)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-lux-slate">Voie</dt>
            <dd className="text-right text-lux-ink">{course.tracks.map(trackLabel).join(', ')}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-lux-slate">Type</dt>
            <dd className="text-lux-ink">{courseKindLabel(course.kind)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-lux-slate">courseKey</dt>
            <dd className="font-mono text-[11px] text-lux-slate">{course.courseKey}</dd>
          </div>
        </dl>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-lux-slate">Capacités ARIA</h2>
        <ul className="space-y-1.5 text-sm">
          <li className="flex items-center justify-between">
            <span className="text-lux-ink">Skill graph</span>
            <StatusBadge
              status={summary.skillGraphStatus}
              label={
                summary.skillGraphStatus === 'READY'
                  ? `Prêt (${summary.skillGraphCompetencyCount} compétences)`
                  : undefined
              }
            />
          </li>
          <li className="flex items-center justify-between">
            <span className="text-lux-ink">Ressources</span>
            <StatusBadge status={summary.resourcesStatus} />
          </li>
          <li className="flex items-center justify-between">
            <span className="text-lux-ink">RAG corpus</span>
            <StatusBadge status={summary.ragStatus} />
          </li>
          <li className="flex items-center justify-between">
            <span className="text-lux-ink">Chat</span>
            <StatusBadge status={summary.chatStatus} label={summary.chatStatus === 'NOT_CONFIGURED' ? 'Non activé' : undefined} />
          </li>
        </ul>
        {course.ragVolumetry && (
          <p className="mt-2 rounded-lg bg-lux-ivory p-2 text-xs text-lux-slate" data-testid="rag-volumetry">
            Corpus canonique attendu : {course.ragVolumetry.expectedArtifacts} ressources ·{' '}
            {course.ragVolumetry.expectedChunks} chunks atteignables.
            <br />
            RAG runtime : non connecté (qualification en cours).
          </p>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-lux-slate">Modèle IA</h2>
        <p className="text-sm text-lux-ink">Non activé pour cet aperçu.</p>
        <p className="mt-1 text-xs text-lux-slate">Candidat canary prévu : GPT-5 mini via OpenRouter.</p>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-lux-slate">Sources académiques</h2>
        <ul className="space-y-1.5">
          {course.sources.map((source) => (
            <li key={source.id} className="text-sm text-lux-ink">
              {source.label}
              <details className="mt-0.5">
                <summary className="cursor-pointer text-[11px] text-lux-slate">Détail technique</summary>
                <span className="font-mono text-[10px] text-lux-slate">{source.id}</span>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CoverageMatrixPanel({ data }: { data: AriaPreviewData }) {
  return (
    <div className="p-4 lg:p-6">
      <div className="overflow-x-auto rounded-2xl border border-lux-gold/15 bg-white/60">
        <table className="w-full min-w-[640px] text-left text-sm" data-testid="coverage-matrix-table">
          <thead>
            <tr className="border-b border-lux-gold/15 text-xs uppercase tracking-wide text-lux-slate">
              <th className="px-4 py-3">Niveau</th>
              <th className="px-4 py-3">Voie</th>
              <th className="px-4 py-3 text-right">Enseignements</th>
              <th className="px-4 py-3 text-right">RAG déclaré / qualification</th>
              <th className="px-4 py-3 text-right">Chat déclaré / qualification</th>
              <th className="px-4 py-3 text-right">Skill graph</th>
            </tr>
          </thead>
          <tbody>
            {data.coverageMatrix.map((row) => (
              <tr key={`${row.gradeLevel}-${row.track}`} className="border-b border-lux-gold/10">
                <td className="px-4 py-2 text-lux-ink">{gradeLevelLabel(row.gradeLevel)}</td>
                <td className="px-4 py-2 text-lux-ink">{trackLabel(row.track)}</td>
                <td className="px-4 py-2 text-right text-lux-ink">{row.courseCount}</td>
                <td className="px-4 py-2 text-right text-lux-ink">
                  {row.ragDeclaredOrQualificationCount}/{row.courseCount}
                </td>
                <td className="px-4 py-2 text-right text-lux-ink">
                  {row.chatDeclaredOrQualificationCount}/{row.courseCount}
                </td>
                <td className="px-4 py-2 text-right text-lux-ink">
                  {row.skillGraphReadyCount}/{row.courseCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
