"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, LogOut, Search, Settings, Users } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  CANDIDATE_STUDENT_NAVIGATION_WATCHDOG_MS,
  clearCandidateStudentHandoff,
  getCandidateSimulatorPath,
  isUnmodifiedCandidateStudentActivation,
  navigateCandidateSimulatorSameTab,
  reloadCandidateStudentSourcePage,
  stageCandidateStudentHandoff,
  tryCandidateStudentHandoffStorage,
  type StaffStudentsIntent,
} from "@/lib/quotes/candidat-individuel-navigation";
import {
  candidatIndividuelStudentSearchSuccessSchema,
  type CandidatIndividuelStudentSearchItem,
} from "@/lib/quotes/candidat-individuel-search-contracts";

interface Student {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  grade: string | null;
  school: string | null;
  creditBalance: number;
}

interface ContextualPagination {
  page: number;
  total: number;
  totalPages: number;
}

type StudentRow = {
  id: string;
  displayName: string;
  email: string | null;
  grade: string | null;
  school: string | null;
} & ({
  kind: 'contextual';
  selectable: boolean;
  unavailableReason: string | null;
} | {
  kind: 'normal';
  creditBalance: number;
});

export function StudentsManagementWorkspace({
  staffRole,
  intent,
}: {
  staffRole: 'ADMIN' | 'ASSISTANTE';
  intent?: StaffStudentsIntent;
}) {
  const contextualCandidateSelection = intent === 'candidat-individuel';
  const [students, setStudents] = useState<Student[]>([]);
  const [contextualStudents, setContextualStudents] = useState<CandidatIndividuelStudentSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateConfirmationOpen, setIsCreateConfirmationOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createErrorField, setCreateErrorField] = useState<string | null>(null);
  const creationInFlight = useRef(false);
  const createdStudentNavigationId = useRef<string | null>(null);
  const [createdStudentNavigationPending, setCreatedStudentNavigationPending] = useState(false);
  const [contextPage, setContextPage] = useState(1);
  const [contextPagination, setContextPagination] = useState<ContextualPagination>({ page: 1, total: 0, totalPages: 1 });
  const hasLoadedStudents = useRef(false);
  const directoryRequestGeneration = useRef(0);
  const selectionPending = useRef(false);
  const navigationDeparted = useRef(false);
  const navigationWatchdog = useRef<number | null>(null);
  const [selectionInProgress, setSelectionInProgress] = useState(false);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [navigationRecoveryRequired, setNavigationRecoveryRequired] = useState(false);
  const [createForm, setCreateForm] = useState({
    parentEmail: "",
    parentFirstName: "",
    parentLastName: "",
    parentPhone: "",
    studentFirstName: "",
    studentLastName: "",
    studentEmail: "",
    studentGrade: "",
    studentSchool: "",
  });

  const contextualSearch = contextualCandidateSelection ? searchTerm.trim() : '';
  const fetchStudents = useCallback(async (signal?: AbortSignal, generation = ++directoryRequestGeneration.current) => {
    try {
      const response = contextualCandidateSelection
        ? await fetch('/api/assistante/candidat-individuel/students/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: contextualSearch, page: contextPage, limit: 20 }),
            signal,
          })
        : await fetch('/api/assistante/students/credits');
      
      if (!response.ok) {
        throw new Error('Failed to fetch students');
      }
      
      const data = await response.json();
      if (generation !== directoryRequestGeneration.current) return;
      if (contextualCandidateSelection) {
        const parsed = candidatIndividuelStudentSearchSuccessSchema.safeParse(data);
        if (!parsed.success) throw new Error('Le répertoire des élèves a retourné une réponse invalide.');
        setContextualStudents(parsed.data.items);
        setContextPagination({
          page: parsed.data.pagination.page,
          total: parsed.data.pagination.total,
          totalPages: parsed.data.pagination.totalPages,
        });
      } else {
        setStudents(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (generation !== directoryRequestGeneration.current) return;
      setStudents([]);
      setContextualStudents([]);
      setError(err instanceof Error && err.message.startsWith('Le répertoire')
        ? err.message
        : 'Impossible de charger le répertoire des élèves. Réessayez.');
    } finally {
      if (generation === directoryRequestGeneration.current) {
        hasLoadedStudents.current = true;
        setLoading(false);
      }
    }
  }, [contextPage, contextualCandidateSelection, contextualSearch]);

  useEffect(() => {
    const generation = ++directoryRequestGeneration.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    if (contextualCandidateSelection) setContextualStudents([]);
    const delay = contextualCandidateSelection && contextualSearch ? 250 : 0;
    const timer = window.setTimeout(() => void fetchStudents(controller.signal, generation), delay);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [contextualCandidateSelection, contextualSearch, fetchStudents]);

  useEffect(() => {
    const stopWatchdog = () => {
      if (navigationWatchdog.current !== null) window.clearTimeout(navigationWatchdog.current);
      navigationWatchdog.current = null;
    };
    const markNavigationStarted = () => {
      navigationDeparted.current = true;
      stopWatchdog();
    };
    const resetSelection = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      stopWatchdog();
      clearCandidateStudentHandoffSafely();
      navigationDeparted.current = false;
      selectionPending.current = false;
      setSelectionInProgress(false);
      if (createdStudentNavigationId.current !== null) {
        setNavigationError('Les comptes ont été créés. Réessayez d’ouvrir le simulateur sans recréer les comptes.');
        setCreatedStudentNavigationPending(true);
      }
    };
    window.addEventListener('pagehide', markNavigationStarted);
    window.addEventListener('pageshow', resetSelection);
    return () => {
      stopWatchdog();
      window.removeEventListener('pagehide', markNavigationStarted);
      window.removeEventListener('pageshow', resetSelection);
    };
  }, []);

  const clearCandidateStudentHandoffSafely = (): boolean => {
    return tryCandidateStudentHandoffStorage(
      () => window.sessionStorage,
      clearCandidateStudentHandoff,
    ).ok;
  };

  const exposeTerminalNavigationRecovery = () => {
    setNavigationRecoveryRequired(true);
    setNavigationError(
      'La navigation ne peut pas être réinitialisée en toute sécurité. Rechargez cette page pour reprendre.',
    );
  };

  const exposeConfirmedNavigationFailure = (): boolean => {
    if (!clearCandidateStudentHandoffSafely()) {
      exposeTerminalNavigationRecovery();
      return false;
    }
    setNavigationRecoveryRequired(false);
    selectionPending.current = false;
    setSelectionInProgress(false);
    setNavigationError(createdStudentNavigationId.current !== null
      ? 'Les comptes ont été créés. Réessayez d’ouvrir le simulateur sans recréer les comptes.'
      : 'La navigation vers le simulateur a échoué. Réessayez.');
    return true;
  };

  const stageStudentForCandidateQuote = (studentId: string): boolean => {
    if (selectionPending.current) return false;
    selectionPending.current = true;
    navigationDeparted.current = false;
    setSelectionInProgress(true);
    setNavigationError(null);

    const staged = tryCandidateStudentHandoffStorage(
      () => window.sessionStorage,
      (storage) => stageCandidateStudentHandoff(storage, staffRole, studentId),
    );
    if (!staged.ok) {
      if (!clearCandidateStudentHandoffSafely()) {
        exposeTerminalNavigationRecovery();
        return false;
      }
      selectionPending.current = false;
      setSelectionInProgress(false);
      setNavigationError('Cet élève ne peut pas être utilisé pour un devis. Réessayez.');
      return false;
    }

    navigationWatchdog.current = window.setTimeout(() => {
      navigationWatchdog.current = null;
      if (navigationDeparted.current) return;
      try {
        window.stop();
      } catch {
        exposeTerminalNavigationRecovery();
        return;
      }
      if (navigationDeparted.current) return;
      exposeConfirmedNavigationFailure();
    }, CANDIDATE_STUDENT_NAVIGATION_WATCHDOG_MS);
    return true;
  };

  const navigateCreatedStudentForCandidateQuote = (studentId: string): boolean => {
    if (!stageStudentForCandidateQuote(studentId)) return false;
    try {
      navigateCandidateSimulatorSameTab(window.location, staffRole);
      return true;
    } catch {
      if (navigationWatchdog.current !== null) window.clearTimeout(navigationWatchdog.current);
      navigationWatchdog.current = null;
      exposeConfirmedNavigationFailure();
      return false;
    }
  };

  const retryCreatedStudentNavigation = () => {
    const studentId = createdStudentNavigationId.current;
    if (studentId === null || selectionPending.current) return;
    setNavigationError(null);
    setCreatedStudentNavigationPending(true);
    void navigateCreatedStudentForCandidateQuote(studentId);
  };

  const activateStudentForCandidateQuote = (
    event: ReactMouseEvent<HTMLAnchorElement>,
    studentId: string,
    selectable = true,
  ) => {
    if (!isUnmodifiedCandidateStudentActivation(event) || !selectable || selectionPending.current) {
      event.preventDefault();
      return;
    }
    if (!stageStudentForCandidateQuote(studentId)) event.preventDefault();
  };

  const validateCreateForm = (): { field: string; message: string } | null => {
    const emailIsValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    if (!createForm.parentEmail.trim()) return { field: 'parentEmail', message: 'Email du responsable requis.' };
    if (!emailIsValid(createForm.parentEmail)) return { field: 'parentEmail', message: 'Email du responsable invalide.' };
    if (!createForm.parentFirstName.trim()) return { field: 'parentFirstName', message: 'Prénom du responsable requis.' };
    if (!createForm.parentLastName.trim()) return { field: 'parentLastName', message: 'Nom du responsable requis.' };
    if (!createForm.studentEmail.trim()) return { field: 'studentEmail', message: 'Email de l’élève requis.' };
    if (!emailIsValid(createForm.studentEmail)) return { field: 'studentEmail', message: 'Email de l’élève invalide.' };
    if (!createForm.studentFirstName.trim()) return { field: 'studentFirstName', message: 'Prénom de l’élève requis.' };
    if (!createForm.studentLastName.trim()) return { field: 'studentLastName', message: 'Nom de l’élève requis.' };
    if (!createForm.studentGrade.trim()) return { field: 'studentGrade', message: 'Niveau de l’élève requis.' };
    return null;
  };

  const exposeCreateValidationError = (validationError: { field: string; message: string }) => {
    setCreateErrorField(validationError.field);
    setCreateError(validationError.message);
  };

  const createFieldErrorProps = (field: string) => ({
    'aria-invalid': createErrorField === field,
    'aria-describedby': createErrorField === field ? 'student-create-error' : undefined,
  });

  const reviewContextualCreation = () => {
    setCreateError(null);
    setCreateErrorField(null);
    const validationError = validateCreateForm();
    if (validationError) {
      exposeCreateValidationError(validationError);
      return;
    }
    setIsCreateConfirmationOpen(true);
  };

  const handleCreate = async () => {
    if (creationInFlight.current || createdStudentNavigationId.current !== null) return;
    setCreateError(null);
    setCreateErrorField(null);
    const validationError = validateCreateForm();
    if (validationError) {
      exposeCreateValidationError(validationError);
      setIsCreateConfirmationOpen(false);
      return;
    }
    setIsCreateConfirmationOpen(false);
    creationInFlight.current = true;

    try {
      setIsCreating(true);
      const res = await fetch("/api/assistante/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (!res.ok) {
        if (typeof data?.field === 'string') setCreateErrorField(data.field);
        throw new Error(data?.message || data?.error || "Création impossible");
      }
      if (contextualCandidateSelection) {
        if (typeof data?.studentId !== 'string') throw new Error("Le serveur n'a pas retourné un élève valide.");
        createdStudentNavigationId.current = data.studentId;
        setCreatedStudentNavigationPending(true);
        setIsCreateOpen(false);
        void navigateCreatedStudentForCandidateQuote(data.studentId);
        return;
      }

      setIsCreateOpen(false);
      setCreateForm({
        parentEmail: "",
        parentFirstName: "",
        parentLastName: "",
        parentPhone: "",
        studentFirstName: "",
        studentLastName: "",
        studentEmail: "",
        studentGrade: "",
        studentSchool: "",
      });
      setLoading(true);
      setError(null);
      void fetchStudents(undefined, ++directoryRequestGeneration.current);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      creationInFlight.current = false;
      setIsCreating(false);
    }
  };

  const normalizedSearchTerm = searchTerm.toLowerCase();
  const filteredStudents = contextualCandidateSelection
    ? []
    : students.filter((student) =>
        [student.firstName, student.lastName, student.email, student.school]
          .some((value) => (value ?? '').toLowerCase().includes(normalizedSearchTerm)),
      );
  const studentRows: StudentRow[] = contextualCandidateSelection
    ? contextualStudents.map((student) => ({
        kind: 'contextual',
        id: student.studentId,
        displayName: student.displayName,
        email: student.email,
        grade: student.grade,
        school: student.school,
        selectable: student.selectable,
        unavailableReason: student.unavailableReason,
      }))
    : filteredStudents.map((student) => ({
        kind: 'normal',
        id: student.id,
        displayName: [student.firstName, student.lastName].filter(Boolean).join(' ') || 'Élève sans nom',
        email: student.email,
        grade: student.grade,
        school: student.school,
        creditBalance: student.creditBalance,
      }));

  if (loading && !hasLoadedStudents.current) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" />
          <p className="text-neutral-400">Chargement des élèves...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-rose-300" />
          <p className="text-rose-200 mb-4">Erreur lors du chargement</p>
          <p className="text-neutral-400 text-sm">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="btn-primary mt-4"
          >
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-darker">
      {/* Header */}
      <header className="shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href={staffRole === 'ADMIN' ? '/dashboard/admin' : '/dashboard/assistante'} className="flex items-center space-x-2">
                <Settings className="w-8 h-8 text-brand-accent" />
                <div>
                  <h1 className="font-semibold">
                    Gestion des Élèves
                  </h1>
                  <p className="text-sm text-neutral-400">Administration des élèves</p>
                </div>
              </Link>
            </div>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-neutral-300 hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {contextualCandidateSelection
                  ? 'Sélectionner un élève pour le devis candidat individuel'
                  : 'Gestion des Élèves'}
              </h2>
              <p className="text-neutral-400">
                {contextualCandidateSelection
                  ? 'Choisissez un dossier existant ou créez le parent et son élève.'
                  : 'Gérez tous les élèves de Nexus Réussite'}
              </p>
            </div>
            <div className="flex space-x-2">
              <Link href={contextualCandidateSelection
                ? getCandidateSimulatorPath(staffRole)
                : staffRole === 'ADMIN' ? '/dashboard/admin/candidat-individuel' : '/dashboard/assistante/credits'}>
                <Button variant="outline" className="text-neutral-200 hover:text-white">
                  <Users className="w-4 h-4 mr-2" />
                  {contextualCandidateSelection || staffRole === 'ADMIN' ? 'Retour au simulateur' : 'Gérer les Crédits'}
                </Button>
              </Link>
              <Dialog open={isCreateOpen} onOpenChange={(open) => {
                setIsCreateOpen(open);
                if (!open) setIsCreateConfirmationOpen(false);
              }}>
                <DialogTrigger asChild>
                  <Button className="btn-primary" disabled={createdStudentNavigationPending || isCreating}>
                    {contextualCandidateSelection ? 'Créer parent + élève' : '+ Créer parent + élève'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Créer un parent et un élève</DialogTitle>
                  </DialogHeader>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <p className="text-sm text-neutral-400">Parent</p>
                      <div>
                        <Label htmlFor="parentEmail">Email *</Label>
                        <Input
                          id="parentEmail"
                          value={createForm.parentEmail}
                          onChange={({ target: { value } }) => setCreateForm((current) => ({ ...current, parentEmail: value }))}
                          className="bg-surface-elevated"
                          placeholder="parent@email.com"
                          {...createFieldErrorProps('parentEmail')}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="parentFirstName">Prénom *</Label>
                          <Input
                            id="parentFirstName"
                            value={createForm.parentFirstName}
                            onChange={({ target: { value } }) => setCreateForm((current) => ({ ...current, parentFirstName: value }))}
                            className="bg-surface-elevated"
                            {...createFieldErrorProps('parentFirstName')}
                          />
                        </div>
                        <div>
                          <Label htmlFor="parentLastName">Nom *</Label>
                          <Input
                            id="parentLastName"
                            value={createForm.parentLastName}
                            onChange={({ target: { value } }) => setCreateForm((current) => ({ ...current, parentLastName: value }))}
                            className="bg-surface-elevated"
                            {...createFieldErrorProps('parentLastName')}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="parentPhone">Téléphone</Label>
                        <Input
                          id="parentPhone"
                          value={createForm.parentPhone}
                          onChange={({ target: { value } }) => setCreateForm((current) => ({ ...current, parentPhone: value }))}
                          className="bg-surface-elevated"
                          placeholder="+216 ..."
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm text-neutral-400">Élève</p>
                      <div>
                        <Label htmlFor="studentEmail">Email élève *</Label>
                        <Input
                          id="studentEmail"
                          value={createForm.studentEmail}
                          onChange={({ target: { value } }) => setCreateForm((current) => ({ ...current, studentEmail: value }))}
                          className="bg-surface-elevated"
                          placeholder="eleve@email.com"
                          {...createFieldErrorProps('studentEmail')}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="studentFirstName">Prénom *</Label>
                          <Input
                            id="studentFirstName"
                            value={createForm.studentFirstName}
                            onChange={({ target: { value } }) => setCreateForm((current) => ({ ...current, studentFirstName: value }))}
                            className="bg-surface-elevated"
                            {...createFieldErrorProps('studentFirstName')}
                          />
                        </div>
                        <div>
                          <Label htmlFor="studentLastName">Nom *</Label>
                          <Input
                            id="studentLastName"
                            value={createForm.studentLastName}
                            onChange={({ target: { value } }) => setCreateForm((current) => ({ ...current, studentLastName: value }))}
                            className="bg-surface-elevated"
                            {...createFieldErrorProps('studentLastName')}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="studentGrade">Niveau (ex: Première, Terminale STMG) *</Label>
                        <Input
                          id="studentGrade"
                          value={createForm.studentGrade}
                          onChange={({ target: { value } }) => setCreateForm((current) => ({ ...current, studentGrade: value }))}
                          className="bg-surface-elevated"
                          placeholder="Première"
                          {...createFieldErrorProps('studentGrade')}
                        />
                      </div>
                      <div>
                        <Label htmlFor="studentSchool">École</Label>
                        <Input
                          id="studentSchool"
                          value={createForm.studentSchool}
                          onChange={({ target: { value } }) => setCreateForm((current) => ({ ...current, studentSchool: value }))}
                          className="bg-surface-elevated"
                        />
                      </div>
                    </div>
                  </div>

                  {createError && (
                    <div id="student-create-error" role="alert" className="rounded border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
                      {createError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateOpen(false)}
                      className="text-neutral-200 hover:text-white"
                      disabled={isCreating}
                    >
                      Annuler
                    </Button>
                    <Button
                      className="btn-primary"
                      onClick={contextualCandidateSelection ? reviewContextualCreation : handleCreate}
                      disabled={isCreating}
                    >
                      {isCreating
                        ? 'Création...'
                        : contextualCandidateSelection ? 'Vérifier avant création' : 'Créer'}
                    </Button>
                  </div>
                </DialogContent>
                {contextualCandidateSelection && isCreateConfirmationOpen && (
                  <Dialog open onOpenChange={setIsCreateConfirmationOpen}>
                    <DialogContent className="max-w-lg" aria-describedby="candidate-create-disclosure">
                      <DialogHeader>
                        <DialogTitle>Confirmer la création des comptes Nexus</DialogTitle>
                        <DialogDescription id="candidate-create-disclosure">
                          Cette action déclenche immédiatement les opérations suivantes.
                        </DialogDescription>
                      </DialogHeader>
                      <ul className="space-y-3 text-sm leading-6 text-neutral-200">
                        <li>Créer ou mettre à jour les comptes Nexus du responsable et de l’élève.</li>
                        <li>Envoyer un email d’activation du compte élève.</li>
                        <li>Envoyer, si nécessaire, un email de définition ou de réinitialisation du mot de passe du responsable.</li>
                      </ul>
                      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateConfirmationOpen(false)}
                          disabled={isCreating}
                          autoFocus
                        >
                          Annuler la création
                        </Button>
                        <Button
                          type="button"
                          className="btn-primary"
                          onClick={handleCreate}
                          disabled={isCreating}
                        >
                          {isCreating ? 'Création...' : 'Créer les comptes et utiliser pour ce devis'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </Dialog>
            </div>
          </div>
        </div>

        {/* Stats */}
        {!contextualCandidateSelection && <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="shadow-premium">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-brand-accent">{students.length}</div>
              <p className="text-sm text-neutral-400">Total Élèves</p>
            </CardContent>
          </Card>
          <Card className="shadow-premium">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-emerald-300">
                {students.filter(s => (s.creditBalance ?? 0) > 0).length}
              </div>
              <p className="text-sm text-neutral-400">Avec Crédits</p>
            </CardContent>
          </Card>
          <Card className="shadow-premium">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-200">
                {students.filter(s => s.creditBalance === 0).length}
              </div>
              <p className="text-sm text-neutral-400">Sans Crédits</p>
            </CardContent>
          </Card>
          <Card className="shadow-premium">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-rose-300">
                {students.filter(s => (s.creditBalance ?? 0) < 0).length}
              </div>
              <p className="text-sm text-neutral-400">Déficit</p>
            </CardContent>
          </Card>
        </div>}

        {navigationError && (
          <div className="mb-6 flex flex-col items-start gap-3 rounded border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">
            <span>{navigationError}</span>
            {navigationRecoveryRequired ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => reloadCandidateStudentSourcePage(window.location)}
              >
                Recharger
              </Button>
            ) : createdStudentNavigationPending ? (
              <Button type="button" variant="outline" onClick={retryCreatedStudentNavigation} disabled={selectionInProgress}>
                Réessayer d’ouvrir le simulateur
              </Button>
            ) : null}
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-4 h-4" />
            <Input
              placeholder="Rechercher un élève..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (contextualCandidateSelection) setContextPage(1);
              }}
              className="pl-10 bg-surface-elevated"
            />
          </div>
        </div>

        {/* Students Table */}
        <Card className="shadow-premium">
          <CardHeader>
            <CardTitle className="text-white">Liste des Élèves</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-neutral-300">
                    <th className="text-left p-3 font-medium">Nom</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Niveau</th>
                    <th className="text-left p-3 font-medium">École</th>
                    {!contextualCandidateSelection && <th className="text-left p-3 font-medium">Crédits</th>}
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map((student) => (
                    <tr key={student.id} className="border-b hover:bg-white/5">
                      <td className="p-3">
                        <div>
                          {staffRole === 'ASSISTANTE' && student.kind === 'normal' ? (
                            <Link
                              href={`/dashboard/assistante/students/${student.id}`}
                              className="font-medium hover:text-brand-accent"
                            >
                              {student.displayName}
                            </Link>
                          ) : (
                            <span className="font-medium">{student.displayName}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-neutral-300">{student.email}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-neutral-300">{student.grade}</Badge>
                      </td>
                      <td className="p-3 text-sm text-neutral-300">{student.school}</td>
                      {student.kind === 'normal' && <td className="p-3">
                        <Badge 
                          variant={student.creditBalance >= 0 ? "default" : "destructive"}
                        >
                          {student.creditBalance} crédits
                        </Badge>
                      </td>}
                      <td className="p-3">
                        {student.kind === 'contextual' ? (
                          <div>
                            <a
                              href={getCandidateSimulatorPath(staffRole)}
                              className="inline-flex h-9 items-center justify-center rounded-md border border-white/15 px-3 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary aria-[disabled=true]:cursor-not-allowed aria-[disabled=true]:opacity-60"
                              onClick={(event) => activateStudentForCandidateQuote(event, student.id, student.selectable)}
                              onAuxClick={(event) => event.preventDefault()}
                              aria-disabled={!student.selectable || selectionInProgress}
                              aria-describedby={student.unavailableReason ? `candidate-student-unavailable-${student.id}` : undefined}
                            >
                              Utiliser pour ce devis
                            </a>
                            {student.unavailableReason && (
                              <p id={`candidate-student-unavailable-${student.id}`} className="mt-2 max-w-xs text-xs text-amber-200" role="status">{student.unavailableReason}</p>
                            )}
                          </div>
                        ) : staffRole === 'ASSISTANTE' ? (
                          <div className="flex space-x-2">
                            <Link href={`/dashboard/assistante/students/${student.id}`}>
                              <Button variant="outline" size="sm" className="text-neutral-200 hover:text-white">
                                Fiche
                              </Button>
                            </Link>
                            <Link href={`/dashboard/assistante/credits?studentId=${student.id}`}>
                              <Button variant="outline" size="sm" className="text-neutral-200 hover:text-white">
                                Gérer Crédits
                              </Button>
                            </Link>
                          </div>
                        ) : (
                          <a
                            href={getCandidateSimulatorPath(staffRole)}
                            className="inline-flex h-9 items-center justify-center rounded-md border border-white/15 px-3 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary aria-[disabled=true]:cursor-not-allowed aria-[disabled=true]:opacity-60"
                            onClick={(event) => activateStudentForCandidateQuote(event, student.id)}
                            onAuxClick={(event) => event.preventDefault()}
                            aria-disabled={selectionInProgress}
                          >
                            Utiliser pour un devis candidat individuel
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {studentRows.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-neutral-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {loading ? 'Recherche en cours...' : 'Aucun élève trouvé'}
            </h3>
            {!loading && <p className="text-neutral-400">
              {searchTerm ? 'Aucun élève ne correspond à votre recherche.' : 'Aucun élève n\'a encore été créé.'}
            </p>}
          </div>
        )}
        {contextualCandidateSelection && contextPagination.totalPages > 1 && (
          <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination des élèves">
            <Button type="button" variant="outline" disabled={contextPage <= 1} onClick={() => setContextPage((page) => Math.max(1, page - 1))}>
              Précédent
            </Button>
            <span className="text-sm text-neutral-300">Page {contextPagination.page} sur {contextPagination.totalPages}</span>
            <Button type="button" variant="outline" disabled={contextPage >= contextPagination.totalPages} onClick={() => setContextPage((page) => page + 1)}>
              Suivant
            </Button>
          </nav>
        )}
      </main>
    </div>
  );
} 
