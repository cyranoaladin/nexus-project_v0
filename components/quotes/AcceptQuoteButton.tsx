'use client';

import { useState } from 'react';

export function AcceptQuoteButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  if (status === 'done') {
    return (
      <p className="rounded-xl border border-lux-evergreen/30 bg-lux-evergreen/5 p-4 text-sm font-semibold text-lux-evergreen">
        Devis accepté — notre équipe vous recontacte pour la suite.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={status === 'loading'}
        onClick={async () => {
          setStatus('loading');
          try {
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            const encodedToken = pathParts[0] === 'devis' && pathParts.length === 2 ? pathParts[1] : null;
            if (!encodedToken) throw new Error('family_link_missing');
            const res = await fetch(`/api/quotes/public/${encodedToken}/accept`, {
              method: 'POST',
            });
            if (!res.ok) throw new Error('accept_failed');
            setStatus('done');
          } catch {
            setStatus('error');
          }
        }}
        className="lux-cta-reserve min-h-[44px] rounded-lg px-8 py-3 text-sm font-semibold disabled:opacity-50"
      >
        {status === 'loading' ? 'Envoi…' : "J'accepte ce devis"}
      </button>
      {status === 'error' && (
        <p role="alert" className="mt-2 text-sm text-red-800">
          Une erreur est survenue. Contactez-nous directement si le problème persiste.
        </p>
      )}
    </div>
  );
}
