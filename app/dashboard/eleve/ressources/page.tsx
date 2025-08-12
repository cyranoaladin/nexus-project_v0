"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BookOpen, ArrowLeft, Search, Filter, Download, Eye, Clock } from "lucide-react"
import Link from "next/link"
import { Subject } from "@/types/enums"

const SUBJECTS_OPTIONS = [
  { value: "all", label: "Toutes les matières" },
  { value: Subject.MATHEMATIQUES, label: "Mathématiques" },
  { value: Subject.NSI, label: "NSI" },
  { value: Subject.FRANCAIS, label: "Français" },
  { value: Subject.PHILOSOPHIE, label: "Philosophie" },
  { value: Subject.HISTOIRE_GEO, label: "Histoire-Géographie" },
  { value: Subject.ANGLAIS, label: "Anglais" },
  { value: Subject.ESPAGNOL, label: "Espagnol" },
  { value: Subject.PHYSIQUE_CHIMIE, label: "Physique-Chimie" },
  { value: Subject.SVT, label: "SVT" },
  { value: Subject.SES, label: "SES" }
]

const MOCK_RESOURCES = [
  {
    id: "1",
    title: "Fiche de révision : Les dérivées",
    subject: Subject.MATHEMATIQUES,
    type: "Fiche",
    description: "Toutes les formules et méthodes essentielles",
    lastUpdated: "Il y a 2 jours",
    downloads: 156
  },
  {
    id: "2",
    title: "Exercices corrigés : Algorithmes Python",
    subject: Subject.NSI,
    type: "Exercices",
    description: "20 exercices progressifs avec corrections détaillées",
    lastUpdated: "Il y a 1 semaine",
    downloads: 89
  },
  {
    id: "3",
    title: "Méthodologie : La dissertation",
    subject: Subject.FRANCAIS,
    type: "Méthode",
    description: "Plan type et conseils pour réussir",
    lastUpdated: "Il y a 3 jours",
    downloads: 234
  },
  {
    id: "4",
    title: "Quiz interactif : Fonctions exponentielles",
    subject: Subject.MATHEMATIQUES,
    type: "Quiz",
    description: "15 questions pour tester vos connaissances",
    lastUpdated: "Il y a 5 jours",
    downloads: 67
  }
]

interface Resource {
  id: string;
  title: string;
  description: string;
  subject: string;
  type: string;
  fileUrl: string;
  thumbnailUrl?: string;
  downloads: number;
  lastUpdated: string;
  isDownloaded: boolean;
}

export default function RessourcesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSubject, setSelectedSubject] = useState("all")
  const [selectedType, setSelectedType] = useState("all")
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "loading") return

    if (!session || session.user.role !== 'ELEVE') {
      router.push("/auth/signin")
      return
    }

    const fetchResources = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch('/api/student/resources')
        
        if (!response.ok) {
          throw new Error('Failed to fetch resources')
        }
        
        const data = await response.json()
        setResources(data)
      } catch (err) {
        console.error('Error fetching resources:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchResources()
  }, [session, status, router])

  const filteredResources = resources.filter(resource => {
    const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         resource.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSubject = selectedSubject === "all" || resource.subject === selectedSubject
    const matchesType = selectedType === "all" || resource.type === selectedType
    
    return matchesSearch && matchesSubject && matchesType
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600">⏳</div>
          <p className="text-gray-600">Chargement des ressources...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-4 text-red-600">⚠️</div>
          <p className="text-red-600 mb-4">Erreur lors du chargement</p>
          <p className="text-gray-600 text-sm">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="mt-4"
          >
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button variant="ghost" asChild className="mr-4">
              <Link href="/dashboard/eleve">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour au Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="font-semibold text-gray-900">Mes Ressources</h1>
              <p className="text-sm text-gray-500">Fiches, exercices et contenus pédagogiques</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtres et recherche */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="w-5 h-5 mr-2 text-blue-600" />
              Recherche et Filtres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Rechercher une ressource..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Matière" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS_OPTIONS.map((subject) => (
                    <SelectItem key={subject.value} value={subject.value}>
                      {subject.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="Fiche">Fiches</SelectItem>
                  <SelectItem value="Exercices">Exercices</SelectItem>
                  <SelectItem value="Méthode">Méthodologie</SelectItem>
                  <SelectItem value="Quiz">Quiz</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Liste des ressources */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.length === 0 ? (
            <div className="col-span-full">
              <Card>
                <CardContent className="text-center py-12">
                  <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Aucune ressource trouvée
                  </h3>
                  <p className="text-gray-500">
                    Essayez de modifier vos critères de recherche.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            filteredResources.map((resource) => (
              <Card key={resource.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <Badge variant="outline" className="mb-2">
                      {resource.subject}
                    </Badge>
                    <div className="flex space-x-1">
                      <Badge variant="default">
                        {resource.type}
                      </Badge>
                      {resource.isDownloaded && (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          Téléchargé
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-lg leading-tight">
                    {resource.title}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <p className="text-gray-600 text-sm">
                    {resource.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(resource.lastUpdated).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <span>{resource.downloads} téléchargements</span>
                  </div>

                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <Eye className="w-4 h-4 mr-1" />
                      Voir
                    </Button>
                    <Button size="sm" className="flex-1">
                      <Download className="w-4 h-4 mr-1" />
                      Télécharger
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  )
}