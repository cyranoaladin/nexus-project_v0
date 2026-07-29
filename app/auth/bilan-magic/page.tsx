'use client';

import { useEffect, useRef, useState } from 'react';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type PageState = 'verifying' | 'success' | 'error';

function readAndStripFragment(): string | null {
  const fragment = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;

  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}`,
  );
  // jsdom and hardened webviews may expose a replaceState implementation that
  // does not refresh Location synchronously. Never leave the credential behind.
  if (window.location.hash) {
    window.location.hash = '';
  }

  const parameters = new URLSearchParams(fragment);
  const tokens = parameters.getAll('token');
  if (
    tokens.length !== 1
    || Array.from(parameters.keys()).length !== 1
    || !/^[A-Za-z0-9_-]{43}$/.test(tokens[0])
  ) {
    return null;
  }
  return tokens[0];
}

export default function BilanMagicPage() {
  const router = useRouter();
  const started = useRef(false);
  const [state, setState] = useState<PageState>('verifying');

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = readAndStripFragment();
    if (!token) {
      setState('error');
      return;
    }

    void (async () => {
      try {
        const result = await signIn('bilan-magic', {
          redirect: false,
          token,
        });
        if (!result?.ok || result.error) {
          setState('error');
          return;
        }
        setState('success');
        router.replace('/bilan-gratuit');
      } catch {
        setState('error');
      }
    })();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F5EE] px-6 py-16">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
          Nexus Réussite
        </p>
        <h1 className="text-2xl font-semibold text-slate-950">
          Reprise de votre bilan
        </h1>
        {state === 'verifying' && (
          <p className="mt-4 text-slate-600" aria-live="polite">
            Vérification sécurisée en cours…
          </p>
        )}
        {state === 'success' && (
          <p className="mt-4 text-emerald-700" aria-live="polite">
            Accès confirmé. Redirection vers votre bilan…
          </p>
        )}
        {state === 'error' && (
          <div className="mt-5" role="alert">
            <p className="font-medium text-slate-800">
              Ce lien est invalide ou a expiré.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Demandez un nouveau lien depuis le parcours de bilan gratuit.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
