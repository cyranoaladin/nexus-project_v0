"use client";

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, User, BookOpen, Filter, Search, Eye, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Session {
  id: string;
  title: string;
  subject: string;
  scheduledDate: Date;
  startTime: string;
  endTime: string;
  duration: number;
  status: 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  type: 'INDIVIDUAL' | 'GROUP' | 'MASTERCLASS';
  modality: 'ONLINE' | 'IN_PERSON' | 'HYBRID';
  student: {
    id: string;
    firstName: string;
    lastName: string;
    grade: string;
  };
  coach: {
    id: string;
    firstName: string;
    lastName: string;
    pseudonym: string;
  };
  parent?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  creditsUsed: number;
  coachNotes?: string;
  studentNotes?: string;
  rating?: number;
  createdAt: Date;
}

interface SessionManagementProps {
  assistantId: string;
}

const STATUS_COLORS = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-slate-100 text-slate-800',
  NO_SHOW: 'bg-gray-100 text-gray-800'
};

const STATUS_LABELS = {
  SCHEDULED: 'Programmée',
  CONFIRMED: 'Confirmée',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  NO_SHOW: 'Absence'
};

export default function SessionManagement({ assistantId }: SessionManagementProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const sessionsPerPage = 10;

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/sessions?role=assistant&assistantId=${assistantId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load sessions');
      }
      
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [assistantId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const filterSessions = useCallback(() => {
    let filtered = [...sessions];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(session =>
        session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.coach.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.coach.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.coach.pseudonym.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.subject.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(session => session.status === statusFilter);
    }

    // Subject filter
    if (subjectFilter !== 'all') {
      filtered = filtered.filter(session => session.subject === subjectFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const today = new Date();
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
      const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
      
      filtered = filtered.filter(session => {
        const sessionDate = new Date(session.scheduledDate);
        
        switch (dateFilter) {
          case 'today':
            return sessionDate.toDateString() === new Date().toDateString();
          case 'tomorrow':
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return sessionDate.toDateString() === tomorrow.toDateString();
          case 'week':
            return sessionDate >= startOfWeek && sessionDate <= endOfWeek;
          case 'month':
            return sessionDate.getMonth() === new Date().getMonth() && 
                   sessionDate.getFullYear() === new Date().getFullYear();
          default:
            return true;
        }
      });
    }

    // Sort by date (most recent first)
    filtered.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());

    setFilteredSessions(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [sessions, searchTerm, statusFilter, subjectFilter, dateFilter]);

  useEffect(() => {
    filterSessions();
  }, [filterSessions]);

  const updateSessionStatus = async (sessionId: string, newStatus: string, notes?: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          notes: notes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update session status');
      }

      // Refresh sessions
      await loadSessions();
    } catch (err) {
      console.error('Error updating session status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update session');
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  // Get unique subjects for filter
  const uniqueSubjects = Array.from(new Set(sessions.map(s => s.subject)));

  // Pagination
  const totalPages = Math.ceil(filteredSessions.length / sessionsPerPage);
  const startIndex = (currentPage - 1) * sessionsPerPage;
  const endIndex = startIndex + sessionsPerPage;
  const currentSessions = filteredSessions.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Chargement des sessions...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Gestion des Sessions
          </h1>
          <p className="text-gray-600">
            Supervisez et gérez toutes les sessions de la plateforme
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="px-3 py-1">
            {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
          </Badge>
          <Button onClick={loadSessions} variant="outline" size="sm">
            Actualiser
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Filter className="w-5 h-5 mr-2" />
            Filtres et Recherche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-300 w-4 h-4" />
              <Input
                placeholder="Rechercher une session..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="SCHEDULED">Programmées</SelectItem>
                <SelectItem value="CONFIRMED">Confirmées</SelectItem>
                <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                <SelectItem value="COMPLETED">Terminées</SelectItem>
                <SelectItem value="CANCELLED">Annulées</SelectItem>
                <SelectItem value="NO_SHOW">Absences</SelectItem>
              </SelectContent>
            </Select>

            {/* Subject Filter */}
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Matière" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les matières</SelectItem>
                {uniqueSubjects.map(subject => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Filter */}
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les dates</SelectItem>
                <SelectItem value="today">Aujourd'hui</SelectItem>
                <SelectItem value="tomorrow">Demain</SelectItem>
                <SelectItem value="week">Cette semaine</SelectItem>
                <SelectItem value="month">Ce mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Sessions ({filteredSessions.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center">
              <AlertCircle className="w-4 h-4 text-slate-600 mr-2" />
              <span className="text-slate-700 text-sm">{error}</span>
            </div>
          )}

          {currentSessions.length > 0 ? (
            <div className="space-y-4">
              <AnimatePresence>
                {currentSessions.map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-medium text-gray-900 truncate">
                            {session.title}
                          </h3>
                          <Badge className={`text-xs ${STATUS_COLORS[session.status]}`}>
                            {STATUS_LABELS[session.status]}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {session.subject}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {formatDate(session.scheduledDate)}
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {formatTime(session.startTime)} - {formatTime(session.endTime)}
                          </div>
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-1" />
                            {session.student.firstName} {session.student.lastName}
                          </div>
                          <div className="flex items-center">
                            <BookOpen className="w-4 h-4 mr-1" />
                            {session.coach.pseudonym || `${session.coach.firstName} ${session.coach.lastName}`}
                          </div>
                        </div>

                        {session.coachNotes && (
                          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            <strong>Notes du coach:</strong> {session.coachNotes}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedSession(session)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Détails
                        </Button>

                        {session.status === 'SCHEDULED' && (
                          <Button
                            size="sm"
                            onClick={() => updateSessionStatus(session.id, 'CONFIRMED')}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Confirmer
                          </Button>
                        )}

                        {['SCHEDULED', 'CONFIRMED'].includes(session.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateSessionStatus(session.id, 'CANCELLED')}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Annuler
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Précédent
                  </Button>
                  
                  <span className="text-sm text-gray-600">
                    Page {currentPage} sur {totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Suivant
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune session trouvée
              </h3>
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all' || subjectFilter !== 'all' || dateFilter !== 'all'
                  ? 'Aucune session ne correspond aux filtres sélectionnés.'
                  : 'Aucune session programmée pour le moment.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Détails de la Session</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSession(null)}
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Titre</label>
                    <p className="text-gray-900">{selectedSession.title}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Matière</label>
                    <p className="text-gray-900">{selectedSession.subject}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Date</label>
                    <p className="text-gray-900">{formatDate(selectedSession.scheduledDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Heure</label>
                    <p className="text-gray-900">
                      {formatTime(selectedSession.startTime)} - {formatTime(selectedSession.endTime)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Élève</label>
                    <p className="text-gray-900">
                      {selectedSession.student.firstName} {selectedSession.student.lastName} ({selectedSession.student.grade})
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Coach</label>
                    <p className="text-gray-900">
                      {selectedSession.coach.pseudonym || `${selectedSession.coach.firstName} ${selectedSession.coach.lastName}`}
                    </p>
                  </div>
                  {selectedSession.parent && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Parent</label>
                      <p className="text-gray-900">
                        {selectedSession.parent.firstName} {selectedSession.parent.lastName}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Statut</label>
                    <Badge className={`${STATUS_COLORS[selectedSession.status]}`}>
                      {STATUS_LABELS[selectedSession.status]}
                    </Badge>
                  </div>
                </div>

                {selectedSession.coachNotes && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Notes du Coach</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded">{selectedSession.coachNotes}</p>
                  </div>
                )}

                {selectedSession.rating && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Évaluation</label>
                    <div className="flex items-center">
                      <span className="text-lg font-bold text-blue-600">{selectedSession.rating}/5</span>
                      <span className="text-gray-500 ml-2">⭐</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
