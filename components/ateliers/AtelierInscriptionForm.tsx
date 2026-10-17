'use client';

import { useMemo, useState, type FormEvent } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  CLASSES,
  THEMES,
  ateliersOuverts,
  erreursDemande,
  messageDemande,
  type ClasseTunisienne,
  type DemandeAtelier,
} from '@/lib/ateliers';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

const CHAMP = 'border-lux-line bg-lux-paper text-lux-ink placeholder:text-lux-slate focus-visible:ring-lux-gold';
const SELECT = `flex h-11 w-full rounded-md border px-3 text-sm ${CHAMP}`;

const VIDE: DemandeAtelier = {
  atelierId: '', parent: '', telephone: '', email: '', eleve: '', classe: '', lycee: '',
  ville: '', personnes: '2', attentes: '', source: 'Facebook', accord: false,
};

/**
 * Réservation d'un atelier : rien n'est envoyé au site. Le bouton ouvre WhatsApp avec la
 * demande rédigée ; le parent l'envoie lui-même, l'équipe confirme la place en réponse.
 */
export function AtelierInscriptionForm({
  ouvrir = (url: string) => { window.location.href = url; },
}: { ouvrir?: (url: string) => void } = {}) {
  const [d, setD] = useState<DemandeAtelier>(VIDE);
  const [erreur, setErreur] = useState('');
  const maintenant = useMemo(() => new Date(), []);
  const ouverts = ateliersOuverts(maintenant, d.classe);
  const maj = (champ: keyof DemandeAtelier) => (valeur: string | boolean) => setD((x) => ({ ...x, [champ]: valeur }));

  function envoyer(e: FormEvent) {
    e.preventDefault();
    const manque = erreursDemande(d, new Date());
    if (manque.length > 0) {
      setErreur(`À compléter : ${manque.join(', ')}.`);
      return;
    }
    setErreur('');
    ouvrir(buildWhatsAppUrl(messageDemande(d), { exactMessage: true }));
  }

  const texte = (id: keyof DemandeAtelier, libelle: string, props: Record<string, string> = {}) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-lux-ink">{libelle}</Label>
      <Input id={id} value={String(d[id])} onChange={(e) => maj(id)(e.target.value)} className={CHAMP} {...props} />
    </div>
  );

  return (
    <form onSubmit={envoyer} noValidate className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {texte('parent', 'Nom et prénom du parent *', { autoComplete: 'name' })}
        {texte('telephone', 'Téléphone WhatsApp *', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '22 123 456' })}
        {texte('email', 'E-mail *', { type: 'email', autoComplete: 'email' })}
        {texte('eleve', 'Prénom de l’élève *')}
        <div className="space-y-2">
          <Label htmlFor="classe" className="text-lux-ink">Classe actuelle (système tunisien) *</Label>
          <select
            id="classe"
            value={d.classe}
            onChange={(e) => setD((x) => ({ ...x, classe: e.target.value as ClasseTunisienne, atelierId: '' }))}
            className={SELECT}
          >
            <option value="">Choisir…</option>
            {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {texte('lycee', 'Lycée (facultatif)')}
        {texte('ville', 'Ville ou quartier *')}
        <div className="space-y-2">
          <Label htmlFor="personnes" className="text-lux-ink">Nombre de personnes</Label>
          <select id="personnes" value={d.personnes} onChange={(e) => maj('personnes')(e.target.value)} className={SELECT}>
            {['1', '2', '3'].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-lux-ink">Atelier choisi *</legend>
        {ouverts.length === 0 ? (
          <p className="text-sm italic text-lux-slate">Aucun atelier à venir pour cette classe : écrivez-nous sur WhatsApp.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {ouverts.map((a) => (
              <label
                key={a.id}
                className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${
                  d.atelierId === a.id ? 'border-lux-gold bg-lux-gold-wash/20' : 'border-lux-line bg-lux-white'
                }`}
              >
                <input
                  type="radio"
                  name="atelier"
                  value={a.id}
                  checked={d.atelierId === a.id}
                  onChange={() => maj('atelierId')(a.id)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-semibold text-lux-ink">{a.jour} · {a.heure}</span>
                  <span className="text-lux-slate">{THEMES[a.theme].titre}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="attentes" className="text-lux-ink">Vos attentes ou vos questions</Label>
        <Textarea
          id="attentes"
          value={d.attentes}
          onChange={(e) => maj('attentes')(e.target.value)}
          placeholder="Quelle partie choisir, emploi du temps avec le lycée, spécialités, paiement…"
          className={CHAMP}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="source" className="text-lux-ink">Comment nous avez-vous connus ?</Label>
        <select id="source" value={d.source} onChange={(e) => maj('source')(e.target.value)} className={SELECT}>
          {['Facebook', 'Instagram', 'Bouche-à-oreille', 'Autre'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-lux-line/60 bg-lux-paper/80 p-4 text-sm leading-6 text-lux-slate">
        <input type="checkbox" checked={d.accord} onChange={(e) => maj('accord')(e.target.checked)} className="mt-1" />
        <span>J’accepte d’être recontacté(e) par WhatsApp ou par e-mail au sujet de cet atelier.</span>
      </label>

      <button type="submit" className="lux-cta-reserve w-full rounded-lg px-6 py-3.5 text-sm font-semibold">
        Envoyer ma réservation sur WhatsApp
      </button>
      <p role="alert" className="min-h-[1.25rem] text-sm font-semibold text-red-700">{erreur}</p>
      <p className="text-xs leading-5 text-lux-slate">
        Rien n’est enregistré par cette page : le bouton ouvre WhatsApp avec votre message déjà rédigé, que vous
        envoyez vous-même à Nexus Réussite. Votre place est confirmée par notre réponse.
      </p>
    </form>
  );
}
