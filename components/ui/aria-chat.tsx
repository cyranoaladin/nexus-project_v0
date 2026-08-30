"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, X, Send, Bot, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  feedback?: boolean | null
}

const COURSES_OPTIONS = [
  { value: 'eds-maths-terminale', label: "Mathématiques (Terminale EDS)" },
  { value: 'eds-maths-premiere', label: "Mathématiques (Première EDS)" },
  { value: 'eds-nsi-terminale', label: "NSI (Terminale EDS)" },
  { value: 'eds-nsi-premiere', label: "NSI (Première EDS)" },
  { value: 'tc-francais-premiere', label: "Français (Première)" },
  { value: 'tc-philosophie-terminale', label: "Philosophie (Terminale)" },
]

export function AriaChat() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [selectedCourseKey, setSelectedCourseKey] = useState<string>('eds-maths-terminale')
  const [conversationId] = useState<string>("")
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
      // Invariant ACTIVE_SUBJECT_BASED_CHAT_CLIENTS=0 : envoi de courseKey
      const response = await fetch('/api/aria/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          courseKey: selectedCourseKey,
          content: input
        })
      })

      if (response.ok) {
        const data = await response.json()
        const ariaMessage: Message = {
          id: data.message?.id || (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message?.content || '',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, ariaMessage])
      } else {
        const errData = await response.json().catch(() => ({}))
        const errorMsg = errData.error || "Une erreur est survenue lors de la communication avec ARIA."
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: errorMsg,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch {
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
        ? "Bonjour ! Je suis ARIA, votre assistante IA pédagogique. Pour accéder à toutes mes fonctionnalités et bénéficier d'un suivi personnalisé, connectez-vous à votre compte Nexus Réussite."
        : "Pour continuer notre conversation et accéder à mes contenus pédagogiques exclusifs, veuillez vous connecter à votre compte."

      const ariaMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: demoResponse,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, ariaMessage])
      setIsLoading(false)
    }, 1000)
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

      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, feedback } : msg
      ))
    } catch (error) {
      console.error('Erreur feedback:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <>
      {/* Bouton flottant */}
      <div
        className="fixed bottom-6 right-6 z-50 lux-fade-in"
        style={{ animationDelay: '0.5s' }}
      >
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full w-14 h-14 bg-gradient-to-r from-nexus-gold via-nexus-gold-light to-nexus-gold hover:from-nexus-gold-light hover:to-nexus-gold text-nexus-black shadow-lg shadow-nexus-gold/20 hover:shadow-nexus-gold/30 hover:scale-105 transition-all duration-300 p-0"
        >
          <div className="relative">
            <MessageCircle className="h-6 w-6" />
            <Sparkles className="h-3 w-3 absolute -top-1 -right-1 text-nexus-black animate-pulse" />
          </div>
        </Button>
      </div>

      {/* Modal Chat */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nexus-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl"
            >
              <Card className="bg-nexus-navy-dark border border-nexus-gold/20 shadow-2xl shadow-nexus-black/50 overflow-hidden">
                {/* En-tête */}
                <CardHeader className="bg-gradient-to-r from-nexus-navy to-nexus-navy-light border-b border-nexus-gold/10 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-nexus-gold/10 border border-nexus-gold/30 flex items-center justify-center overflow-hidden">
                        <Image
                          src="/images/aria/aria_avatar.webp"
                          alt="ARIA"
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <CardTitle className="text-lg text-nexus-light font-cinzel">ARIA</CardTitle>
                          <span className="px-2 py-0.5 text-xs bg-nexus-gold/20 text-nexus-gold border border-nexus-gold/30 rounded-full">
                            IA Nexus
                          </span>
                        </div>
                        <p className="text-xs text-nexus-silver">
                          {isAuthenticated ? "Session active" : "Mode démonstration"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsOpen(false)}
                      className="text-nexus-silver hover:text-nexus-light hover:bg-nexus-white/5"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {/* Sélecteur de cours */}
                  <div className="p-3 border-b border-nexus-gold/10 bg-nexus-navy/30">
                    <div className="flex items-center space-x-3">
                      <Label htmlFor="courseKey" className="text-xs text-nexus-silver whitespace-nowrap">
                        Cours :
                      </Label>
                      <Select
                        value={selectedCourseKey}
                        onValueChange={(val) => setSelectedCourseKey(val)}
                      >
                        <SelectTrigger id="courseKey" className="bg-nexus-navy border-nexus-gold/20 text-nexus-light text-xs h-8">
                          <SelectValue placeholder="Sélectionnez un cours" />
                        </SelectTrigger>
                        <SelectContent className="bg-nexus-navy border-nexus-gold/20">
                          {COURSES_OPTIONS.map((course) => (
                            <SelectItem
                              key={course.value}
                              value={course.value}
                              className="text-xs text-nexus-silver hover:text-nexus-light focus:text-nexus-light focus:bg-nexus-gold/10"
                            >
                              {course.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Zone de messages */}
                  <div className="h-96 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                        <div className="w-12 h-12 rounded-full bg-nexus-gold/10 border border-nexus-gold/20 flex items-center justify-center">
                          <Bot className="h-6 w-6 text-nexus-gold" />
                        </div>
                        <h4 className="text-nexus-light font-cinzel text-sm">
                          Comment puis-je vous aider aujourd'hui ?
                        </h4>
                        <p className="text-xs text-nexus-silver max-w-sm">
                          Posez-moi vos questions sur le cours, les méthodes ou demandez-moi des exercices d'entraînement.
                        </p>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-3 text-xs leading-relaxed ${
                              message.role === 'user'
                                ? 'bg-nexus-gold text-nexus-black'
                                : 'bg-nexus-navy border border-nexus-gold/10 text-nexus-silver'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{message.content}</p>
                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-nexus-white/5 text-[10px] text-nexus-silver/60">
                              <span>
                                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {message.role === 'assistant' && isAuthenticated && (
                                <div className="flex items-center space-x-1 ml-2">
                                  <button
                                    onClick={() => handleFeedback(message.id, true)}
                                    className={`p-1 hover:text-nexus-gold transition-colors ${
                                      message.feedback === true ? 'text-nexus-gold' : ''
                                    }`}
                                  >
                                    <ThumbsUp className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => handleFeedback(message.id, false)}
                                    className={`p-1 hover:text-red-400 transition-colors ${
                                      message.feedback === false ? 'text-red-400' : ''
                                    }`}
                                  >
                                    <ThumbsDown className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-nexus-navy border border-nexus-gold/10 rounded-lg p-3 text-xs text-nexus-silver flex items-center space-x-2">
                          <Bot className="h-4 w-4 text-nexus-gold animate-bounce" />
                          <span>ARIA réfléchit...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Saisie du message */}
                  <div className="p-3 border-t border-nexus-gold/10 bg-nexus-navy/30">
                    <div className="flex space-x-2">
                      <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Posez votre question à ARIA..."
                        disabled={isLoading}
                        className="bg-nexus-navy border-nexus-gold/20 text-nexus-light text-xs focus:border-nexus-gold"
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={isLoading || !input.trim()}
                        className="bg-nexus-gold hover:bg-nexus-gold-light text-nexus-black px-3"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    {!isAuthenticated && (
                      <p className="text-[10px] text-nexus-gold/80 mt-2 text-center">
                        Mode démo limité. Pour une expérience complète,{" "}
                        <Link href="/auth/signin" className="underline hover:text-nexus-gold">
                          connectez-vous
                        </Link>
                        .
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
