"use client"

import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Send, Bot, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react"
import { Subject } from "@/types/enums"

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

interface AriaEmbeddedChatProps {
  studentId: string
}

export function AriaEmbeddedChat({ studentId }: AriaEmbeddedChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [selectedSubject, setSelectedSubject] = useState<Subject>(Subject.MATHEMATIQUES)
  const [conversationId, setConversationId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string>("")
  const [error, setError] = useState<string>("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadConversationHistory = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/aria/conversations?subject=${selectedSubject}`)
      if (response.ok) {
        const data = await response.json()
        if (data.conversations && data.conversations.length > 0) {
          const latestConversation = data.conversations[0]
          setConversationId(latestConversation.id)
          
          interface ConversationMessage {
            id: string
            role: string
            content: string
            createdAt: string
            feedback?: boolean | null
          }
          
          const conversationMessages = latestConversation.messages.map((msg: ConversationMessage) => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: new Date(msg.createdAt),
            feedback: msg.feedback
          }))
          setMessages(conversationMessages)
        } else {
          setMessages([])
          setConversationId("")
        }
      }
    } catch (err) {
      console.error('Error loading conversation history:', err)
    }
  }, [selectedSubject])

  useEffect(() => {
    loadConversationHistory()
  }, [loadConversationHistory])

  const handleSendMessage = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setError("")
    setIsLoading(true)
    setIsStreaming(true)

    const tempStreamingId = `streaming-${Date.now()}`
    setStreamingMessageId(tempStreamingId)

    const streamingMessage: Message = {
      id: tempStreamingId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, streamingMessage])

    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/aria/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          subject: selectedSubject,
          content: input
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send message')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let buffer = ''
      let actualMessageId = tempStreamingId

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6)
            
            if (dataStr === '[DONE]') {
              setIsStreaming(false)
              setIsLoading(false)
              continue
            }

            try {
              const data = JSON.parse(dataStr)

              if (data.type === 'start') {
                setConversationId(data.conversationId)
              } else if (data.type === 'metadata') {
                actualMessageId = data.message.id
                setStreamingMessageId('')
                setMessages(prev => prev.map(msg => 
                  msg.id === tempStreamingId 
                    ? { ...msg, id: actualMessageId }
                    : msg
                ))
              } else if (data.content) {
                setMessages(prev => prev.map(msg =>
                  msg.id === tempStreamingId
                    ? { ...msg, content: msg.content + data.content }
                    : msg
                ))
              } else if (data.error) {
                throw new Error(data.error)
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError)
            }
          }
        }
      }

      setIsLoading(false)
      setIsStreaming(false)
      setStreamingMessageId('')

    } catch (err) {
      console.error('Error sending message:', err)
      
      const error = err as Error
      if (error.name !== 'AbortError') {
        setError(error.message || "Une erreur s'est produite. Veuillez réessayer.")
        setMessages(prev => prev.filter(msg => msg.id !== tempStreamingId))
      }
      
      setIsLoading(false)
      setIsStreaming(false)
      setStreamingMessageId('')
    }
  }

  const handleFeedback = async (messageId: string, feedback: boolean) => {
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
      console.error('Error submitting feedback:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b bg-gradient-to-r from-primary-500 to-secondary-500 text-white">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6" />
          ARIA - Assistant IA
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="mb-4">
          <Label className="text-sm font-medium text-gray-700 mb-2 block">
            Matière :
          </Label>
          <Select 
            value={selectedSubject} 
            onValueChange={(value) => {
              setSelectedSubject(value as Subject)
              setMessages([])
              setConversationId("")
            }}
          >
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

        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-sm">
                Posez votre première question sur <strong>{SUBJECTS_OPTIONS.find(s => s.value === selectedSubject)?.label}</strong> !
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                data-testid="aria-message"
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
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                    {message.id === streamingMessageId && isStreaming && (
                      <span className="inline-block w-2 h-4 ml-1 bg-blue-600 animate-pulse" />
                    )}
                  </p>
                </div>
                
                {message.role === 'assistant' && message.id !== streamingMessageId && message.content && (
                  <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-gray-200">
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

          {isLoading && !isStreaming && (
            <div className="flex justify-start">
              <div data-testid="loading" className="bg-blue-50 rounded-xl p-4 border border-slate-200">
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

          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="border-t pt-4">
          <div className="flex space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Posez votre question..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              size="default"
              className="px-4"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
