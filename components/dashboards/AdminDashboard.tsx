'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Search, Loader2 } from 'lucide-react';
import useDebounce from '@/hooks/use-debounce';

type StudentSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  user: { email: string };
};

type AdminSummary = {
  riskAnalysis: string;
  criticalPoints: string[];
  offerRecommendation: string;
  nextSteps: string[];
};

export default function AdminDashboard({ role }: { role: 'ADMIN' | 'ASSISTANTE' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    const searchStudents = async () => {
      if (debouncedSearchTerm.length < 3) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin/students?search=${debouncedSearchTerm}`);
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        setResults(data);
      } catch (error) {
        console.error(error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    searchStudents();
  }, [debouncedSearchTerm]);

  const handleSelectStudent = async (student: StudentSearchResult) => {
    setSelectedStudent(student);
    setIsSummaryLoading(true);
    setSummary(null);
    try {
       // TODO: Remplacer par des vraies données QCM et Volet 2
      const fakeQcmData = { total: 32, max: 40, scoreGlobalPct: 80, weakDomainsCount: 1, domains: [] };
      const fakeVolet2Data = { indices: {}, portraitText: "", badges: [] };

      const response = await fetch('/api/bilans/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, qcm: fakeQcmData, volet2: fakeVolet2Data }),
      });
      if (!response.ok) throw new Error('Summary generation failed');
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-2">Dashboard {role === 'ADMIN' ? 'Administrateur' : 'Assistante'}</h1>
      <p className="text-gray-600 mb-6">Rechercher un élève pour consulter ou générer un bilan.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Rechercher un élève</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Nom, prénom ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                {isLoading && <Loader2 className="animate-spin mx-auto" />}
                {results.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => handleSelectStudent(student)}
                    className="p-3 rounded-md hover:bg-gray-100 cursor-pointer border"
                  >
                    <p className="font-semibold">{student.firstName} {student.lastName}</p>
                    <p className="text-sm text-gray-500">{student.user.email}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-2">
          {selectedStudent && (
            <Card>
              <CardHeader>
                <CardTitle>Détails de {selectedStudent.firstName} {selectedStudent.lastName}</CardTitle>
                <CardDescription>Synthèse opérationnelle et actions.</CardDescription>
              </CardHeader>
              <CardContent>
                {isSummaryLoading && <Loader2 className="animate-spin mx-auto w-8 h-8" />}
                {summary && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg">Analyse de risque</h3>
                      <p className="text-gray-700">{summary.riskAnalysis}</p>
                    </div>
                     <div>
                      <h3 className="font-semibold text-lg">Points critiques</h3>
                      <ul className="list-disc list-inside text-gray-700">
                        {summary.criticalPoints.map((point, i) => <li key={i}>{point}</li>)}
                      </ul>
                    </div>
                     <div>
                      <h3 className="font-semibold text-lg">Offre recommandée</h3>
                      <p className="text-gray-700">{summary.offerRecommendation}</p>
                    </div>
                     <div>
                      <h3 className="font-semibold text-lg">Prochaines étapes</h3>
                       <ul className="list-disc list-inside text-gray-700">
                        {summary.nextSteps.map((step, i) => <li key={i}>{step}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="gap-2">
                <Button>Générer PDF (Parent)</Button>
                <Button variant="outline">Générer PDF (Élève)</Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}



