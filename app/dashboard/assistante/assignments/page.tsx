'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Loader2, 
  Search, 
  Plus, 
  GraduationCap, 
  UserCircle,
  Link as LinkIcon,
  Calendar,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { AssignmentStatus, AssignmentType, GradeLevel, AcademicTrack, StmgPathway, Subject } from '@prisma/client';
import { cn } from '@/lib/utils';

// Types
interface Student {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  gradeLevel: GradeLevel | null;
  academicTrack: AcademicTrack | null;
  specialties: Subject[] | null;
  stmgPathway: StmgPathway | null;
  hasActiveCoach: boolean;
}

interface Coach {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Assignment {
  id: string;
  coachId: string;
  studentId: string;
  assignmentType: AssignmentType;
  status: AssignmentStatus;
  subjects: Subject[];
  notes: string | null;
  startsAt: string;
  endsAt: string | null;
  coach: {
    firstName: string;
    lastName: string;
    email: string;
  };
  student: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Stats {
  totalStudents: number;
  totalCoaches: number;
  activeAssignments: number;
  studentsWithoutCoach: number;
}

export default function AssistanteAssignmentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Data states
  const [students, setStudents] = useState<Student[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEnding, setIsEnding] = useState<string | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeLevelFilter, setGradeLevelFilter] = useState<string>('ALL');
  const [trackFilter, setTrackFilter] = useState<string>('ALL');
  const [coachStatusFilter, setCoachStatusFilter] = useState<string>('ALL');
  
  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(AssignmentType.PRIMARY);
  const [assignmentNotes, setAssignmentNotes] = useState('');

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && session?.user?.role !== 'ASSISTANTE' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch students with their coach status
      const studentsRes = await fetch('/api/assistante/students?includeCoachStatus=true');
      if (!studentsRes.ok) throw new Error('Failed to fetch students');
      const studentsData = await studentsRes.json();
      
      // Fetch coaches
      const coachesRes = await fetch('/api/assistante/coaches');
      if (!coachesRes.ok) throw new Error('Failed to fetch coaches');
      const coachesData = await coachesRes.json();
      
      // Fetch assignments
      const assignmentsRes = await fetch('/api/assistante/assignments?status=ACTIVE');
      if (!assignmentsRes.ok) throw new Error('Failed to fetch assignments');
      const assignmentsData = await assignmentsRes.json();
      
      setStudents(studentsData.students || []);
      setCoaches(coachesData.coaches || []);
      setAssignments(assignmentsData.assignments || []);
      
      // Calculate stats
      const activeAssignments = assignmentsData.assignments?.filter((a: Assignment) => a.status === AssignmentStatus.ACTIVE).length || 0;
      const studentsWithoutCoach = studentsData.students?.filter((s: Student) => !s.hasActiveCoach).length || 0;
      
      setStats({
        totalStudents: studentsData.students?.length || 0,
        totalCoaches: coachesData.coaches?.length || 0,
        activeAssignments,
        studentsWithoutCoach,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status, fetchData]);

  // Create assignment
  const handleCreateAssignment = async () => {
    if (!selectedCoachId || selectedStudentIds.length === 0) {
      toast.error('Veuillez sélectionner un coach et au moins un élève');
      return;
    }

    try {
      setIsCreating(true);
      
      const res = await fetch('/api/assistante/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: selectedCoachId,
          studentIds: selectedStudentIds,
          assignmentType,
          notes: assignmentNotes,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create assignment');
      }

      toast.success('Assignation créée avec succès');
      setShowCreateModal(false);
      setSelectedCoachId('');
      setSelectedStudentIds([]);
      setAssignmentNotes('');
      fetchData();
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la création');
    } finally {
      setIsCreating(false);
    }
  };

  // End assignment
  const handleEndAssignment = async (assignmentId: string) => {
    try {
      setIsEnding(assignmentId);
      
      const res = await fetch(`/api/assistante/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: AssignmentStatus.ENDED,
        }),
      });

      if (!res.ok) throw new Error('Failed to end assignment');

      toast.success('Assignation terminée');
      fetchData();
    } catch (error) {
      console.error('Error ending assignment:', error);
      toast.error('Erreur lors de la terminaison');
    } finally {
      setIsEnding(null);
    }
  };

  // Filter students
  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesGrade = gradeLevelFilter === 'ALL' || student.gradeLevel === gradeLevelFilter;
    const matchesTrack = trackFilter === 'ALL' || student.academicTrack === trackFilter;
    const matchesCoachStatus = 
      coachStatusFilter === 'ALL' || 
      (coachStatusFilter === 'WITH_COACH' && student.hasActiveCoach) ||
      (coachStatusFilter === 'WITHOUT_COACH' && !student.hasActiveCoach);
    
    return matchesSearch && matchesGrade && matchesTrack && matchesCoachStatus;
  });

  // Filter assignments
  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = 
      assignment.coach.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.coach.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.student.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assignment.student.lastName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Gestion des Assignations Coach-Élève</h1>
        <p className="text-muted-foreground">
          Associez les coachs aux élèves et gérez les relations pédagogiques
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{stats.totalStudents}</CardTitle>
              <CardDescription>Élèves total</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">{stats.totalCoaches}</CardTitle>
              <CardDescription>Coachs</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl text-green-600">{stats.activeAssignments}</CardTitle>
              <CardDescription>Assignations actives</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl text-orange-600">{stats.studentsWithoutCoach}</CardTitle>
              <CardDescription>Élèves sans coach</CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={gradeLevelFilter} onValueChange={setGradeLevelFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Niveau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous niveaux</SelectItem>
                <SelectItem value={GradeLevel.PREMIERE}>Première</SelectItem>
                <SelectItem value={GradeLevel.TERMINALE}>Terminale</SelectItem>
              </SelectContent>
            </Select>
            <Select value={trackFilter} onValueChange={setTrackFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filière" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes filières</SelectItem>
                <SelectItem value={AcademicTrack.EDS_GENERALE}>Générale</SelectItem>
                <SelectItem value={AcademicTrack.STMG}>STMG</SelectItem>
                <SelectItem value={AcademicTrack.STI2D}>Technologique</SelectItem>
              </SelectContent>
            </Select>
            <Select value={coachStatusFilter} onValueChange={setCoachStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut coach" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous</SelectItem>
                <SelectItem value="WITH_COACH">Avec coach</SelectItem>
                <SelectItem value="WITHOUT_COACH">Sans coach</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle assignation
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="space-y-6">
        {/* Students Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Élèves ({filteredStudents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>Niveau</TableHead>
                  <TableHead>Filière</TableHead>
                  <TableHead>Spécialités / Voie</TableHead>
                  <TableHead>Statut coach</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="font-medium">{student.firstName} {student.lastName}</div>
                      <div className="text-sm text-muted-foreground">{student.email}</div>
                    </TableCell>
                    <TableCell>{student.gradeLevel || '-'}</TableCell>
                    <TableCell>{student.academicTrack || '-'}</TableCell>
                    <TableCell>
                      {student.academicTrack === 'STMG' 
                        ? student.stmgPathway || '-'
                        : student.specialties?.join(', ') || '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.hasActiveCoach ? 'default' : 'outline'}>
                        {student.hasActiveCoach ? 'Avec coach' : 'Sans coach'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Assignments Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Assignations actives ({filteredAssignments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Coach</TableHead>
                  <TableHead>Élève</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Matières</TableHead>
                  <TableHead>Depuis</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div className="font-medium">{assignment.coach.firstName} {assignment.coach.lastName}</div>
                      <div className="text-sm text-muted-foreground">{assignment.coach.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{assignment.student.firstName} {assignment.student.lastName}</div>
                      <div className="text-sm text-muted-foreground">{assignment.student.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{assignment.assignmentType}</Badge>
                    </TableCell>
                    <TableCell>{assignment.subjects?.join(', ') || '-'}</TableCell>
                    <TableCell>
                      {new Date(assignment.startsAt).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEndAssignment(assignment.id)}
                        disabled={isEnding === assignment.id}
                      >
                        {isEnding === assignment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        Terminer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Nouvelle assignation</CardTitle>
              <CardDescription>
                Associez un coach à un ou plusieurs élèves
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Coach</label>
                <Select value={selectedCoachId} onValueChange={setSelectedCoachId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un coach" />
                  </SelectTrigger>
                  <SelectContent>
                    {coaches.map((coach) => (
                      <SelectItem key={coach.id} value={coach.id}>
                        {coach.firstName} {coach.lastName} ({coach.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Type d&apos;assignation</label>
                <Select 
                  value={assignmentType} 
                  onValueChange={(v) => setAssignmentType(v as AssignmentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AssignmentType.PRIMARY}>Coach référent principal</SelectItem>
                    <SelectItem value={AssignmentType.SECONDARY}>Spécialiste</SelectItem>
                    <SelectItem value={AssignmentType.STAGE}>Stage uniquement</SelectItem>
                    <SelectItem value={AssignmentType.TEMPORARY}>Remplacement temporaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Élèves sans coach actif</label>
                <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-2">
                  {students.filter(s => !s.hasActiveCoach).map((student) => (
                    <label key={student.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudentIds([...selectedStudentIds, student.id]);
                          } else {
                            setSelectedStudentIds(selectedStudentIds.filter(id => id !== student.id));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span>
                        {student.firstName} {student.lastName} - {student.gradeLevel} {student.academicTrack}
                      </span>
                    </label>
                  ))}
                  {students.filter(s => !s.hasActiveCoach).length === 0 && (
                    <p className="text-muted-foreground text-sm">Tous les élèves ont un coach actif</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Notes (optionnel)</label>
                <Input
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="Notes sur l&apos;assignation..."
                />
              </div>
            </CardContent>
            <CardContent className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Annuler
              </Button>
              <Button 
                onClick={handleCreateAssignment} 
                disabled={isCreating || !selectedCoachId || selectedStudentIds.length === 0}
              >
                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Créer l&apos;assignation
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
