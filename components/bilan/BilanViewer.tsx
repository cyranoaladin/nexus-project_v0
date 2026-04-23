/**
 * F52: BilanViewer — Composant canonique de visualisation de bilan
 * Affiche un bilan avec gestion des audiences (élève, famille, Nexus)
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { Printer, ArrowLeft, Download, Share2 } from 'lucide-react';
import { BilanType } from '@/lib/bilan/types';

export interface BilanViewerData {
  id: string;
  publicShareId?: string;
  type: BilanType;
  subject: string;
  studentName: string;
  studentEmail?: string;
  globalScore?: number;
  confidenceIndex?: number;
  status: string;
  isPublished: boolean;
  studentMarkdown?: string;
  parentsMarkdown?: string;
  nexusMarkdown?: string;
  domainScores?: Array<{ domain: string; score: number }>;
  strengths?: string[];
  areasForGrowth?: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  ragUsed?: boolean;
  ragCollections?: string[];
}

interface BilanViewerProps {
  data: BilanViewerData;
  audience?: 'student' | 'parents' | 'nexus';
  showExport?: boolean;
  showShare?: boolean;
  onPrint?: () => void;
  onExport?: (format: 'pdf' | 'markdown') => void;
  onShare?: () => void;
  children?: React.ReactNode;
}

export default function BilanViewer({
  data,
  audience = 'student',
  showExport = true,
  showShare = false,
  onPrint,
  onExport,
  onShare,
  children,
}: BilanViewerProps) {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const getContent = () => {
    switch (audience) {
      case 'student':
        return data.studentMarkdown || 'Bilan en cours de génération...';
      case 'parents':
        return data.parentsMarkdown || 'Bilan en cours de génération...';
      case 'nexus':
        return data.nexusMarkdown || 'Bilan en cours de génération...';
      default:
        return data.studentMarkdown || '';
    }
  };

  const getAudienceLabel = () => {
    switch (audience) {
      case 'student':
        return 'Bilan Personnel';
      case 'parents':
        return 'Bilan Famille';
      case 'nexus':
        return 'Bilan Pédagogique';
      default:
        return 'Bilan';
    }
  };

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-slate-600';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 no-print">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo_nexus_reussite.png"
              alt="Nexus Réussite"
              width={132}
              height={40}
              priority
              className="h-8 w-auto object-contain"
            />
            <div>
              <p className="text-sm font-bold text-slate-900">{getAudienceLabel()}</p>
              <p className="text-xs text-slate-500">{data.subject} — {data.type}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showExport && (
              <>
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimer
                </button>
                <button
                  onClick={() => onExport?.('pdf')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </button>
              </>
            )}
            {showShare && (
              <button
                onClick={onShare}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                Partager
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Score summary */}
        {(data.globalScore !== undefined || data.confidenceIndex !== undefined) && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              {data.globalScore !== undefined && (
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-1">Score Global</p>
                  <p className={`text-3xl font-bold ${getScoreColor(data.globalScore)}`}>
                    {data.globalScore}/100
                  </p>
                </div>
              )}
              {data.confidenceIndex !== undefined && (
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-1">Indice de Confiance</p>
                  <p className={`text-3xl font-bold ${getScoreColor(data.confidenceIndex)}`}>
                    {data.confidenceIndex}/100
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bilan content */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div 
            className="prose prose-slate max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(getContent()) }}
          />
        </div>

        {/* Domain scores */}
        {data.domainScores && data.domainScores.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Résultats par domaine</h3>
            <div className="space-y-3">
              {data.domainScores.map((domain, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 capitalize">{domain.domain}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${getScoreColor(domain.score).replace('text-', 'bg-')}`}
                        style={{ width: `${domain.score}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium ${getScoreColor(domain.score)}`}>
                      {domain.score}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom content */}
        {children}

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 py-8 mt-8 border-t border-slate-200">
          <p>Bilan généré le {new Date(data.createdAt).toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}</p>
          {data.ragUsed && (
            <p className="mt-1 text-slate-400">
              Contexte RAG utilisé: {data.ragCollections?.join(', ') || 'N/A'}
            </p>
          )}
          <p className="mt-1 no-print">ID: {data.id}</p>
          {data.publicShareId && (
            <p className="mt-1 text-blue-600 no-print">
              Lien public: /b/{data.publicShareId}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

// Simple markdown to HTML renderer
function renderMarkdown(markdown: string): string {
  if (!markdown) return '';
  
  return markdown
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-slate-900 mb-4">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold text-slate-800 mt-6 mb-3">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-medium text-slate-700 mt-4 mb-2">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/^/g, '<p class="mb-4">')
    .replace(/$/g, '</p>');
}
