'use client';

import { useCallback, useEffect, useState } from 'react';

import type { CandidateDiagnosticConsentState } from '@/lib/diagnostics/candidat-libre/consent-gate.server';

/**
 * Écrans de recueil du consentement candidat libre.
 *
 * ⚠️ À RÉVISER par la direction pédagogique et le juriste avant ouverture.
 * La présentation familiale et le texte consenti restent leur décision ; ce
 * composant est une proposition de mise en forme, pas un texte arbitré.
 *
 * Deux invariants portés par l'interface :
 *
 * - la notice est rendue **verbatim** depuis le serveur, jamais recomposée ni
 *   résumée ici : le consentement porte sur ce texte précis, et le reformuler
 *   côté client le rendrait non éclairé ;
 * - la version présentée est renvoyée telle quelle au serveur, qui refuse toute
 *   autre valeur — la famille consent à la version qu'elle a réellement lue.
 *
 * Le style reprend les jetons de `lib/bilans/render/brand.ts`, ceux qui rendent
 * les tests papier, afin que la famille retrouve la même identité visuelle.
 */

type NoticeSection = Readonly<{ heading: string; body: readonly string[] }>;

type Notice = Readonly<{
  version: string;
  title: string;
  sections: readonly NoticeSection[];
  consentStatement: string;
  consentCheckbox: string;
}>;

const INK = '#071A3A';
const INK_SOFT = '#0E2547';
const GOLD = '#BFA06A';
const GOLD_WASH = '#EBDFC4';
const IVORY = '#F7F4ED';
const SLATE = '#5A6B82';

export type ConsentGateProps = Readonly<{
  studentId?: string;
  /** Nom du parent rattaché, pour nommer précisément qui serait autorisé. */
  parentName?: string;
  onGranted?: () => void;
}>;

export function ConsentGate({ studentId, parentName, onGranted }: ConsentGateProps) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [state, setState] = useState<CandidateDiagnosticConsentState | null>(null);
  const [accepted, setAccepted] = useState(false);
  // Décochée par défaut, et c'est le point : rien n'est partagé sans un geste
  // explicite de l'étudiant. Il est majeur, ces données sont les siennes.
  const [shareWithParent, setShareWithParent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = studentId
    ? `/api/diagnostics/candidat-libre/consent?studentId=${encodeURIComponent(studentId)}`
    : '/api/diagnostics/candidat-libre/consent';

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        setError("Ce parcours n'est pas accessible avec ce compte.");
        return;
      }
      const payload = await response.json();
      setNotice(payload.notice);
      setState(payload.consentState);
    } catch {
      setError('Le service est momentanément indisponible.');
    }
  }, [endpoint]);

  useEffect(() => { void load(); }, [load]);

  async function submit() {
    if (!notice) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/diagnostics/candidat-libre/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GRANT_STUDENT_CONSENT',
          studentId,
          // La version rendue est renvoyée telle quelle : le serveur refuse
          // toute valeur autre que la version courante.
          noticeVersion: notice.version,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          payload?.code === 'PARENTAL_CONSENT_REQUIRED'
            ? "Le consentement d'un parent est requis avant de continuer."
            : "Le consentement n'a pas pu être enregistré.",
        );
        return;
      }
      setState(payload.consentState);
      if (payload.consentState === 'GRANTED') {
        // L'autorisation d'accès du parent est un acte distinct du consentement :
        // elle n'est envoyée que si l'étudiant l'a explicitement cochée.
        if (shareWithParent) {
          await fetch('/api/diagnostics/candidat-libre/consent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'SET_PARENT_ACCESS', studentId, parentAccess: true }),
          });
        }
        onGranted?.();
      }
    } catch {
      setError('Le service est momentanément indisponible.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !notice) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center" style={{ color: SLATE }}>
        {error}
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center" style={{ color: SLATE }}>
        Chargement…
      </div>
    );
  }

  if (state === 'GRANTED') {
    return (
      <section
        className="mx-auto max-w-2xl rounded-2xl px-8 py-10 text-center"
        style={{ backgroundColor: IVORY, color: INK, border: `1px solid ${GOLD_WASH}` }}
      >
        <p className="text-lg">Le consentement est enregistré. Vous pouvez poursuivre.</p>
      </section>
    );
  }

  return (
    <article
      className="mx-auto max-w-3xl overflow-hidden rounded-2xl"
      style={{ backgroundColor: '#FBFAF5', color: INK, border: `1px solid ${GOLD_WASH}` }}
    >
      <header className="px-8 py-7" style={{ backgroundColor: INK, color: IVORY }}>
        <p
          className="text-xs uppercase tracking-[0.18em]"
          style={{ color: GOLD, fontFamily: 'DM Sans, system-ui, sans-serif' }}
        >
          Diagnostic candidat libre
        </p>
        <h1
          className="mt-2 text-3xl leading-tight"
          style={{ fontFamily: 'Fraunces, Georgia, serif', textWrap: 'balance' }}
        >
          {notice.title}
        </h1>
      </header>

      <div className="px-8 py-8" style={{ fontFamily: 'DM Sans, system-ui, sans-serif' }}>
        {/* Rendu verbatim : aucune reformulation côté client. */}
        {notice.sections.map((section) => (
          <section key={section.heading} className="mb-7 last:mb-0">
            <h2
              className="mb-2 text-lg"
              style={{ fontFamily: 'Fraunces, Georgia, serif', color: INK_SOFT }}
            >
              {section.heading}
            </h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mb-2 text-[15px] leading-relaxed" style={{ color: SLATE }}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <hr className="my-8" style={{ borderColor: GOLD_WASH }} />

        <section
          className="rounded-xl px-6 py-6"
          style={{ backgroundColor: IVORY, border: `1px solid ${GOLD_WASH}` }}
        >
          <p className="text-[15px] leading-relaxed" style={{ color: INK }}>
            {notice.consentStatement}
          </p>

          <label className="mt-5 flex cursor-pointer items-start gap-3 text-[15px]" style={{ color: INK }}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1 h-4 w-4"
              style={{ accentColor: GOLD }}
            />
            <span>{notice.consentCheckbox}</span>
          </label>

          <label className="mt-4 flex cursor-pointer items-start gap-3 text-[15px]" style={{ color: INK }}>
            <input
              type="checkbox"
              checked={shareWithParent}
              onChange={(event) => setShareWithParent(event.target.checked)}
              className="mt-1 h-4 w-4"
              style={{ accentColor: GOLD }}
            />
            <span>
              J’autorise {parentName ?? 'mon parent'} à consulter mes résultats.
              <span className="mt-1 block text-xs" style={{ color: SLATE }}>
                Facultatif. Sans cette autorisation, personne d’autre que vous et l’équipe
                pédagogique n’y a accès. Vous pouvez la retirer à tout moment.
              </span>
            </span>
          </label>

          {error ? (
            <p className="mt-4 text-sm" role="alert" style={{ color: '#7A6535' }}>
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={!accepted || busy}
            onClick={() => void submit()}
            className="mt-6 rounded-lg px-6 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: INK, color: IVORY }}
          >
            {busy ? 'Enregistrement…' : 'Je consens'}
          </button>

          <p className="mt-4 text-xs" style={{ color: SLATE }}>
            Version de la notice : {notice.version}
          </p>
        </section>
      </div>
    </article>
  );
}
