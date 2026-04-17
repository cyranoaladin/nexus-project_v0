'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';

import StageDiagnosticQuiz from '@/components/stages/StageDiagnosticQuiz';

function DiagnosticContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams?.get('email') || '';
  const reservationId = searchParams?.get('rid') || undefined;

  const [email, setEmail] = useState(emailParam);
  const [started, setStarted] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (emailParam) {
      verifyEmail(emailParam);
    }
  }, [emailParam]);

  async function verifyEmail(emailToVerify: string) {
    setVerifying(true);
    setError('');
    try {
      const res = await fetch('/api/reservation/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToVerify.trim() }),
      });
      const data = await res.json();
      if (data.exists) {
        setStarted(true);
      } else {
        setError("Aucune réservation trouvée avec cet email. Vérifiez l'adresse utilisée lors de l'inscription.");
      }
    } catch {
      setError('Erreur de vérification. Réessayez dans quelques instants.');
    } finally {
      setVerifying(false);
    }
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <Shield className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-slate-900 mb-2">Diagnostic de positionnement</h1>
            <p className="text-sm text-slate-600 mb-6">
              Entrez l&apos;email utilisé lors de votre inscription au stage pour accéder au diagnostic.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (email.trim()) verifyEmail(email);
              }}
            >
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                }}
                placeholder="ton.email@exemple.com"
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none mb-4"
              />
              {error ? <p className="text-slate-600 text-xs mb-3">{error}</p> : null}
              <button
                type="submit"
                disabled={verifying}
                className="w-full py-3 bg-gradient-to-r from-blue-700 to-slate-700 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {verifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Vérification...
                  </span>
                ) : 'Accéder au diagnostic'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return <StageDiagnosticQuiz email={email} reservationId={reservationId} />;
}

export default function DynamicDiagnosticPage() {
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
