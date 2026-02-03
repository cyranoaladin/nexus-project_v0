'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
            Erreur de chargement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-red-700 mb-2">
              Désolé, une erreur s&apos;est produite lors du chargement du tableau de bord.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details className="text-xs text-red-600 mt-3">
                <summary className="cursor-pointer font-medium mb-2">
                  Détails de l&apos;erreur (développement)
                </summary>
                <pre className="bg-red-100 p-2 rounded overflow-auto whitespace-pre-wrap">
                  {error.message}
                </pre>
              </details>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={reset}
              variant="outline"
              className="flex items-center gap-2 flex-1"
              aria-label="Réessayer de charger"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Réessayer
            </Button>
            <Link href="/dashboard/eleve" className="flex-1">
              <Button
                variant="default"
                className="w-full flex items-center gap-2"
                aria-label="Retour à l'accueil"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Accueil
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
