"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail, ArrowLeft, CheckCircle, Loader2 } from "lucide-react"
import Link from "next/link"

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Simulation d'envoi d'email de réinitialisation
      // TODO: Implémenter la logique réelle de reset password
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setIsSuccess(true)
    } catch (error) {
      setError("Une erreur est survenue. Veuillez réessayer.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        
        <main className="py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="font-heading text-2xl font-bold text-slate-900 mb-4">
                Email Envoyé !
              </h1>
              <p className="text-slate-900">
                Si un compte existe avec cette adresse email, vous recevrez un lien 
                de réinitialisation dans quelques minutes.
              </p>
            </div>

            <Card className="border border-slate-200 shadow-md">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">
                      Vérifiez votre boîte email
                    </h3>
                    <p className="text-blue-800 text-sm">
                      Nous avons envoyé un lien de réinitialisation à <strong>{email}</strong>. 
                      Pensez à vérifier vos spams si vous ne le trouvez pas.
                    </p>
                  </div>

                  <div className="text-center space-y-3">
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/auth/signin">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Retour à la Connexion
                      </Link>
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setIsSuccess(false)
                        setEmail("")
                      }}
                      className="w-full"
                    >
                      Renvoyer l'email
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <main className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
          <div className="text-center mb-8">
            <Badge variant="default" className="mb-4">
              <Mail className="w-4 h-4 mr-2" />
              Récupération
            </Badge>
            <h1 className="font-heading text-3xl font-bold text-slate-900 mb-4">
              Mot de Passe Oublié
            </h1>
            <p className="text-slate-900">
              Saisissez votre adresse email pour recevoir un lien de réinitialisation
            </p>
          </div>

          <Card className="border border-slate-200 shadow-md">
            <CardHeader>
              <CardTitle className="text-center text-slate-900">
                Réinitialiser le Mot de Passe
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="email">Adresse Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre.email@exemple.com"
                    required
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Nous vous enverrons un lien sécurisé pour créer un nouveau mot de passe.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading || !email}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Envoyer le Lien de Réinitialisation
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/auth/signin" className="text-sm text-blue-600 hover:underline flex items-center justify-center">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Retour à la connexion
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}