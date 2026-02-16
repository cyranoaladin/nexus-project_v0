'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2, Lock } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

function ActivateForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'submitting' | 'success' | 'error'>('loading');
  const [studentName, setStudentName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const verifyToken = useCallback(async () => {
    if (!token) {
      setStatus('invalid');
      setError('Lien d\'activation invalide — token manquant.');
      return;
    }

    try {
      const res = await fetch(`/api/student/activate?token=${encodeURIComponent(token)}`);
      const data = await res.json();

      if (data.valid) {
        setStatus('valid');
        setStudentName(data.studentName || '');
        setEmail(data.email || '');
      } else {
        setStatus('invalid');
        setError(data.error || 'Lien d\'activation invalide ou expiré.');
      }
    } catch {
      setStatus('invalid');
      setError('Erreur de connexion au serveur.');
    }
  }, [token]);

  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setStatus('submitting');

    try {
      const res = await fetch('/api/student/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus('success');
        setTimeout(() => {
          router.push(data.redirectUrl || '/auth/signin?activated=true');
        }, 2000);
      } else {
        setStatus('error');
        setError(data.error || 'Erreur lors de l\'activation.');
      }
    } catch {
      setStatus('error');
      setError('Erreur de connexion au serveur.');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" />
          <p className="text-neutral-400">Vérification du lien d&apos;activation...</p>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-surface-card border border-white/10">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Lien invalide</h2>
            <p className="text-neutral-400 mb-6">{error}</p>
            <Button onClick={() => router.push('/auth/signin')} className="btn-primary">
              Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-surface-card border border-white/10">
          <CardContent className="pt-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Compte activé !</h2>
            <p className="text-neutral-400 mb-2">
              Bienvenue {studentName} ! Votre compte est maintenant actif.
            </p>
            <p className="text-neutral-500 text-sm">Redirection vers la connexion...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-darker flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-surface-card border border-white/10">
        <CardHeader className="text-center">
          <Lock className="w-10 h-10 text-brand-accent mx-auto mb-2" />
          <CardTitle className="text-white text-xl">Activer votre compte</CardTitle>
          <p className="text-neutral-400 text-sm mt-1">
            Bienvenue {studentName} ! Choisissez votre mot de passe pour accéder à votre espace élève.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-neutral-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 caractères"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-brand-accent focus:outline-none"
                minLength={8}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retapez votre mot de passe"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-brand-accent focus:outline-none"
                minLength={8}
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                <p className="text-sm text-rose-300">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full btn-primary"
            >
              {status === 'submitting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Activation en cours...
                </>
              ) : (
                'Activer mon compte'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-darker flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
        </div>
      }
    >
      <ActivateForm />
    </Suspense>
  );
}
