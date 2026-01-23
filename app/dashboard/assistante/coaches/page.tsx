"use client";

import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, Plus, Edit, Trash2, ArrowLeft, UserPlus, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface Coach {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  pseudonym: string;
  tag: string;
  description: string;
  philosophy: string;
  expertise: string;
  coachSubjects: string[];
  availableOnline: boolean;
  availableInPerson: boolean;
  createdAt: string;
}

interface CoachFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  pseudonym: string;
  tag: string;
  description: string;
  philosophy: string;
  expertise: string;
  subjects: string[];
  availableOnline: boolean;
  availableInPerson: boolean;
}

const INITIAL_FORM_DATA: CoachFormData = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  pseudonym: '',
  tag: '',
  description: '',
  philosophy: '',
  expertise: '',
  subjects: [],
  availableOnline: true,
  availableInPerson: true
};

const SUBJECTS = [
  { value: 'MATHEMATIQUES', label: 'Mathématiques' },
  { value: 'NSI', label: 'NSI (Numérique et Sciences Informatiques)' },
  { value: 'FRANCAIS', label: 'Français' },
  { value: 'PHILOSOPHIE', label: 'Philosophie' },
  { value: 'HISTOIRE_GEO', label: 'Histoire-Géographie' },
  { value: 'ANGLAIS', label: 'Anglais' },
  { value: 'ESPAGNOL', label: 'Espagnol' },
  { value: 'PHYSIQUE_CHIMIE', label: 'Physique-Chimie' },
  { value: 'SVT', label: 'SVT' },
  { value: 'SES', label: 'SES' }
];

export default function CoachManagement() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CoachFormData>(INITIAL_FORM_DATA);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push("/auth/signin");
      return;
    }

    fetchCoaches();
  }, [session, status, router]);

  const fetchCoaches = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/assistant/coaches');
      
      if (!response.ok) {
        throw new Error('Failed to fetch coaches');
      }
      
      const data = await response.json();
      setCoaches(data.coaches || []);
    } catch (err) {
      console.error('Error fetching coaches:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      pseudonym: '',
      tag: '',
      description: '',
      philosophy: '',
      expertise: '',
      subjects: [],
      availableOnline: true,
      availableInPerson: true
    });
  };

  const handleAddCoach = async () => {
    try {
      setSubmitting(true);
      const response = await fetch('/api/assistant/coaches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add coach');
      }

      await fetchCoaches();
      setIsAddDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error('Error adding coach:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditCoach = async () => {
    if (!editingCoach) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/assistant/coaches/${editingCoach.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update coach');
      }

      await fetchCoaches();
      setIsEditDialogOpen(false);
      setEditingCoach(null);
      resetForm();
    } catch (err) {
      console.error('Error updating coach:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCoach = async (coachId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce coach ?')) return;

    try {
      const response = await fetch(`/api/assistant/coaches/${coachId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete coach');
      }

      await fetchCoaches();
    } catch (err) {
      console.error('Error deleting coach:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const openEditDialog = (coach: Coach) => {
    setEditingCoach(coach);
    setFormData({
      firstName: coach.firstName,
      lastName: coach.lastName,
      email: coach.email,
      password: '',
      pseudonym: coach.pseudonym,
      tag: coach.tag,
      description: coach.description,
      philosophy: coach.philosophy,
      expertise: coach.expertise,
      subjects: coach.coachSubjects,
      availableOnline: coach.availableOnline,
      availableInPerson: coach.availableInPerson
    });
    setIsEditDialogOpen(true);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/assistante">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gestion des Coachs</h1>
                <p className="text-sm text-gray-600">Créer et gérer les coachs de la plateforme</p>
              </div>
            </div>
            
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Ajouter un Coach
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Ajouter un nouveau coach</DialogTitle>
                </DialogHeader>
                <CoachForm 
                  formData={formData}
                  setFormData={setFormData}
                  onSubmit={handleAddCoach}
                  submitting={submitting}
                  subjects={SUBJECTS}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        <div className="grid gap-6">
          {coaches.map((coach) => (
            <Card key={coach.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <span>{coach.pseudonym}</span>
                      <Badge variant="default">{coach.tag}</Badge>
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      {coach.firstName} {coach.lastName} • {coach.email}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(coach)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCoach(coach.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                    <p className="text-sm text-gray-600">{coach.description}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Matières</h4>
                    <div className="flex flex-wrap gap-2">
                      {coach.coachSubjects.map((subject) => (
                        <Badge key={subject} variant="outline">
                          {SUBJECTS.find(s => s.value === subject)?.label || subject}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className={`w-4 h-4 ${coach.availableOnline ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className="text-sm">En ligne</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className={`w-4 h-4 ${coach.availableInPerson ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className="text-sm">En présentiel</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {coaches.length === 0 && !loading && (
            <Card>
              <CardContent className="text-center py-12">
                <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun coach</h3>
                <p className="text-gray-600 mb-4">Commencez par ajouter votre premier coach</p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un coach
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le coach</DialogTitle>
          </DialogHeader>
          <CoachForm 
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleEditCoach}
            submitting={submitting}
            subjects={SUBJECTS}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CoachFormProps {
  formData: CoachFormData;
  setFormData: Dispatch<SetStateAction<CoachFormData>>;
  onSubmit: () => void;
  submitting: boolean;
  subjects: Array<{ value: string; label: string }>;
}

function CoachForm({ formData, setFormData, onSubmit, submitting, subjects }: CoachFormProps) {
  const handleSubjectChange = (subject: string, checked: boolean) => {
    if (checked) {
      setFormData({ ...formData, subjects: [...formData.subjects, subject] });
    } else {
      setFormData({ ...formData, subjects: formData.subjects.filter((s: string) => s !== subject) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">Prénom</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            placeholder="Prénom"
          />
        </div>
        <div>
          <Label htmlFor="lastName">Nom</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            placeholder="Nom"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="email@example.com"
          />
        </div>
        <div>
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Mot de passe"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="pseudonym">Pseudonyme</Label>
          <Input
            id="pseudonym"
            value={formData.pseudonym}
            onChange={(e) => setFormData({ ...formData, pseudonym: e.target.value })}
            placeholder="Hélios, Zénon, etc."
          />
        </div>
        <div>
          <Label htmlFor="tag">Tag</Label>
          <Input
            id="tag"
            value={formData.tag}
            onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
            placeholder="🎓 Agrégé, 🎯 Stratège, etc."
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Description du coach..."
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="philosophy">Philosophie d'enseignement</Label>
        <Textarea
          id="philosophy"
          value={formData.philosophy}
          onChange={(e) => setFormData({ ...formData, philosophy: e.target.value })}
          placeholder="Philosophie d'enseignement..."
          rows={2}
        />
      </div>

      <div>
        <Label htmlFor="expertise">Expertise</Label>
        <Textarea
          id="expertise"
          value={formData.expertise}
          onChange={(e) => setFormData({ ...formData, expertise: e.target.value })}
          placeholder="Domaines d'expertise..."
          rows={2}
        />
      </div>

      <div>
        <Label>Matières enseignées</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
          {subjects.map((subject) => (
            <label key={subject.value} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.subjects.includes(subject.value)}
                onChange={(e) => handleSubjectChange(subject.value, e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">{subject.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex space-x-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.availableOnline}
            onChange={(e) => setFormData({ ...formData, availableOnline: e.target.checked })}
            className="rounded"
          />
          <span>Disponible en ligne</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.availableInPerson}
            onChange={(e) => setFormData({ ...formData, availableInPerson: e.target.checked })}
            className="rounded"
          />
          <span>Disponible en présentiel</span>
        </label>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={() => setFormData(INITIAL_FORM_DATA)}>
          Annuler
        </Button>
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            'Enregistrer'
          )}
        </Button>
      </div>
    </div>
  );
} 
