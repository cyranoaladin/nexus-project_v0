"use client"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Badge } from "@/components/ui/badge"
import { MapPin } from "lucide-react"

export default function NotreCentrePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge variant="outline" className="mb-4">
              <MapPin className="w-4 h-4 mr-2" />
              Notre Centre
            </Badge>
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Le Centre Nexus Réussite
            </h1>
            <div className="bg-white rounded-xl p-12 shadow-soft max-w-2xl mx-auto">
              <p className="text-xl text-gray-600 mb-8">
                Page en construction
              </p>
              <p className="text-gray-500">
                Notre centre de Tunis sera bientôt présenté en détail avec toutes ses installations premium.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}