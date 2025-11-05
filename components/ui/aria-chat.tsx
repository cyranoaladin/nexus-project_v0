"use client"

import React from "react"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, X, Send, Bot, ThumbsUp, ThumbsDown } from "lucide-react"
import Image from "next/image"
import { Subject } from "@/types/enums"
import Link from "next/link"

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  feedback?: boolean | null
}

const SUBJECTS_OPTIONS = [
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

export function AriaChat() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [selectedSubject, setSelectedSubject] = useState<Subject>(Subject.MATHEMATIQUES)
  const [conversationId, setConversationId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    if (session?.user.role === 'ELEVE') {
      setIsAuthenticated(true)
    } else {
      setIsAuthenticated(false)
    }
  }, [session])

  const handleSendMessage = async () => {
    if (!input.trim()) return

    if (!isAuthenticated) {
      // Mode démo pour utilisateurs non connectés
      handleDemoMessage()
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch('/api/aria/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          subject: selectedSubject,
          content: input
        })
      })

      const result = await response.json()

      if (response.ok) {
        const ariaMessage: Message = {
          id: result.message.id,
          role: 'assistant',
          content: result.message.content,
          timestamp: new Date(result.message.createdAt)
        }

        setMessages(prev => [...prev, ariaMessage])
        
        if (!conversationId) {
          setConversationId(result.conversation.id)
        }

        // Afficher les nouveaux badges si il y en a
        if (result.newBadges && result.newBadges.length > 0) {
          // TODO: Afficher notification de nouveaux badges
          console.log('Nouveaux badges:', result.newBadges)
        }
      } else {
        throw new Error(result.error || 'Erreur lors de la communication avec ARIA')
      }
    } catch (error) {
      console.error('Erreur ARIA:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Désolé, je rencontre une difficulté technique. Veuillez réessayer ou contacter un coach.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoMessage = () => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    setTimeout(() => {
      const demoResponse = messages.length === 0 
        ? "Bonjour ! Je suis ARIA, votre assistant IA pédagogique. Pour accéder à toutes mes fonctionnalités et bénéficier d'un suivi personnalisé, connectez-vous à votre compte Nexus Réussite."
        : "Pour continuer notre conversation et accéder à mes contenus pédagogiques exclusifs, veuillez vous connecter à votre compte."

      const ariaMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: demoResponse,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, ariaMessage])
      setIsLoading(false)
    }, 1500)
  }

  const handleFeedback = async (messageId: string, feedback: boolean) => {
    if (!isAuthenticated) return

    try {
      await fetch('/api/aria/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messageId,
          feedback
        })
      })

      // Mettre à jour le message avec le feedback
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, feedback } : msg
      ))
    } catch (error) {
      console.error('Erreur feedback:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <>
      {/* Bouton flottant */}
      <motion.div
        className="fixed bottom-6 right-6 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 2, type: "spring", stiffness: 200 }}
      >
        <Button
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 rounded-full shadow-xl bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 group"
        >
          <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </Button>
        
        {/* Bulle d'invitation */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 3 }}
          className="absolute bottom-20 right-0 bg-white rounded-lg shadow-lg p-3 w-48 border border-gray-200"
        >
          <div className="flex items-start space-x-2">
            <Image
              src="/images/aria.png"
              alt="ARIA"
              width={32}
              height={32}
              className="rounded-full"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">ARIA</p>
              <p className="text-xs text-gray-600 whitespace-nowrap">
                Essayez-moi gratuitement 👋
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Fenêtre de chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-24 right-6 z-50 w-[480px] h-[600px] max-w-[90vw] max-h-[80vh]"
          >
            <Card className="h-full shadow-2xl border-0 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Image
                      src="/images/aria.png"
                      alt="ARIA"
                      width={48}
                      height={48}
                      className="rounded-full"
                    />
                    <div>
                      <CardTitle className="text-xl font-bold">ARIA</CardTitle>
                      <p className="text-sm text-white/90">Assistant IA Pédagogique 24/7</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="text-white hover:bg-white/20"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="flex flex-col h-full p-0">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.length === 0 && !isAuthenticated && (
                    <div className="text-center text-bleu-nuit py-12">
                      <Image
                        src="/images/aria.png"
                        alt="ARIA"
                        width={80}
                        height={80}
                        className="mx-auto mb-4 rounded-full"
                      />
                      <h3 className="font-heading font-semibold text-lg text-bleu-nuit mb-2">
                        Bonjour ! Je suis ARIA 👋
                      </h3>
                      <p className="text-sm text-bleu-nuit/80 leading-relaxed">
                        Posez-moi une question pour commencer !<br />
                        <span className="text-xs text-blue-600 font-medium">
                          Démonstration gratuite - Connectez-vous pour plus
                        </span>
                      </p>
                    </div>
                  )}

                  {messages.length === 0 && isAuthenticated && (
                    <div className="text-center text-bleu-nuit py-12">
                      <Image
                        src="/images/aria.png"
                        alt="ARIA"
                        width={80}
                        height={80}
                        className="mx-auto mb-4 rounded-full"
                      />
                      <h3 className="font-heading font-semibold text-lg text-bleu-nuit mb-2">
                        Bonjour {session?.user.firstName} ! 👋
                      </h3>
                      <p className="text-sm text-bleu-nuit/80 leading-relaxed">
                        Je suis ARIA, votre assistant IA personnel.<br />
                        Choisissez une matière et posez-moi votre question !
                      </p>
                    </div>
                  )}

                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl p-4 shadow-sm ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-50 text-bleu-nuit border border-slate-200'
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          {message.role === 'assistant' && (
                            <Bot className="w-5 h-5 mt-0.5 text-blue-600 flex-shrink-0" />
                          )}
                          <p className="text-sm leading-relaxed">{message.content}</p>
                        </div>
                        
                        {/* Feedback pour les réponses ARIA */}
                        {message.role === 'assistant' && isAuthenticated && (
                          <div className="flex items-center space-x-2 mt-3">
                            <span className="text-xs text-gray-500">Cette réponse vous a-t-elle aidé ?</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleFeedback(message.id, true)}
                              className={`h-6 w-6 p-0 ${message.feedback === true ? 'text-green-600' : 'text-gray-400'}`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleFeedback(message.id, false)}
                              className={`h-6 w-6 p-0 ${message.feedback === false ? 'text-red-600' : 'text-gray-400'}`}
                            >
                              <ThumbsDown className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-blue-50 rounded-xl p-4 border border-slate-200">
                        <div className="flex items-center space-x-2">
                          <Bot className="w-5 h-5 text-blue-600" />
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isAuthenticated && messages.length >= 2 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                      <p className="text-sm text-blue-800 mb-4 font-medium">
                        Connectez-vous pour continuer ! 🎉
                      </p>
                      <Button asChild size="default" className="w-full bg-blue-600 hover:bg-blue-700">
                        <Link href="/auth/signin">
                          Se Connecter
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Input */}
                {(isAuthenticated || messages.length < 2) && (
                  <div className="border-t border-slate-200 p-6 bg-white">
                    {/* Sélecteur de matière pour utilisateurs connectés */}
                    {isAuthenticated && (
                      <div className="mb-4">
                        <Label className="text-sm font-medium text-gray-700 mb-2 block">
                          Matière :
                        </Label>
                        <Select value={selectedSubject} onValueChange={(value) => setSelectedSubject(value as Subject)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SUBJECTS_OPTIONS.map((subject) => (
                              <SelectItem key={subject.value} value={subject.value}>
                                {subject.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    <div className="flex space-x-3">
                      <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={isAuthenticated ? `Posez votre question en ${SUBJECTS_OPTIONS.find(s => s.value === selectedSubject)?.label}...` : "Posez votre question..."}
                        disabled={isLoading}
                        className="flex-1 h-12 text-sm"
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!input.trim() || isLoading}
                        size="default"
                        className="h-12 px-4 bg-blue-600 hover:bg-blue-700"
                      >
                        <Send className="w-5 h-5" />
                      </Button>
                    </div>
                    {!isAuthenticated && (
                      <p className="text-xs text-bleu-nuit/60 mt-3 text-center font-medium">
                        Mode démonstration - Connectez-vous pour l'expérience complète
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}