'use client';

/**
 * Choix des manuels, devis en direct et demande de pré-commande.
 *
 * Pensé pour le téléphone d'abord : c'est de là que viennent les commandes.
 *  — le devis est épinglé en bas de l'écran, toujours lisible, jamais à
 *    chercher en bas de page ;
 *  — l'action principale porte l'étape suivante plutôt que de rester grise et
 *    muette, et amène le curseur sur le premier champ qui manque ;
 *  — les champs ouvrent le bon clavier et acceptent le remplissage automatique ;
 *  — les couvertures sont servies en deux largeurs, avec leurs dimensions et un
 *    aperçu en ligne : pas de saut de mise en page, pas d'octet inutile.
 *
 * Le devis affiché est un confort. Le prix qui fait foi est recalculé par
 * /api/manuels/commande, avec le même moteur (lib/manuels/pricing), confronté
 * à celui de la Maison édition par __tests__/lib/manuels-pricing.test.ts.
 */
import { useMemo, useRef, useState, type RefObject } from 'react';
import { Check, ChevronDown, Expand, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  getManuelDisciplinesClient,
  getManuelsBaremeClient,
  getManuelVolumesClient,
} from '@/lib/manuels/catalogue-client';
import { getCouverture } from '@/lib/manuels/covers';
import {
  priceForPages,
  quote,
  savingForFormat,
  totalForFormat,
  unitTotalForFormat,
  type ManuelFormat,
} from '@/lib/manuels/pricing';

const BAREME = getManuelsBaremeClient();
const DISCIPLINES = getManuelDisciplinesClient();
const VOLUMES = getManuelVolumesClient();

/** Largeur réelle d'une carte : 2 colonnes au téléphone, 4 au grand écran. */
const TAILLES_COUVERTURE = '(min-width: 1280px) 180px, (min-width: 640px) 200px, 45vw';

const FORMATS: { id: ManuelFormat; label: string; detail: string }[] = [
  { id: 'pdf', label: 'PDF seul', detail: 'Téléchargement après confirmation.' },
  { id: 'papier-nb', label: 'PDF + papier noir et blanc', detail: 'Les volumes imprimés, PDF inclus.' },
  { id: 'papier-couleur', label: 'PDF + papier couleur', detail: 'Schémas et cartes en couleur, PDF inclus.' },
];

const FAMILLES = [
  { id: 'tronc-commun', titre: 'Le tronc commun', chapeau: 'Ce que tout candidat de voie générale présente.' },
  { id: 'specialite', titre: 'Les spécialités', chapeau: 'Les disciplines dans lesquelles vous composez.' },
  {
    id: 'epreuve-anticipee-maths',
    titre: 'L’épreuve anticipée de mathématiques',
    chapeau: 'Pour qui ne suit pas la spécialité et compose malgré tout sur cette épreuve.',
  },
];

type DeliveryMode = 'retrait' | 'livraison';
type Manquant = { cle: string; libelle: string; champ?: RefObject<HTMLElement | null> };

export default function ManuelsShop() {
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<ManuelFormat>('pdf');
  const [remise, setRemise] = useState<DeliveryMode>('retrait');
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set(['es', 'pc']));
  const [detailOuvert, setDetailOuvert] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('');
  const [nom, setNom] = useState('');
  const [courriel, setCourriel] = useState('');
  const [telephone, setTelephone] = useState('');
  const [message, setMessage] = useState('');
  const [accord, setAccord] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const refNom = useRef<HTMLInputElement>(null);
  const refCourriel = useRef<HTMLInputElement>(null);
  const refTelephone = useRef<HTMLInputElement>(null);
  const refAdresse = useRef<HTMLInputElement>(null);
  const refVille = useRef<HTMLInputElement>(null);
  const refAccord = useRef<HTMLInputElement>(null);
  const refCatalogue = useRef<HTMLDivElement>(null);

  const retenus = useMemo(() => VOLUMES.filter((v) => choisis.has(v.id)), [choisis]);
  const devis = useMemo(() => quote(retenus.map((v) => v.pages), BAREME), [retenus]);
  const total = totalForFormat(devis, format);
  const economie = savingForFormat(devis, format);
  const prixUnitaire = unitTotalForFormat(devis, format);

  const manquants: Manquant[] = [];
  if (retenus.length === 0) manquants.push({ cle: 'volumes', libelle: 'vos volumes' });
  if (!nom.trim()) manquants.push({ cle: 'nom', libelle: 'votre nom', champ: refNom });
  if (!courriel.trim()) manquants.push({ cle: 'courriel', libelle: 'votre e-mail', champ: refCourriel });
  if (!telephone.trim()) manquants.push({ cle: 'tel', libelle: 'votre téléphone', champ: refTelephone });
  if (remise === 'livraison' && !adresse.trim())
    manquants.push({ cle: 'adresse', libelle: 'votre adresse', champ: refAdresse });
  if (remise === 'livraison' && !ville.trim())
    manquants.push({ cle: 'ville', libelle: 'votre ville', champ: refVille });
  if (!accord) manquants.push({ cle: 'accord', libelle: 'votre accord', champ: refAccord });

  const vide = retenus.length === 0;
  const complet = manquants.length === 0;

  function basculer(id: string) {
    setChoisis((avant) => {
      const apres = new Set(avant);
      if (apres.has(id)) apres.delete(id);
      else apres.add(id);
      return apres;
    });
    setReference(null);
  }

  function prendreTout(ids: string[], prendre: boolean) {
    setChoisis((avant) => {
      const apres = new Set(avant);
      for (const id of ids) {
        if (prendre) apres.add(id);
        else apres.delete(id);
      }
      return apres;
    });
    setReference(null);
  }

  function retirer(id: string) {
    setChoisis((avant) => {
      const apres = new Set(avant);
      apres.delete(id);
      return apres;
    });
    setReference(null);
  }

  function repartir() {
    setChoisis(new Set());
    setNom('');
    setCourriel('');
    setTelephone('');
    setAdresse('');
    setVille('');
    setMessage('');
    setAccord(false);
    setRemise('retrait');
    setFormat('pdf');
    setReference(null);
    setErreur(null);
    setDetailOuvert(false);
  }

  function basculerSection(id: string) {
    setOuvertes((avant) => {
      const apres = new Set(avant);
      if (apres.has(id)) apres.delete(id);
      else apres.add(id);
      return apres;
    });
  }

  /** L'action n'est jamais une impasse : elle conduit au premier manque. */
  function conduire() {
    const premier = manquants[0];
    if (!premier) return;
    const cible = premier.champ?.current ?? refCatalogue.current;
    // appel défensif : le défilement doux n'existe pas partout, et son
    // absence ne doit pas empêcher la mise au point du champ.
    const doux =
      typeof window !== 'undefined' &&
      !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    cible?.scrollIntoView?.({ behavior: doux ? 'smooth' : 'auto', block: 'center' });
    (cible as HTMLElement | null)?.focus?.();
  }

  async function envoyer(event: React.FormEvent) {
    event.preventDefault();
    if (!complet || envoi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const reponse = await fetch('/api/manuels/commande', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: retenus.map((v) => v.id),
          format,
          delivery:
            remise === 'retrait'
              ? { mode: 'retrait' }
              : { mode: 'livraison', address: adresse.trim(), city: ville.trim() },
          contact: { name: nom.trim(), email: courriel.trim(), phone: telephone.trim() },
          message: message.trim() || undefined,
          consent: true,
        }),
      });
      const json = await reponse.json();
      if (!reponse.ok || !json.ok) {
        setErreur('La demande n’a pas pu être enregistrée. Réessayez dans un instant, ou écrivez-nous.');
        toast.error('La demande n’a pas pu être enregistrée.');
        return;
      }
      setReference(json.reference);
      setDetailOuvert(true);
      toast.success('Demande enregistrée.');
    } catch {
      setErreur('La demande n’a pas pu être enregistrée. Vérifiez votre connexion, puis réessayez.');
      toast.error('La demande n’a pas pu être enregistrée.');
    } finally {
      setEnvoi(false);
    }
  }

  const volumeZoome = zoom ? VOLUMES.find((v) => v.id === zoom) : undefined;
  const couvertureZoomee = zoom ? getCouverture(zoom) : undefined;

  return (
    <>
      <form
        onSubmit={envoyer}
        className="mx-auto grid max-w-6xl gap-5 pb-[11rem] lg:grid-cols-[1.35fr_0.65fr] lg:gap-6 lg:pb-0"
      >
        <div className="space-y-5">
          {/* ── la démarche, avant tout choix ── */}
          <section
            aria-label="Comment composer votre commande"
            className="rounded-2xl border border-lux-line bg-lux-white p-4 sm:p-6 lux-shadow"
          >
            <h2 className="font-fraunces text-lg text-lux-ink sm:text-xl">Comment ça marche</h2>
            <p className="mt-2 text-sm leading-6 text-lux-slate">
              Vous composez votre commande vous-même. Le prix se met à jour à chaque geste, et rien
              n’est engagé tant que vous n’avez pas envoyé votre demande.
            </p>
            <ol className="mt-4 space-y-3">
              {[
                [
                  'Choisissez le format',
                  'Le PDF seul, ou le PDF accompagné du papier en noir et blanc ou en couleur. Le fichier est toujours compris : vous n’achetez jamais le contenu deux fois.',
                ],
                [
                  'Cochez vos volumes',
                  'Discipline par discipline, à l’unité ou par lot entier. Plus la sélection grandit, plus la page revient bas : la remise se calcule seule, sans code ni condition.',
                ],
                [
                  'Laissez vos coordonnées',
                  'Retrait au centre Nexus ou livraison offerte. Nous confirmons avec vous la disponibilité, le délai et le règlement avant toute fabrication.',
                ],
              ].map(([titre, texte], index) => (
                <li key={titre} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lux-ink text-sm font-semibold text-lux-ivory">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6 text-lux-slate">
                    <span className="font-semibold text-lux-ink">{titre}.</span> {texte}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-xl bg-lux-paper px-3 py-2 text-xs leading-5 text-lux-slate">
              Votre devis reste affiché en bas de l’écran pendant que vous choisissez : le total et
              l’économie du lot se recalculent à chaque volume ajouté ou retiré.
            </p>
          </section>

          {/* ── 1 · le format ── */}
          <fieldset className="rounded-2xl border border-lux-line bg-lux-white p-4 sm:p-6 lux-shadow">
            <legend className="px-1 font-fraunces text-lg text-lux-ink sm:text-xl">1 · Le format</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 sm:gap-3">
              {FORMATS.map((f) => (
                <label
                  key={f.id}
                  className={`flex min-h-[52px] cursor-pointer items-start gap-2 rounded-xl border px-3 py-3 text-sm transition ${
                    format === f.id
                      ? 'border-lux-gold bg-lux-gold/12 text-lux-ink'
                      : 'border-lux-line bg-lux-paper text-lux-slate'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={f.id}
                    checked={format === f.id}
                    onChange={() => {
                      setFormat(f.id);
                      setReference(null);
                    }}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-lux-gold"
                  />
                  <span>
                    <span className="block font-semibold text-lux-ink">{f.label}</span>
                    <span className="mt-0.5 block text-xs leading-5">{f.detail}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-lux-slate">
              Le PDF est compris dans les deux formules papier : vous n’achetez jamais le contenu deux fois.
            </p>
          </fieldset>

          {/* ── 2 · les volumes ── */}
          <div
            ref={refCatalogue}
            tabIndex={-1}
            className="rounded-2xl border border-lux-line bg-lux-white p-4 sm:p-6 lux-shadow"
          >
            <h2 className="font-fraunces text-lg text-lux-ink sm:text-xl">2 · Vos volumes</h2>
            <p className="mt-1 text-sm leading-6 text-lux-slate">
              Plus vous en prenez, plus la page revient bas : la remise de lot se calcule toute seule.
            </p>

            {FAMILLES.map((famille) => {
              const disciplines = DISCIPLINES.filter((d) => d.family === famille.id);
              if (disciplines.length === 0) return null;
              return (
                <section key={famille.id} className="mt-5">
                  <h3 className="font-dm-sans text-xs font-semibold uppercase tracking-wide text-lux-slate">
                    {famille.titre}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-lux-slate">{famille.chapeau}</p>
                  <div className="mt-3 space-y-2">
                    {disciplines.map((d) => {
                      const volumes = VOLUMES.filter((v) => v.discipline === d.id);
                      const ouverte = ouvertes.has(d.id);
                      const pris = volumes.filter((v) => choisis.has(v.id)).length;
                      return (
                        <div key={d.id} className="overflow-hidden rounded-xl border border-lux-line bg-lux-paper">
                          <button
                            type="button"
                            onClick={() => basculerSection(d.id)}
                            aria-expanded={ouverte}
                            className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
                          >
                            <span className="text-sm font-semibold leading-5 text-lux-ink">{d.label}</span>
                            <span className="flex shrink-0 items-center gap-2 text-xs text-lux-slate">
                              {pris > 0 && (
                                <span className="rounded-full bg-lux-gold/25 px-2 py-0.5 font-semibold text-lux-ink">
                                  {pris}
                                </span>
                              )}
                              <span className="hidden sm:inline">
                                {volumes.length} volume{volumes.length > 1 ? 's' : ''}
                              </span>
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${ouverte ? 'rotate-180' : ''}`}
                                aria-hidden
                              />
                            </span>
                          </button>

                          {ouverte && (
                            <div className="flex items-center justify-between gap-3 border-t border-lux-line px-3 pt-3">
                              <span className="text-xs text-lux-slate">
                                {volumes.length} volume{volumes.length > 1 ? 's' : ''}
                              </span>
                              <button
                                type="button"
                                onClick={() => prendreTout(volumes.map((v) => v.id), pris < volumes.length)}
                                className="min-h-[44px] rounded-full border border-lux-line bg-lux-white px-4 text-xs font-semibold text-lux-ink"
                              >
                                {pris < volumes.length ? 'Tout prendre' : 'Tout retirer'}
                              </button>
                            </div>
                          )}
                          {ouverte && (
                            <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 xl:grid-cols-4">
                              {volumes.map((v) => {
                                const prix = priceForPages(v.pages, BAREME);
                                const couverture = getCouverture(v.id);
                                const retenu = choisis.has(v.id);
                                return (
                                  <li key={v.id} className="relative">
                                    <label
                                      className={`flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border bg-lux-white transition peer-focus-visible:ring-2 peer-focus-visible:ring-lux-ink peer-focus-visible:ring-offset-2 ${
                                        retenu
                                          ? 'border-lux-gold ring-2 ring-lux-gold/40'
                                          : 'border-lux-line'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={retenu}
                                        onChange={() => basculer(v.id)}
                                        className="peer sr-only"
                                      />
                                      <span className="relative block bg-lux-paper">
                                        {couverture ? (
                                          <img
                                            src={couverture.src}
                                            srcSet={couverture.srcSet}
                                            sizes={TAILLES_COUVERTURE}
                                            width={couverture.width}
                                            height={couverture.height}
                                            loading="lazy"
                                            decoding="async"
                                            alt={`Couverture : ${v.title}`}
                                            style={{ backgroundImage: `url(${couverture.lqip})`, backgroundSize: 'cover' }}
                                            className="block h-auto w-full"
                                          />
                                        ) : (
                                          <span
                                            className="flex aspect-[1/1.414] flex-col justify-between bg-lux-paper p-3 text-left"
                                            aria-hidden
                                          >
                                            <span className="text-[10px] font-semibold uppercase tracking-wide text-lux-slate">
                                              {v.disciplineLabel}
                                            </span>
                                            <span className="font-fraunces text-sm leading-5 text-lux-ink">
                                              {v.title}
                                            </span>
                                            <span className="h-0.5 w-8 bg-lux-gold" />
                                          </span>
                                        )}
                                        {retenu && (
                                          <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-lux-gold text-lux-ink shadow">
                                            <Check className="h-4 w-4" aria-hidden />
                                          </span>
                                        )}
                                      </span>
                                      <span className="flex flex-1 flex-col gap-0.5 p-3">
                                        <span className="text-sm font-semibold leading-5 text-lux-ink">
                                          {v.title}
                                        </span>
                                        <span className="text-xs text-lux-slate">
                                          {v.level} · {v.pages} pages
                                        </span>
                                        <span className="mt-auto pt-1 text-sm font-semibold text-lux-ink">
                                          {prix === 0 ? 'offert en PDF' : `${prix} DT en PDF`}
                                        </span>
                                        {/* Bulle à cocher visible : l'état « choisi » ne doit
                                            pas se deviner à la seule bordure dorée. */}
                                        <span
                                          className={`mt-2 flex min-h-[44px] items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                                            retenu
                                              ? 'border-lux-gold bg-lux-gold/15 text-lux-ink'
                                              : 'border-lux-line bg-lux-paper text-lux-slate'
                                          }`}
                                        >
                                          <span
                                            aria-hidden
                                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                              retenu
                                                ? 'border-lux-gold bg-lux-gold text-lux-ink'
                                                : 'border-lux-slate/50 bg-lux-white'
                                            }`}
                                          >
                                            {retenu && <Check className="h-3 w-3" />}
                                          </span>
                                          {retenu ? 'Choisi' : 'Choisir'}
                                        </span>
                                      </span>
                                    </label>
                                    {couverture && (
                                      <button
                                        type="button"
                                        onClick={() => setZoom(v.id)}
                                        aria-label={`Agrandir la couverture : ${v.title}`}
                                        className="absolute left-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-lux-ink/70 text-lux-ivory backdrop-blur"
                                      >
                                        <Expand className="h-4 w-4" aria-hidden />
                                      </button>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* ── 3 · la remise ── */}
          <fieldset className="rounded-2xl border border-lux-line bg-lux-white p-4 sm:p-6 lux-shadow">
            <legend className="px-1 font-fraunces text-lg text-lux-ink sm:text-xl">3 · La remise</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3">
              {([
                ['retrait', 'Retrait au centre Nexus', 'Sur rendez-vous, aux heures d’ouverture.'],
                ['livraison', 'Livraison à domicile — offerte', 'En Tunisie, sans frais ajoutés.'],
              ] as const).map(([mode, label, detail]) => (
                <label
                  key={mode}
                  className={`flex min-h-[52px] cursor-pointer items-start gap-2 rounded-xl border px-3 py-3 text-sm transition ${
                    remise === mode
                      ? 'border-lux-gold bg-lux-gold/12 text-lux-ink'
                      : 'border-lux-line bg-lux-paper text-lux-slate'
                  }`}
                >
                  <input
                    type="radio"
                    name="remise"
                    value={mode}
                    checked={remise === mode}
                    onChange={() => setRemise(mode)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-lux-gold"
                  />
                  <span>
                    <span className="block font-semibold text-lux-ink">{label}</span>
                    <span className="mt-0.5 block text-xs leading-5">{detail}</span>
                  </span>
                </label>
              ))}
            </div>

            {remise === 'livraison' && (
              <div className="mt-4 grid gap-4 sm:grid-cols-[1.4fr_0.6fr]">
                <div className="space-y-2">
                  <Label htmlFor="adresse" className="text-lux-ink">Adresse postale</Label>
                  <Input
                    id="adresse"
                    ref={refAdresse}
                    value={adresse}
                    onChange={(e) => setAdresse(e.target.value)}
                    autoComplete="street-address"
                    enterKeyHint="next"
                    className="min-h-[48px] border-lux-line bg-lux-paper text-base text-lux-ink focus-visible:ring-lux-gold"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ville" className="text-lux-ink">Ville</Label>
                  <Input
                    id="ville"
                    ref={refVille}
                    value={ville}
                    onChange={(e) => setVille(e.target.value)}
                    autoComplete="address-level2"
                    enterKeyHint="next"
                    className="min-h-[48px] border-lux-line bg-lux-paper text-base text-lux-ink focus-visible:ring-lux-gold"
                  />
                </div>
              </div>
            )}
          </fieldset>

          {/* ── 4 · les coordonnées ── */}
          <fieldset className="rounded-2xl border border-lux-line bg-lux-white p-4 sm:p-6 lux-shadow">
            <legend className="px-1 font-fraunces text-lg text-lux-ink sm:text-xl">4 · Vos coordonnées</legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nom" className="text-lux-ink">Nom complet</Label>
                <Input
                  id="nom"
                  ref={refNom}
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  autoComplete="name"
                  enterKeyHint="next"
                  className="min-h-[48px] border-lux-line bg-lux-paper text-base text-lux-ink focus-visible:ring-lux-gold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="courriel" className="text-lux-ink">E-mail</Label>
                <Input
                  id="courriel"
                  ref={refCourriel}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="next"
                  value={courriel}
                  onChange={(e) => setCourriel(e.target.value)}
                  className="min-h-[48px] border-lux-line bg-lux-paper text-base text-lux-ink focus-visible:ring-lux-gold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telephone" className="text-lux-ink">Téléphone</Label>
                <Input
                  id="telephone"
                  ref={refTelephone}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  enterKeyHint="next"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="min-h-[48px] border-lux-line bg-lux-paper text-base text-lux-ink focus-visible:ring-lux-gold"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="message" className="text-lux-ink">Précision (facultatif)</Label>
                <Textarea
                  id="message"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  enterKeyHint="done"
                  className="border-lux-line bg-lux-paper text-base text-lux-ink focus-visible:ring-lux-gold"
                />
              </div>
            </div>
            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-lux-line/60 bg-lux-paper/80 p-4 text-sm leading-6 text-lux-slate">
              <input
                ref={refAccord}
                type="checkbox"
                checked={accord}
                onChange={(e) => setAccord(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-lux-gold"
              />
              <span>
                J’accepte que Nexus Réussite utilise ces informations pour traiter ma demande de manuels
                et me recontacter à ce sujet.
              </span>
            </label>
          </fieldset>
        </div>

        {/* ── le devis : barre épinglée au téléphone, colonne sur grand écran ── */}
        <aside
          data-testid="manuels-devis"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-lux-line bg-lux-white/97 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:sticky lg:top-24 lg:z-auto lg:self-start lg:rounded-2xl lg:border lg:p-6 lux-shadow"
        >
          <button
            type="button"
            onClick={() => setDetailOuvert((o) => !o)}
            aria-expanded={detailOuvert}
            className="mb-2 flex w-full items-center justify-between gap-2 text-left lg:hidden"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-lux-slate">
              Votre devis
            </span>
            <span className="flex items-center gap-1 text-xs text-lux-slate">
              {detailOuvert ? 'Replier' : 'Détail'}
              <ChevronDown className={`h-4 w-4 transition-transform ${detailOuvert ? 'rotate-180' : ''}`} aria-hidden />
            </span>
          </button>
          <h2 className="hidden font-fraunces text-xl text-lux-ink lg:block">Votre devis</h2>

          <div className={`${detailOuvert ? 'block' : 'hidden'} max-h-[50vh] overflow-y-auto lg:block lg:max-h-none lg:overflow-visible`}>
            {economie.tnd > 0 && (
              <p
                data-testid="manuels-economie"
                className="mb-3 rounded-xl bg-lux-gold/15 px-3 py-2 text-sm font-semibold text-lux-ink lg:mb-0 lg:mt-3"
              >
                Remise de lot : <span className="line-through opacity-60">{prixUnitaire} DT</span> volume
                par volume, soit {economie.tnd} DT de moins ({economie.pct} %).
              </p>
            )}

            {retenus.length > 0 && (
              <dl className="mb-3 space-y-1 border-b border-lux-line pb-3 text-sm lg:mb-0 lg:mt-4 lg:border-b-0 lg:border-t lg:pb-0 lg:pt-4">
                <div className="flex justify-between gap-3">
                  <dt className="text-lux-slate">Contenu numérique</dt>
                  <dd className="text-lux-ink">{devis.pdf} DT</dd>
                </div>
                {format !== 'pdf' && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-lux-slate">Impression et reliure</dt>
                    <dd className="text-lux-ink">
                      {format === 'papier-nb' ? devis.paperBw : devis.paperColor} DT
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt className="text-lux-slate">Remise</dt>
                  <dd className="text-lux-ink">
                    {remise === 'retrait' ? 'Retrait au centre' : 'Livraison offerte'}
                  </dd>
                </div>
              </dl>
            )}

            <ul className="mb-3 space-y-1 text-xs text-lux-slate lg:mb-0 lg:mt-3 lg:max-h-48 lg:overflow-y-auto">
              {retenus.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate">{v.title}</span>
                  <span className="shrink-0">{v.pages} p.</span>
                  <button
                    type="button"
                    onClick={() => retirer(v.id)}
                    aria-label={`Retirer ${v.title}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lux-slate hover:bg-lux-paper hover:text-lux-ink"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>

            <p className="text-xs leading-5 text-lux-slate lg:mt-3">
              Montants en dinars tunisiens. Votre demande n’est pas encore une commande ferme : nous
              confirmons avec vous la disponibilité, le délai et le règlement avant toute fabrication.
            </p>
          </div>

          <div className="flex items-center gap-3 lg:mt-4 lg:block">
            <div className="min-w-0 flex-1 lg:flex-none" aria-live="polite" aria-atomic="true">
              <p className="flex items-baseline gap-1">
                <span data-testid="manuels-total" className="font-fraunces text-2xl font-light text-lux-ink lg:text-4xl">
                  {vide ? '—' : `${total} DT`}
                </span>
              </p>
              <p className="truncate text-xs text-lux-slate lg:mt-1 lg:text-sm">
                {vide
                  ? 'Choisissez vos volumes'
                  : `${devis.volumes} volume${devis.volumes > 1 ? 's' : ''} · ${devis.pages} pages`}
              </p>
            </div>

            <Button
              data-testid="manuels-action"
              type={complet ? 'submit' : 'button'}
              onClick={complet ? undefined : conduire}
              disabled={vide || envoi}
              className="min-h-[52px] shrink-0 bg-lux-ink px-5 text-lux-ivory hover:bg-lux-ink/90 lg:mt-4 lg:w-full"
            >
              {envoi ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Envoi…
                </>
              ) : vide ? (
                'Choisissez vos volumes'
              ) : complet ? (
                'Envoyer ma demande'
              ) : (
                'Compléter'
              )}
            </Button>
          </div>

          {!vide && manquants.length > 0 && (
            <p data-testid="manuels-manquants" className="mt-2 text-xs leading-5 text-lux-slate">
              Il manque {manquants.map((m) => m.libelle).join(', ')}.
            </p>
          )}

          {erreur && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-lux-line bg-lux-paper p-3 text-sm text-lux-ink"
            >
              {erreur}
            </p>
          )}

          {reference && (
            <div
              role="status"
              className="mt-3 rounded-xl border border-lux-line bg-lux-paper p-3 text-sm text-lux-ink"
            >
              <p className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Demande enregistrée. Référence : <strong>{reference}</strong>. Un accusé vient de
                  partir vers votre boîte.
                </span>
              </p>
              <button
                type="button"
                onClick={repartir}
                className="mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-lux-ink underline underline-offset-4"
              >
                Faire une autre demande
              </button>
            </div>
          )}
        </aside>
      </form>

      <Dialog open={zoom !== null} onOpenChange={(ouvert) => !ouvert && setZoom(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{volumeZoome?.title}</DialogTitle>
          </DialogHeader>
          {couvertureZoomee && volumeZoome && (
            <div className="grid grid-cols-2 gap-3">
              <img
                src={couvertureZoomee.zoom.recto}
                alt={`Couverture : ${volumeZoome.title}`}
                loading="lazy"
                decoding="async"
                className="h-auto w-full rounded-lg border border-lux-line"
              />
              {couvertureZoomee.zoom.verso && (
                <img
                  src={couvertureZoomee.zoom.verso}
                  alt={`Quatrième de couverture : ${volumeZoome.title}`}
                  loading="lazy"
                  decoding="async"
                  className="h-auto w-full rounded-lg border border-lux-line"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
