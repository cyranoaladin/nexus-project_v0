"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FamilyForm } from "@/components/dashboard/assistante/FamilyForm";
import { AlertCircle, Loader2, LogOut, Search, Settings, Users } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  grade: string;
  school: string;
}

export default function StudentsManagement() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const latestRequest = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const fetchStudents = useCallback(async () => {
    const requestId = ++latestRequest.current;
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/assistante/students?page=${page}&limit=20&search=${encodeURIComponent(searchTerm)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch students');
      }
      
      const data = await response.json();
      if (requestId !== latestRequest.current) return;
      setStudents(data.students.map((student: { id: string; grade: string | null; school: string | null; user: { firstName: string | null; lastName: string | null; email: string } }) => ({
        id: student.id,
        grade: student.grade || 'Non renseigné',
        school: student.school || '',
        firstName: student.user.firstName || '',
        lastName: student.user.lastName || '',
        email: student.user.email,
      })));
      setPagination(data.pagination);
      setHasLoaded(true);
    } catch (err) {
      if (requestId === latestRequest.current) setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [page, searchTerm]);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push("/auth/signin");
      return;
    }

    fetchStudents();
  }, [session, status, router, fetchStudents]);

  const filteredStudents = students;

  if (status === "loading" || (loading && !hasLoaded)) {
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
              <Link href="/dashboard/assistante" className="flex items-center space-x-2">
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
                Gestion des Élèves
              </h2>
              <p className="text-neutral-400">
                Gérez tous les élèves de Nexus Réussite
              </p>
            </div>
            <div className="flex space-x-2">
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-primary">
                    + Créer un foyer
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] translate-y-0 overflow-y-auto">
                  <DialogHeader><DialogTitle>Créer ou compléter un foyer</DialogTitle></DialogHeader>
                  <FamilyForm mode="WHATSAPP" onCreated={() => void fetchStudents()} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 mb-8">
          <Card className="shadow-premium">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-brand-accent">{pagination.total}</div>
              <p className="text-sm text-neutral-400">Total Élèves</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-4 h-4" />
            <Input
              placeholder="Rechercher un élève..."
              value={searchTerm}
              onChange={(e) => { setPage(1); setSearchTerm(e.target.value); }}
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
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="border-b hover:bg-white/5">
                      <td className="p-3">
                        <div>
                          <Link
                            href={`/dashboard/assistante/students/${student.id}`}
                            className="font-medium hover:text-brand-accent"
                          >
                            {student.firstName} {student.lastName}
                          </Link>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-neutral-300">{student.email}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-neutral-300">{student.grade}</Badge>
                      </td>
                      <td className="p-3 text-sm text-neutral-300">{student.school}</td>
                      <td className="p-3">
                        <div className="flex space-x-2">
                          <Link href={`/dashboard/assistante/students/${student.id}`}>
                            <Button variant="outline" size="sm" className="text-neutral-200 hover:text-white">
                              Fiche
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3 mt-4">
          <Button variant="outline" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
          <span className="text-sm text-neutral-400">Page {page} sur {Math.max(1, pagination.totalPages)}</span>
          <Button variant="outline" disabled={loading || page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Suivant</Button>
        </div>

        {filteredStudents.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-neutral-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              Aucun élève trouvé
            </h3>
            <p className="text-neutral-400">
              {searchTerm ? 'Aucun élève ne correspond à votre recherche.' : 'Aucun élève n\'a encore été créé.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
} 
