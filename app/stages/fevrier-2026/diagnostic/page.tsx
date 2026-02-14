'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import StageDiagnosticQuiz from '@/components/stages/StageDiagnosticQuiz';
import { Shield, Loader2 } from 'lucide-react';

/**
 * Page: /stages/fevrier-2026/diagnostic?email=xxx
 *
 * Students access this page via a link sent after registration.
 * The email query param identifies their reservation.
 */

function DiagnosticContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const reservationId = searchParams.get('rid') || undefined;

  const [email, setEmail] = useState(emailParam);
  const [started, setStarted] = useState(!!emailParam);

  if (!started) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <Shield className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-slate-900 mb-2">
              Diagnostic de Positionnement
            </h1>
            <p className="text-sm text-slate-600 mb-6">
              Entre l&apos;email utilisé lors de ton inscription au stage pour accéder au diagnostic.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) setStarted(true);
              }}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton.email@exemple.com"
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none mb-4"
              />
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
              >
                Accéder au diagnostic
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <StageDiagnosticQuiz
      email={email}
      reservationId={reservationId}
    />
  );
}

export default function DiagnosticPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      }
    >
      <DiagnosticContent />
    </Suspense>
  );
}
