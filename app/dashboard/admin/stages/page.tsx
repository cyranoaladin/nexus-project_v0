'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';

import { DashboardPilotage } from '@/components/dashboard/DashboardPilotage';
import { WeeklyCalendar, type CalendarSession } from '@/components/stages/WeeklyCalendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type StageType = 'INTENSIF' | 'SEMAINE_BLANCHE' | 'BILAN' | 'GRAND_ORAL' | 'BAC_FRANCAIS';
type Subject =
  | 'MATHEMATIQUES'
  | 'NSI'
  | 'FRANCAIS'
  | 'PHILOSOPHIE'
  | 'HISTOIRE_GEO'
  | 'ANGLAIS'
  | 'ESPAGNOL'
  | 'PHYSIQUE_CHIMIE'
  | 'SVT'
  | 'SES';

interface ReservationCounts {
  PENDING: number;
  CONFIRMED: number;
  WAITLISTED: number;
  CANCELLED: number;
  COMPLETED: number;
}

interface AdminStage {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  type: StageType;
  subject: Subject[];
  level: string[];
  startDate: string;
  endDate: string;
  capacity: number;
  priceAmount: number;
  priceCurrency: string;
  location?: string | null;
  isVisible: boolean;
  isOpen: boolean;
  reservationCounts: ReservationCounts;
  confirmedCount: number;
  pendingCount: number;
  waitlistedCount: number;
  publishedBilans: number;
  totalBilans: number;
}

interface StageKpis {
  activeStages: number;
  totalInscrits: number;
  caEstime: number;
  bilansPublies: number;
  totalBilans: number;
}

interface CoachOption {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  profile?: {
    id?: string;
    pseudonym?: string;
    subjects?: Subject[] | string;
  } | null;
}

interface StageSession {
  id: string;
  title: string;
  subject: Subject;
  startAt: string;
  endAt: string;
  location?: string | null;
  description?: string | null;
  coachId?: string | null;
  coach?: {
    id: string;
    pseudonym: string;
    subjects?: Subject[] | string;
  } | null;
}

interface StageCoachAssignment {
  id: string;
  role?: string | null;
  coachId: string;
  coach: {
    id: string;
    pseudonym: string;
    subjects?: Subject[] | string;
    description?: string | null;
  };
}

interface StageBilan {
  id: string;
  scoreGlobal?: number | null;
  createdAt: string;
  updatedAt: string;
  isPublished: boolean;
  pdfUrl?: string | null;
  contentEleve: string;
  contentParent: string;
  strengths: string[];
  areasForGrowth: string[];
  nextSteps?: string | null;
  coach: { pseudonym: string };
  student: {
    user?: {
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  };
}

interface StageDetail extends AdminStage {
  sessions: StageSession[];
  coaches: StageCoachAssignment[];
  bilans: StageBilan[];
}

interface StageFormState {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  type: StageType;
  subject: Subject[];
  level: string[];
  startDate: string;
  endDate: string;
  capacity: number;
  priceAmount: number;
  priceCurrency: string;
  location: string;
  isVisible: boolean;
  isOpen: boolean;
}

interface SessionFormState {
  title: string;
  subject: Subject;
  startAt: string;
  endAt: string;
  location: string;
  coachId: string;
  description: string;
}

interface CoachFormState {
  coachId: string;
  role: string;
}

const stageTypeOptions: Array<{ value: StageType; label: string }> = [
  { value: 'INTENSIF', label: 'Intensif' },
  { value: 'SEMAINE_BLANCHE', label: 'Semaine blanche' },
  { value: 'BILAN', label: 'Bilan' },
  { value: 'GRAND_ORAL', label: 'Grand Oral' },
  { value: 'BAC_FRANCAIS', label: 'Bac Français' },
];

const subjectOptions: Array<{ value: Subject; label: string }> = [
  { value: 'MATHEMATIQUES', label: 'Mathématiques' },
  { value: 'NSI', label: 'NSI' },
  { value: 'FRANCAIS', label: 'Français' },
  { value: 'PHILOSOPHIE', label: 'Philosophie' },
  { value: 'HISTOIRE_GEO', label: 'Histoire-Géo' },
  { value: 'ANGLAIS', label: 'Anglais' },
  { value: 'ESPAGNOL', label: 'Espagnol' },
  { value: 'PHYSIQUE_CHIMIE', label: 'Physique-Chimie' },
  { value: 'SVT', label: 'SVT' },
  { value: 'SES', label: 'SES' },
];

const levelOptions = ['3ème', 'Première', 'Terminale'];

const emptyStageForm: StageFormState = {
  slug: '',
  title: '',
  subtitle: '',
  description: '',
  type: 'INTENSIF',
  subject: [],
  level: [],
  startDate: '',
  endDate: '',
  capacity: 12,
  priceAmount: 0,
  priceCurrency: 'TND',
  location: '',
  isVisible: true,
  isOpen: true,
};

const emptySessionForm: SessionFormState = {
  title: '',
  subject: 'MATHEMATIQUES',
  startAt: '',
  endAt: '',
  location: '',
  coachId: '',
  description: '',
};

const emptyCoachForm: CoachFormState = {
  coachId: '',
  role: '',
};

function slugify(value: string) {
  return value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - timezoneOffset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function formatDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${start.toLocaleDateString('fr-FR')} – ${end.toLocaleDateString('fr-FR')}`;
}

function formatPrice(amount: number, currency: string) {
  return `${amount.toLocaleString('fr-FR')} ${currency}`;
}

function getStatusBadge(isOpen: boolean) {
  return isOpen
    ? <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Ouvert</Badge>
    : <Badge className="bg-slate-500/15 text-slate-300 border border-slate-500/30">Fermé</Badge>;
}

function getBilanStatusBadge(isPublished: boolean) {
  return isPublished
    ? <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Publié</Badge>
    : <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30">Brouillon</Badge>;
}

function normalizeSubjects(subjects?: Subject[] | string) {
  if (Array.isArray(subjects)) return subjects;
  if (typeof subjects === 'string') {
    try {
      const parsed = JSON.parse(subjects);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function StageFormFields({
  form,
  onChange,
  slugDisabled = false,
  onSlugEdited,
}: {
  form: StageFormState;
  onChange: (next: StageFormState) => void;
  slugDisabled?: boolean;
  onSlugEdited?: () => void;
}) {
  const toggleSubject = (subject: Subject) => {
    onChange({
      ...form,
      subject: form.subject.includes(subject)
        ? form.subject.filter((item) => item !== subject)
        : [...form.subject, subject],
    });
  };

  const toggleLevel = (level: string) => {
    onChange({
      ...form,
      level: form.level.includes(level)
        ? form.level.filter((item) => item !== level)
        : [...form.level, level],
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="stage-title" className="text-neutral-200">Titre</Label>
          <Input
            id="stage-title"
            value={form.title}
            onChange={(event) => onChange({ ...form, title: event.target.value })}
            className="bg-surface-elevated border-white/15 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stage-slug" className="text-neutral-200">Slug</Label>
          <Input
            id="stage-slug"
            value={form.slug}
            disabled={slugDisabled}
            onChange={(event) => {
              onSlugEdited?.();
              onChange({ ...form, slug: event.target.value });
            }}
            className="bg-surface-elevated border-white/15 text-white"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="stage-subtitle" className="text-neutral-200">Sous-titre</Label>
        <Input
          id="stage-subtitle"
          value={form.subtitle}
          onChange={(event) => onChange({ ...form, subtitle: event.target.value })}
          className="bg-surface-elevated border-white/15 text-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="stage-description" className="text-neutral-200">Description</Label>
        <Textarea
          id="stage-description"
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
          className="min-h-[120px] bg-surface-elevated border-white/15 text-white"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-neutral-200">Type</Label>
          <Select value={form.type} onValueChange={(value: StageType) => onChange({ ...form, type: value })}>
            <SelectTrigger className="bg-surface-elevated border-white/15 text-white">
              <SelectValue placeholder="Choisir un type" />
            </SelectTrigger>
            <SelectContent>
              {stageTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="stage-location" className="text-neutral-200">Lieu</Label>
          <Input
            id="stage-location"
            value={form.location}
            onChange={(event) => onChange({ ...form, location: event.target.value })}
            className="bg-surface-elevated border-white/15 text-white"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-neutral-200">Matières</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {subjectOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200">
              <Checkbox checked={form.subject.includes(option.value)} onCheckedChange={() => toggleSubject(option.value)} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-neutral-200">Niveaux</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {levelOptions.map((level) => (
            <label key={level} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200">
              <Checkbox checked={form.level.includes(level)} onCheckedChange={() => toggleLevel(level)} />
              <span>{level}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="stage-start" className="text-neutral-200">Début</Label>
          <Input
            id="stage-start"
            type="datetime-local"
            value={form.startDate}
            onChange={(event) => onChange({ ...form, startDate: event.target.value })}
            className="bg-surface-elevated border-white/15 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stage-end" className="text-neutral-200">Fin</Label>
          <Input
            id="stage-end"
            type="datetime-local"
            value={form.endDate}
            onChange={(event) => onChange({ ...form, endDate: event.target.value })}
            className="bg-surface-elevated border-white/15 text-white"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="stage-capacity" className="text-neutral-200">Capacité</Label>
          <Input
            id="stage-capacity"
            type="number"
            min={1}
            max={50}
            value={form.capacity}
            onChange={(event) => onChange({ ...form, capacity: Number(event.target.value) })}
            className="bg-surface-elevated border-white/15 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stage-price" className="text-neutral-200">Prix</Label>
          <Input
            id="stage-price"
            type="number"
            min={0}
            value={form.priceAmount}
            onChange={(event) => onChange({ ...form, priceAmount: Number(event.target.value) })}
            className="bg-surface-elevated border-white/15 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stage-currency" className="text-neutral-200">Devise</Label>
          <Input
            id="stage-currency"
            value={form.priceCurrency}
            onChange={(event) => onChange({ ...form, priceCurrency: event.target.value })}
            className="bg-surface-elevated border-white/15 text-white"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between md:gap-3">
          <Label htmlFor="stage-visible" className="text-neutral-200">Visible</Label>
          <Switch
            id="stage-visible"
            checked={form.isVisible}
            onCheckedChange={(checked) => onChange({ ...form, isVisible: checked })}
          />
        </div>
        <div className="flex items-center justify-between md:gap-3">
          <Label htmlFor="stage-open" className="text-neutral-200">Inscriptions ouvertes</Label>
          <Switch
            id="stage-open"
            checked={form.isOpen}
            onCheckedChange={(checked) => onChange({ ...form, isOpen: checked })}
          />
        </div>
      </div>
    </div>
  );
}

export default function AdminStagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stages, setStages] = useState<AdminStage[]>([]);
  const [kpis, setKpis] = useState<StageKpis | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [selectedStageDetail, setSelectedStageDetail] = useState<StageDetail | null>(null);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [createForm, setCreateForm] = useState<StageFormState>(emptyStageForm);
  const [createSlugTouched, setCreateSlugTouched] = useState(false);
  const [editForm, setEditForm] = useState<StageFormState>(emptyStageForm);
  const [editingStage, setEditingStage] = useState<AdminStage | null>(null);
  const [sessionForm, setSessionForm] = useState<SessionFormState>(emptySessionForm);
  const [coachForm, setCoachForm] = useState<CoachFormState>(emptyCoachForm);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [isCoachDialogOpen, setIsCoachDialogOpen] = useState(false);
  const [viewedBilan, setViewedBilan] = useState<StageBilan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedStage = useMemo(
    () => stages.find((stage) => stage.id === selectedStageId) ?? null,
    [selectedStageId, stages]
  );

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const loadStages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/stages');
      const data = await response.json() as { stages: AdminStage[]; kpis: StageKpis; error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Erreur de chargement des stages');
      }

      setStages(data.stages ?? []);
      setKpis(data.kpis ?? null);
      setSelectedStageId((current) => current || data.stages?.[0]?.id || '');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erreur de chargement des stages', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadStageDetail = useCallback(async (stageId: string) => {
    if (!stageId) {
      setSelectedStageDetail(null);
      return;
    }

    setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/stages/${stageId}`);
      const data = await response.json() as { stage?: StageDetail; error?: string };

      if (!response.ok || !data.stage) {
        throw new Error(data.error || 'Erreur de chargement du détail du stage');
      }

      setSelectedStageDetail({
        ...data.stage,
        priceAmount: Number(data.stage.priceAmount),
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erreur de chargement du stage', 'error');
    } finally {
      setDetailLoading(false);
    }
  }, [showToast]);

  const loadCoaches = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users?role=COACH&limit=100');
      const data = await response.json() as { users: CoachOption[] };
      if (response.ok) {
        setCoaches(data.users ?? []);
      }
    } catch {
      showToast('Impossible de charger les coachs.', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/signin');
      return;
    }

    loadStages();
    loadCoaches();
  }, [session, status, router, loadStages, loadCoaches]);

  useEffect(() => {
    if (!selectedStageId) return;
    loadStageDetail(selectedStageId);
  }, [selectedStageId, loadStageDetail]);

  useEffect(() => {
    if (!createSlugTouched) {
      setCreateForm((current) => ({
        ...current,
        slug: slugify(current.title),
      }));
    }
  }, [createForm.title, createSlugTouched]);

  const submitCreateStage = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          startDate: new Date(createForm.startDate).toISOString(),
          endDate: new Date(createForm.endDate).toISOString(),
        }),
      });
      const data = await response.json() as { error?: string; stage?: AdminStage };

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création du stage');
      }

      showToast('Stage créé avec succès.');
      setCreateForm(emptyStageForm);
      setCreateSlugTouched(false);
      setActiveTab('overview');
      await loadStages();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erreur lors de la création du stage', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitEditStage = async () => {
    if (!editingStage) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/stages/${editingStage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          startDate: new Date(editForm.startDate).toISOString(),
          endDate: new Date(editForm.endDate).toISOString(),
        }),
      });
      const data = await response.json() as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la mise à jour du stage');
      }

      showToast('Stage mis à jour.');
      setIsEditDialogOpen(false);
      setEditingStage(null);
      await loadStages();
      await loadStageDetail(editingStage.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erreur lors de la mise à jour du stage', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const archiveStage = async (stage: AdminStage) => {
    if (!window.confirm(`Archiver le stage "${stage.title}" ?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/stages/${stage.id}`, { method: 'DELETE' });
      const data = await response.json() as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l’archivage du stage');
      }

      showToast('Stage archivé.');
      await loadStages();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erreur lors de l’archivage du stage', 'error');
    }
  };

  const openEditDialog = (stage: AdminStage) => {
    setEditingStage(stage);
    setEditForm({
      slug: stage.slug,
      title: stage.title,
      subtitle: stage.subtitle || '',
      description: stage.description || '',
      type: stage.type,
      subject: stage.subject,
      level: stage.level,
      startDate: toDateTimeLocalValue(stage.startDate),
      endDate: toDateTimeLocalValue(stage.endDate),
      capacity: stage.capacity,
      priceAmount: stage.priceAmount,
      priceCurrency: stage.priceCurrency,
      location: stage.location || '',
      isVisible: stage.isVisible,
      isOpen: stage.isOpen,
    });
    setIsEditDialogOpen(true);
  };

  const submitSession = async () => {
    if (!selectedStageId) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/stages/${selectedStageId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sessionForm,
          coachId: sessionForm.coachId || undefined,
          location: sessionForm.location || undefined,
          description: sessionForm.description || undefined,
          startAt: new Date(sessionForm.startAt).toISOString(),
          endAt: new Date(sessionForm.endAt).toISOString(),
        }),
      });
      const data = await response.json() as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création de la séance');
      }

      showToast('Séance ajoutée.');
      setSessionForm(emptySessionForm);
      setIsSessionDialogOpen(false);
      await loadStageDetail(selectedStageId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erreur lors de la création de la séance', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitCoachAssignment = async () => {
    if (!selectedStageId) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/stages/${selectedStageId}/coaches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: coachForm.coachId,
          role: coachForm.role || undefined,
        }),
      });
      const data = await response.json() as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l’assignation du coach');
      }

      showToast('Coach assigné.');
      setCoachForm(emptyCoachForm);
      setIsCoachDialogOpen(false);
      await loadStageDetail(selectedStageId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erreur lors de l’assignation du coach', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const removeCoachAssignment = async (coachId: string) => {
    if (!selectedStageId) return;

    try {
      const response = await fetch(`/api/admin/stages/${selectedStageId}/coaches`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId }),
      });
      const data = await response.json() as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la désassignation du coach');
      }

      showToast('Coach retiré du stage.');
      await loadStageDetail(selectedStageId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erreur lors de la désassignation du coach', 'error');
    }
  };

  const coachOptions = coaches
    .map((coach) => ({
      id: coach.profile?.id || '',
      label: `${coach.profile?.pseudonym || `${coach.firstName || ''} ${coach.lastName || ''}`.trim() || 'Coach'}${normalizeSubjects(coach.profile?.subjects).length ? ` · ${normalizeSubjects(coach.profile?.subjects).join(', ')}` : ''}`,
    }))
    .filter((coach) => coach.id);

  const calendarSessions: CalendarSession[] = (selectedStageDetail?.sessions ?? []).map((session) => ({
    id: session.id,
    title: session.title,
    subject: session.subject,
    startAt: session.startAt,
    endAt: session.endAt,
    location: session.location,
    coach: session.coach ? { pseudonym: session.coach.pseudonym } : null,
  }));

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      {toast && (
        <div className={`fixed right-4 top-4 z-50 rounded-xl border px-4 py-3 text-sm shadow-xl ${toast.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200' : 'border-rose-500/30 bg-rose-500/15 text-rose-200'}`}>
          {toast.message}
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <DashboardPilotage role="ADMIN">
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-white">Administration des stages</h1>
                <p className="text-sm text-neutral-400">Pilotage des stages, séances, coachs et bilans.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-white/15 bg-transparent text-neutral-100 hover:bg-white/10"
                onClick={loadStages}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualiser
              </Button>
            </div>

            {kpis && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-white/10 bg-surface-card shadow-premium">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-neutral-200">Stages actifs</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <span className="text-3xl font-bold text-white">{kpis.activeStages}</span>
                    <Calendar className="h-5 w-5 text-brand-accent" />
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-surface-card shadow-premium">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-neutral-200">Total inscrits</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <span className="text-3xl font-bold text-white">{kpis.totalInscrits}</span>
                    <Users className="h-5 w-5 text-emerald-300" />
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-surface-card shadow-premium">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-neutral-200">CA estimé</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-white">{formatPrice(kpis.caEstime, 'TND')}</span>
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-surface-card shadow-premium">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-neutral-200">Bilans publiés</CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-white">{kpis.bilansPublies} / {kpis.totalBilans}</span>
                    <GraduationCap className="h-5 w-5 text-brand-accent" />
                  </CardContent>
                </Card>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-xl bg-white/5 p-2 text-neutral-400">
                <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-neutral-900">Vue d’ensemble</TabsTrigger>
                <TabsTrigger value="create" className="data-[state=active]:bg-white data-[state=active]:text-neutral-900">Créer un stage</TabsTrigger>
                <TabsTrigger value="schedule" className="data-[state=active]:bg-white data-[state=active]:text-neutral-900">Emploi du temps</TabsTrigger>
                <TabsTrigger value="coaches" className="data-[state=active]:bg-white data-[state=active]:text-neutral-900">Coachs assignés</TabsTrigger>
                <TabsTrigger value="bilans" className="data-[state=active]:bg-white data-[state=active]:text-neutral-900">Bilans</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card className="border-white/10 bg-surface-card shadow-premium">
                  <CardHeader>
                    <CardTitle className="text-white">Catalogue interne des stages</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table className="text-neutral-200">
                      <TableHeader>
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead className="text-neutral-300">Titre</TableHead>
                          <TableHead className="text-neutral-300">Dates</TableHead>
                          <TableHead className="text-neutral-300">Places</TableHead>
                          <TableHead className="text-neutral-300">Prix</TableHead>
                          <TableHead className="text-neutral-300">Statut</TableHead>
                          <TableHead className="text-neutral-300">Bilans</TableHead>
                          <TableHead className="text-right text-neutral-300">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stages.map((stage) => (
                          <TableRow key={stage.id} className="border-white/10 hover:bg-white/5">
                            <TableCell>
                              <div>
                                <p className="font-medium text-white">{stage.title}</p>
                                <p className="text-xs text-neutral-400">{stage.slug}</p>
                              </div>
                            </TableCell>
                            <TableCell>{formatDateRange(stage.startDate, stage.endDate)}</TableCell>
                            <TableCell>{stage.confirmedCount} / {stage.capacity}</TableCell>
                            <TableCell>{formatPrice(stage.priceAmount, stage.priceCurrency)}</TableCell>
                            <TableCell>{getStatusBadge(stage.isOpen)}</TableCell>
                            <TableCell>{stage.publishedBilans} / {stage.totalBilans}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button type="button" size="sm" variant="outline" className="border-white/15 bg-transparent text-neutral-100 hover:bg-white/10" onClick={() => openEditDialog(stage)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Modifier
                                </Button>
                                <Button type="button" size="sm" variant="outline" className="border-white/15 bg-transparent text-neutral-100 hover:bg-white/10" onClick={() => { setSelectedStageId(stage.id); setActiveTab('schedule'); }}>
                                  <Calendar className="mr-2 h-4 w-4" />
                                  Séances
                                </Button>
                                <Button type="button" size="sm" variant="outline" className="border-white/15 bg-transparent text-neutral-100 hover:bg-white/10" onClick={() => { setSelectedStageId(stage.id); setActiveTab('coaches'); }}>
                                  <Users className="mr-2 h-4 w-4" />
                                  Coachs
                                </Button>
                                <Button type="button" size="sm" variant="outline" className="border-rose-500/30 bg-transparent text-rose-200 hover:bg-rose-500/10" onClick={() => archiveStage(stage)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Archiver
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="create">
                <Card className="border-white/10 bg-surface-card shadow-premium">
                  <CardHeader>
                    <CardTitle className="text-white">Créer un stage</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <StageFormFields form={createForm} onChange={setCreateForm} onSlugEdited={() => setCreateSlugTouched(true)} />
                    <div className="flex justify-end">
                      <Button type="button" className="btn-primary" disabled={submitting} onClick={submitCreateStage}>
                        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                        Créer le stage
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4">
                <Card className="border-white/10 bg-surface-card shadow-premium">
                  <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="text-white">Emploi du temps</CardTitle>
                      <p className="text-sm text-neutral-400">Choisissez un stage pour voir ou compléter son planning.</p>
                    </div>
                    <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row">
                      <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                        <SelectTrigger className="w-full min-w-[240px] bg-surface-elevated border-white/15 text-white">
                          <SelectValue placeholder="Choisir un stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" className="btn-primary" disabled={!selectedStageId} onClick={() => setIsSessionDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter une séance
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {detailLoading ? (
                      <div className="flex h-48 items-center justify-center text-neutral-400">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Chargement du planning...
                      </div>
                    ) : selectedStage && selectedStageDetail ? (
                      <WeeklyCalendar sessions={calendarSessions} startDate={new Date(selectedStage.startDate)} endDate={new Date(selectedStage.endDate)} />
                    ) : (
                      <p className="text-sm text-neutral-400">Sélectionnez un stage pour afficher son planning.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="coaches" className="space-y-4">
                <Card className="border-white/10 bg-surface-card shadow-premium">
                  <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="text-white">Coachs assignés</CardTitle>
                      <p className="text-sm text-neutral-400">Attribuez des coachs et précisez leur rôle dans le stage.</p>
                    </div>
                    <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row">
                      <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                        <SelectTrigger className="w-full min-w-[240px] bg-surface-elevated border-white/15 text-white">
                          <SelectValue placeholder="Choisir un stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" className="btn-primary" disabled={!selectedStageId} onClick={() => setIsCoachDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Assigner un coach
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {detailLoading ? (
                      <div className="flex h-32 items-center justify-center text-neutral-400">
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Chargement des coachs...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(selectedStageDetail?.coaches ?? []).map((assignment) => (
                          <div key={assignment.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="font-medium text-white">{assignment.coach.pseudonym}</p>
                              <p className="text-xs text-neutral-400">{normalizeSubjects(assignment.coach.subjects).join(', ') || 'Matières non renseignées'}</p>
                              {assignment.role && <p className="text-xs text-brand-accent">Rôle: {assignment.role}</p>}
                            </div>
                            <Button type="button" variant="outline" className="border-rose-500/30 bg-transparent text-rose-200 hover:bg-rose-500/10" onClick={() => removeCoachAssignment(assignment.coach.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Retirer
                            </Button>
                          </div>
                        ))}
                        {selectedStageDetail && selectedStageDetail.coaches.length === 0 && (
                          <p className="text-sm text-neutral-400">Aucun coach assigné pour ce stage.</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bilans" className="space-y-4">
                <Card className="border-white/10 bg-surface-card shadow-premium">
                  <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="text-white">Bilans</CardTitle>
                      <p className="text-sm text-neutral-400">Consultez les bilans produits pour un stage donné.</p>
                    </div>
                    <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                      <SelectTrigger className="w-full min-w-[240px] bg-surface-elevated border-white/15 text-white">
                        <SelectValue placeholder="Choisir un stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent>
                    <Table className="text-neutral-200">
                      <TableHeader>
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead className="text-neutral-300">Élève</TableHead>
                          <TableHead className="text-neutral-300">Coach</TableHead>
                          <TableHead className="text-neutral-300">Score</TableHead>
                          <TableHead className="text-neutral-300">Rédigé le</TableHead>
                          <TableHead className="text-neutral-300">Statut</TableHead>
                          <TableHead className="text-right text-neutral-300">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedStageDetail?.bilans ?? []).map((bilan) => (
                          <TableRow key={bilan.id} className="border-white/10 hover:bg-white/5">
                            <TableCell>{`${bilan.student.user?.firstName || ''} ${bilan.student.user?.lastName || ''}`.trim() || 'Élève'}</TableCell>
                            <TableCell>{bilan.coach.pseudonym}</TableCell>
                            <TableCell>{bilan.scoreGlobal != null ? `${bilan.scoreGlobal}/20` : '—'}</TableCell>
                            <TableCell>{new Date(bilan.updatedAt || bilan.createdAt).toLocaleDateString('fr-FR')}</TableCell>
                            <TableCell>{getBilanStatusBadge(bilan.isPublished)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button type="button" size="sm" variant="outline" className="border-white/15 bg-transparent text-neutral-100 hover:bg-white/10" onClick={() => setViewedBilan(bilan)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Voir
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="border-white/15 bg-transparent text-neutral-100 hover:bg-white/10"
                                  disabled={!bilan.pdfUrl}
                                  onClick={() => {
                                    if (bilan.pdfUrl) {
                                      window.open(bilan.pdfUrl, '_blank', 'noopener,noreferrer');
                                    }
                                  }}
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  Télécharger PDF
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {selectedStageDetail && selectedStageDetail.bilans.length === 0 && (
                      <p className="mt-4 text-sm text-neutral-400">Aucun bilan disponible pour ce stage.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </DashboardPilotage>
      </main>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent size="full" className="max-h-[90vh] overflow-y-auto border-white/10 bg-surface-card text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Modifier le stage</DialogTitle>
          </DialogHeader>
          <StageFormFields form={editForm} onChange={setEditForm} />
          <div className="flex justify-end">
            <Button type="button" className="btn-primary" disabled={submitting} onClick={submitEditStage}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
              Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
        <DialogContent className="border-white/10 bg-surface-card text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Ajouter une séance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-neutral-200">Titre</Label>
              <Input value={sessionForm.title} onChange={(event) => setSessionForm((current) => ({ ...current, title: event.target.value }))} className="bg-surface-elevated border-white/15 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-neutral-200">Matière</Label>
              <Select value={sessionForm.subject} onValueChange={(value: Subject) => setSessionForm((current) => ({ ...current, subject: value }))}>
                <SelectTrigger className="bg-surface-elevated border-white/15 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-neutral-200">Début</Label>
                <Input type="datetime-local" value={sessionForm.startAt} onChange={(event) => setSessionForm((current) => ({ ...current, startAt: event.target.value }))} className="bg-surface-elevated border-white/15 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-200">Fin</Label>
                <Input type="datetime-local" value={sessionForm.endAt} onChange={(event) => setSessionForm((current) => ({ ...current, endAt: event.target.value }))} className="bg-surface-elevated border-white/15 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-neutral-200">Lieu</Label>
              <Input value={sessionForm.location} onChange={(event) => setSessionForm((current) => ({ ...current, location: event.target.value }))} className="bg-surface-elevated border-white/15 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-neutral-200">Coach</Label>
              <Select value={sessionForm.coachId || 'none'} onValueChange={(value) => setSessionForm((current) => ({ ...current, coachId: value === 'none' ? '' : value }))}>
                <SelectTrigger className="bg-surface-elevated border-white/15 text-white">
                  <SelectValue placeholder="Sélectionner un coach" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sans coach</SelectItem>
                  {coachOptions.map((coach) => (
                    <SelectItem key={coach.id} value={coach.id}>{coach.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-neutral-200">Description</Label>
              <Textarea value={sessionForm.description} onChange={(event) => setSessionForm((current) => ({ ...current, description: event.target.value }))} className="bg-surface-elevated border-white/15 text-white" />
            </div>
            <div className="flex justify-end">
              <Button type="button" className="btn-primary" disabled={submitting} onClick={submitSession}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCoachDialogOpen} onOpenChange={setIsCoachDialogOpen}>
        <DialogContent className="border-white/10 bg-surface-card text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Assigner un coach</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-neutral-200">Coach</Label>
              <Select value={coachForm.coachId} onValueChange={(value) => setCoachForm((current) => ({ ...current, coachId: value }))}>
                <SelectTrigger className="bg-surface-elevated border-white/15 text-white">
                  <SelectValue placeholder="Sélectionner un coach" />
                </SelectTrigger>
                <SelectContent>
                  {coachOptions.map((coach) => (
                    <SelectItem key={coach.id} value={coach.id}>{coach.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-neutral-200">Rôle dans le stage</Label>
              <Input value={coachForm.role} onChange={(event) => setCoachForm((current) => ({ ...current, role: event.target.value }))} className="bg-surface-elevated border-white/15 text-white" placeholder="Ex. Lead coach" />
            </div>
            <div className="flex justify-end">
              <Button type="button" className="btn-primary" disabled={submitting} onClick={submitCoachAssignment}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Assigner
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewedBilan)} onOpenChange={(open) => { if (!open) setViewedBilan(null); }}>
        <DialogContent size="full" className="max-h-[90vh] overflow-y-auto border-white/10 bg-surface-card text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Bilan du stage</DialogTitle>
          </DialogHeader>
          {viewedBilan && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {getBilanStatusBadge(viewedBilan.isPublished)}
                <Badge className="bg-white/10 text-white border border-white/10">{viewedBilan.coach.pseudonym}</Badge>
              </div>
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-base text-white">Version élève</CardTitle>
                </CardHeader>
                <CardContent className="whitespace-pre-wrap text-sm text-neutral-200">{viewedBilan.contentEleve}</CardContent>
              </Card>
              <Card className="border-white/10 bg-white/5">
                <CardHeader>
                  <CardTitle className="text-base text-white">Version parent</CardTitle>
                </CardHeader>
                <CardContent className="whitespace-pre-wrap text-sm text-neutral-200">{viewedBilan.contentParent}</CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
