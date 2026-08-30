"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, LogOut, Search, Settings, Users } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Student {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  grade: string | null;
  school: string | null;
  creditBalance: number;
}

export function StudentsManagementWorkspace({ staffRole }: { staffRole: 'ADMIN' | 'ASSISTANTE' }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/assistante/students/credits');
      
      if (!response.ok) {
        throw new Error('Failed to fetch students');
      }
      
      const data = await response.json();
      setStudents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  const handleCreate = async () => {
    setCreateError(null);

    if (!createForm.parentEmail || !createForm.parentFirstName || !createForm.parentLastName) {
      setCreateError("Renseignez au minimum l'email + prénom/nom du parent.");
      return;
    }
    if (!createForm.studentFirstName || !createForm.studentLastName || !createForm.studentEmail || !createForm.studentGrade) {
      setCreateError("Renseignez au minimum l'email + prénom/nom + niveau de l'élève.");
      return;
    }

    try {
      setIsCreating(true);
      const res = await fetch("/api/assistante/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Création impossible");
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
      fetchStudents();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setIsCreating(false);
    }
  };

  const normalizedSearchTerm = searchTerm.toLowerCase();
  const filteredStudents = students.filter((student) =>
    [student.firstName, student.lastName, student.email, student.school]
      .some((value) => (value ?? '').toLowerCase().includes(normalizedSearchTerm)),
  );

  if (loading) {
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
                Gestion des Élèves
              </h2>
              <p className="text-neutral-400">
                Gérez tous les élèves de Nexus Réussite
              </p>
            </div>
            <div className="flex space-x-2">
              <Link href={staffRole === 'ADMIN' ? '/dashboard/admin/candidat-individuel' : '/dashboard/assistante/credits'}>
                <Button variant="outline" className="text-neutral-200 hover:text-white">
                  <Users className="w-4 h-4 mr-2" />
                  {staffRole === 'ADMIN' ? 'Retour au simulateur' : 'Gérer les Crédits'}
                </Button>
              </Link>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-primary">
                    + Créer parent + élève
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
                          />
                        </div>
                        <div>
                          <Label htmlFor="parentLastName">Nom *</Label>
                          <Input
                            id="parentLastName"
                            value={createForm.parentLastName}
                            onChange={({ target: { value } }) => setCreateForm((current) => ({ ...current, parentLastName: value }))}
                            className="bg-surface-elevated"
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
                          />
                        </div>
                        <div>
                          <Label htmlFor="studentLastName">Nom *</Label>
                          <Input
                            id="studentLastName"
                            value={createForm.studentLastName}
                            onChange={({ target: { value } }) => setCreateForm((current) => ({ ...current, studentLastName: value }))}
                            className="bg-surface-elevated"
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
                    <div className="rounded border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
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
                    <Button className="btn-primary" onClick={handleCreate} disabled={isCreating}>
                      {isCreating ? "Création..." : "Créer"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="shadow-premium">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-brand-accent">{students.length}</div>
              <p className="text-sm text-neutral-400">Total Élèves</p>
            </CardContent>
          </Card>
          <Card className="shadow-premium">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-emerald-300">
                {students.filter(s => s.creditBalance > 0).length}
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
                {students.filter(s => s.creditBalance < 0).length}
              </div>
              <p className="text-sm text-neutral-400">Déficit</p>
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
              onChange={(e) => setSearchTerm(e.target.value)}
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
                    <th className="text-left p-3 font-medium">Crédits</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="border-b hover:bg-white/5">
                      <td className="p-3">
                        <div>
                          {staffRole === 'ASSISTANTE' ? (
                            <Link
                              href={`/dashboard/assistante/students/${student.id}`}
                              className="font-medium hover:text-brand-accent"
                            >
                              {student.firstName} {student.lastName}
                            </Link>
                          ) : (
                            <span className="font-medium">{student.firstName} {student.lastName}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-neutral-300">{student.email}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-neutral-300">{student.grade}</Badge>
                      </td>
                      <td className="p-3 text-sm text-neutral-300">{student.school}</td>
                      <td className="p-3">
                        <Badge 
                          variant={student.creditBalance >= 0 ? "default" : "destructive"}
                        >
                          {student.creditBalance} crédits
                        </Badge>
                      </td>
                      <td className="p-3">
                        {staffRole === 'ASSISTANTE' ? (
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
                          <Link href="/dashboard/admin/candidat-individuel">
                            <Button variant="outline" size="sm" className="text-neutral-200 hover:text-white">
                              Sélectionner dans le simulateur
                            </Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

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
