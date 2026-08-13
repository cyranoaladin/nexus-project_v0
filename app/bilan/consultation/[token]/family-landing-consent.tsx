'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Consentement et création d'accès en une seule étape, depuis la page
 * d'arrivée du lien signé (audience parents uniquement).
 *
 * États : le consentement déjà accordé s'affiche comme tel ; sinon la carte
 * propose la case de consentement et, facultatif, l'e-mail du parent pour
 * créer l'accès au dashboard. Un échec sur l'e-mail n'annule jamais un
 * consentement acquis — les deux résultats sont affichés séparément.
 */

type ConsentState =
  | 'LOADING'
  | 'IDLE'
  | 'SUBMITTING'
  | 'VERIFIED'
  | 'LOAD_ERROR'
  | 'SUBMIT_ERROR';

type EmailOutcome =
  | { status: 'QUEUED' }
  | { status: 'ALREADY_SET' }
  | { status: 'SKIPPED' }
  | { status: 'ERROR'; code: string };

const EMAIL_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_ALREADY_USED: 'Cette adresse est déjà utilisée par un autre compte. Contactez-nous pour la rattacher.',
  PARENT_EMAIL_ALREADY_SET: 'Une adresse est déjà associée à votre compte. Utilisez « mot de passe oublié » ou contactez-nous.',
  EMAIL_INVALID: 'Cette adresse ne semble pas valide. Vérifiez-la puis réessayez.',
};

export function FamilyLandingConsent({
  token,
  studentFirstName,
}: {
  token: string;
  studentFirstName: string;
}) {
  const [status, setStatus] = useState<ConsentState>('LOADING');
  const [consentChecked, setConsentChecked] = useState(false);
  const [parentEmail, setParentEmail] = useState('');
  const [parentHasEmail, setParentHasEmail] = useState(true);
  const [parentActivated, setParentActivated] = useState(false);
  const [resendState, setResendState] = useState<'IDLE' | 'SENDING' | 'SENT'>('IDLE');
  const [emailOutcome, setEmailOutcome] = useState<EmailOutcome | null>(null);

  const endpoint = `/api/bilan/consultation/${encodeURIComponent(token)}/consent`;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(endpoint, { method: 'GET' });
        if (!response.ok) throw new Error('LOAD_FAILED');
        const payload = await response.json();
        if (!active) return;
        setParentHasEmail(payload.parentHasEmail === true);
        setParentActivated(payload.parentActivated === true);
        setStatus(payload.state === 'VERIFIED' ? 'VERIFIED' : 'IDLE');
      } catch {
        if (active) setStatus('LOAD_ERROR');
      }
    })();
    return () => { active = false; };
  }, [endpoint]);

  const submit = useCallback(async () => {
    if (!consentChecked || status === 'SUBMITTING' || status === 'VERIFIED') return;
    setStatus('SUBMITTING');
    try {
      const body: Record<string, unknown> = { consent: true };
      if (!parentHasEmail && parentEmail.trim() !== '') body.parentEmail = parentEmail.trim();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('SUBMIT_FAILED');
      const payload = await response.json();
      if (payload.state !== 'VERIFIED') throw new Error('SUBMIT_FAILED');
      setEmailOutcome(payload.email ?? null);
      setStatus('VERIFIED');
    } catch {
      setStatus('SUBMIT_ERROR');
    }
  }, [consentChecked, status, parentHasEmail, parentEmail, endpoint]);

  if (status === 'LOADING') {
    return (
      <div className="rounded-[28px] border border-lux-line/40 bg-white/5 p-6 text-sm text-lux-on-dark-muted" role="status">
        Vérification de votre dossier…
      </div>
    );
  }

  if (status === 'LOAD_ERROR') {
    return (
      <div className="rounded-[28px] border border-lux-line/40 bg-white/5 p-6 text-sm text-lux-on-dark-muted" role="alert">
        L'état de votre dossier n'a pas pu être vérifié. Rechargez la page ou
        réessayez plus tard — la lecture du bilan ci-dessous reste disponible.
      </div>
    );
  }

  if (status === 'VERIFIED') {
    const accessGranted = emailOutcome?.status === 'QUEUED';
    const submitEmail = async (): Promise<void> => {
      if (parentEmail.trim() === '') return;
      setResendState('SENDING');
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ consent: true, parentEmail: parentEmail.trim() }),
        });
        if (!response.ok) throw new Error('ATTACH_FAILED');
        const payload = await response.json() as { email?: EmailOutcome };
        setEmailOutcome(payload.email ?? null);
        if (payload.email?.status === 'QUEUED') setParentHasEmail(true);
        setResendState('IDLE');
      } catch {
        setResendState('IDLE');
        setEmailOutcome({ status: 'ERROR', code: 'ATTACH_FAILED' });
      }
    };
    const resend = async (): Promise<void> => {
      setResendState('SENDING');
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ consent: true, resendActivation: true }),
        });
        if (!response.ok) throw new Error('RESEND_FAILED');
        setResendState('SENT');
      } catch {
        setResendState('IDLE');
      }
    };

    return (
      <div className="rounded-[28px] border border-lux-gold/40 bg-lux-gold/10 p-6" role="status">
        <p className="font-fraunces text-lg text-lux-ivory">Votre accord est enregistré.</p>

        {parentActivated ? (
          <>
            <p className="mt-2 text-sm leading-6 text-lux-on-dark-muted">
              Le bilan de {studentFirstName} est disponible dans votre espace parent.
            </p>
            <a
              href="/auth/signin"
              className="lux-cta-primary lux-focus mt-4 inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold"
            >
              Ouvrir mon espace parent
            </a>
          </>
        ) : parentHasEmail || accessGranted ? (
          <>
            <p className="mt-2 text-sm leading-6 text-lux-on-dark-muted">
              {accessGranted
                ? 'Un e-mail d’activation vient de vous être envoyé : ouvrez-le pour choisir votre mot de passe — votre espace parent s’ouvrira ensuite.'
                : 'Un lien d’activation vous attend dans votre boîte e-mail : ouvrez-le pour choisir votre mot de passe. Pensez à vérifier vos courriers indésirables.'}
            </p>
            <button
              type="button"
              onClick={() => void resend()}
              disabled={resendState !== 'IDLE'}
              className="lux-focus mt-4 inline-flex items-center rounded-full border border-lux-gold/50 px-5 py-2.5 text-sm font-semibold text-lux-ivory disabled:opacity-60"
            >
              {resendState === 'SENDING' ? 'Envoi…' : resendState === 'SENT' ? 'E-mail renvoyé ✓' : 'Renvoyer l’e-mail d’activation'}
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-lux-on-dark-muted">
              Dernière étape pour retrouver ce bilan à tout moment : indiquez
              votre e-mail, vous recevrez un lien pour choisir votre mot de
              passe et ouvrir votre espace parent.
            </p>
            <label htmlFor="family-landing-email-after" className="mt-4 block text-sm font-medium text-lux-ivory">
              Votre e-mail
            </label>
            <input
              id="family-landing-email-after"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={parentEmail}
              onChange={(event) => setParentEmail(event.target.value)}
              placeholder="vous@exemple.fr"
              className="lux-focus mt-2 w-full max-w-md rounded-xl border border-lux-line/40 bg-lux-ink/60 px-4 py-2.5 text-sm text-lux-ivory placeholder:text-lux-on-dark-subtle"
            />
            <button
              type="button"
              onClick={() => void submitEmail()}
              disabled={parentEmail.trim() === '' || resendState === 'SENDING'}
              className="lux-cta-primary lux-focus mt-4 inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resendState === 'SENDING' ? 'Création…' : 'Créer mon accès parent'}
            </button>
            <p className="mt-3 text-xs leading-5 text-lux-on-dark-subtle">
              Facultatif : sans adresse, vous gardez la lecture et le PDF via ce lien.
            </p>
          </>
        )}

        {emailOutcome?.status === 'ERROR' ? (
          <p className="mt-3 text-sm leading-6 text-amber-200" role="alert">
            {EMAIL_ERROR_MESSAGES[emailOutcome.code] ?? 'La création de votre accès a échoué — votre accord, lui, est bien enregistré. Réessayez, ou rapprochez-vous de l’équipe.'}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-lux-line/40 bg-white/5 p-6">
      <p className="lux-eyebrow text-lux-gold">Une seule étape</p>
      <h2 className="mt-2 font-fraunces text-xl font-light text-lux-ivory">
        Votre accord, puis votre espace
      </h2>
      <p className="mt-3 text-sm leading-7 text-lux-on-dark-muted">
        Pour retrouver ce bilan à tout moment dans votre espace parent — et
        suivre le parcours de {studentFirstName} pendant le stage — confirmez
        votre accord ci-dessous. La lecture du document, elle, ne demande
        rien : elle vous est déjà ouverte.
      </p>

      <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-lux-ivory">
        <input
          type="checkbox"
          checked={consentChecked}
          onChange={(event) => setConsentChecked(event.target.checked)}
          className="lux-focus mt-1 h-4 w-4 accent-[#BFA06A]"
        />
        <span>
          Je confirme être le parent (ou responsable légal) de {studentFirstName} et
          j'accepte que Nexus Réussite me donne accès à ses bilans dans mon
          espace parent, dans les conditions de la{' '}
          <a href="/politique-confidentialite" target="_blank" rel="noreferrer" className="underline decoration-lux-gold/60 underline-offset-2">
            politique de confidentialité
          </a>.
        </span>
      </label>

      {!parentHasEmail ? (
        <div className="mt-5">
          <label htmlFor="family-landing-email" className="block text-sm font-medium text-lux-ivory">
            Votre e-mail <span className="font-normal text-lux-on-dark-subtle">(facultatif — pour créer votre accès)</span>
          </label>
          <input
            id="family-landing-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={parentEmail}
            onChange={(event) => setParentEmail(event.target.value)}
            placeholder="vous@exemple.fr"
            className="lux-focus mt-2 w-full max-w-md rounded-xl border border-lux-line/40 bg-lux-ink/60 px-4 py-2.5 text-sm text-lux-ivory placeholder:text-lux-on-dark-subtle"
          />
          <p className="mt-2 text-xs leading-5 text-lux-on-dark-subtle">
            Vous recevrez un e-mail pour choisir votre mot de passe. Sans
            adresse, vous pouvez simplement lire et télécharger le bilan.
          </p>
        </div>
      ) : null}

      {status === 'SUBMIT_ERROR' ? (
        <p className="mt-4 text-sm text-amber-200" role="alert">
          L'enregistrement n'a pas abouti. Vérifiez votre connexion puis
          réessayez.
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={!consentChecked || status === 'SUBMITTING'}
        className="lux-cta-reserve lux-focus mt-6 inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'SUBMITTING' ? 'Enregistrement…' : 'Confirmer mon accord'}
      </button>
    </div>
  );
}
