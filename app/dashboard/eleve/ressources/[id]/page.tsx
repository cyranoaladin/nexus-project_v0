import { prisma } from '@/lib/prisma'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface PageProps { params: { id: string } }

export default async function ResourceDetailPage({ params }: PageProps) {
  const { id } = params
  const resource = await prisma.pedagogicalContent.findUnique({ where: { id } })

  if (!resource) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ressource introuvable</h1>
          <a href="/dashboard/eleve/ressources" className="text-blue-600 hover:underline">← Retour aux ressources</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4">
          <a href="/dashboard/eleve/ressources" className="text-blue-600 hover:underline">← Retour aux ressources</a>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{resource.title}</h1>
        <div className="text-sm text-gray-500 mb-6">{resource.subject} • Mise à jour: {new Date(resource.updatedAt).toLocaleDateString('fr-FR')}</div>
        <article className="prose max-w-none">
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {resource.content || ''}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  )
}

