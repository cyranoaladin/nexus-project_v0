# Qualification du finding `internal-token: pre2026-pack-` sur `/stages`

Date : 2026-07-29
Méthode : inspection directe du HTML capturé localement (`--save-html`), contre un serveur `next dev` local — jamais la production. Aucune correction appliquée.

## M1 — qu'est-ce exactement ?

Un objet JSON complet, sérialisé dans la charge utile d'hydratation React (`self.__next_f.push(...)`, mécanisme standard Next.js pour passer des props d'un Server Component à un Client Component), correspondant tel quel à l'entrée `stage_calendar` de `pre-rentree-2026` dans `data/pricing.canonical.json` :

```json
{
  "id": "pre-rentree-2026",
  ...
  "notes": "Produit dédié avec packs 1–4 matières. Ne pas confondre avec les formats intensifs génériques.",
  "pack_product_ids": ["pre2026-pack-1", "pre2026-pack-2", "pre2026-pack-3", "pre2026-pack-4"]
}
```

Ce n'est ni un identifiant technique isolé ni une simple coïncidence de nommage : c'est **l'objet de données interne entier**, y compris un champ `notes` qui est une annotation de maintenance de catalogue (« Ne pas confondre avec les formats intensifs génériques »), clairement écrite pour quiconque maintient `pricing.canonical.json`, pas pour un parent visiteur. Rien de tout cela n'est rendu visible à l'écran — c'est présent dans le HTML servi, extractible via « Afficher la source » ou les outils de développement, mais pas dans le texte qu'un visiteur lit.

**Cause technique** : `app/stages/page.tsx` appelle `getStageCalendar()` puis transmet l'objet complet (non filtré) au composant client `Stages2026Page` via la prop `calendar`. Next.js sérialise alors l'intégralité de chaque entrée de calendrier dans la charge d'hydratation, y compris les champs que l'interface n'affiche jamais (`notes`, `pack_product_ids`).

## M2 — quelle donnée est réellement exposée, depuis quand ?

- **`pack_product_ids`** : les identifiants `pre2026-pack-1..4` eux-mêmes. Vérifié : les **prix** correspondants (480/900/1350/1800 TND) sont **déjà affichés publiquement et visiblement** sur `/offres` et sur `/stages` lui-même (les 4 montants apparaissent en texte visible sur `/offres` ; `TND` et `900` apparaissent en texte visible sur `/stages`). L'identifiant technique n'ajoute donc **aucune information commerciale nouvelle** — le contenu (combien coûte quoi) est déjà public et voulu tel.
- **`notes`** : le texte d'annotation interne lui-même. Ceci n'est affiché nulle part sur le site — sa seule exposition est cette charge d'hydratation.
- **Depuis quand** : non déterminé précisément — le champ `notes`/`pack_product_ids` existe dans `data/pricing.canonical.json` depuis l'introduction des packs pré-rentrée (`b3fd7a5d7`, 2026-07-12, déjà documenté dans le triage RC), et `app/stages/page.tsx` transmet `getStageCalendar()` sans filtrage depuis une date antérieure à cet audit — la fenêtre d'exposition n'a pas été bornée précisément faute d'historique de rendu antérieur à examiner.

## M3 — le feu vert du 26/07 rend-il ceci sans objet ?

**Non.** Preuve : le motif `/pre2026-pack-/i` qui a déclenché ce finding vit dans `internalTokenPatterns` de `final-public-release-audit.mjs` — la liste vérifiée dans **tous les modes**, y compris `--rendered`, distincte de `copiedBusinessFactPatterns` (motifs de prix/dates, eux bien résolus par la publication). Le motif cible spécifiquement la **convention de nommage interne** des identifiants produit, pas le fait que la campagne soit publique ou non. `PUBLIC_READY` répond à « la campagne peut-elle être visible » — pas à « les artefacts de modélisation de données internes (identifiants SKU, notes de maintenance de catalogue) peuvent-ils fuiter dans le HTML servi ». Ce sont deux questions orthogonales : la seconde reste ouverte quel que soit le statut de la première.

## M4 — rien corrigé (au moment du rapport M1-M4)

Aucune modification de code ni de contenu à cette étape.

## M5 — le motif est-il isolé ?

**M5.1 — recensement des passages non filtrés serveur → client.** Deux sources identifiées, toutes deux dans `lib/pricing.ts` (canonique) :

| Getter | Champ jamais affiché | Appelants (tous serveur → client) |
|---|---|---|
| `getStageCalendar()` | `pack_product_ids` (même absent du type `StageCalendarEntry`, TypeScript ne le retire pas à l'exécution) | `app/stages/page.tsx` → `Stages2026Page` (`'use client'`) |
| `getCarte()` | `rationale` | `app/offres/page.tsx` → `CarteNexusCard` (`'use client'`), `app/recommandation/page.tsx`, `app/bilan-gratuit/selected-offer.ts` |

Vérifié précisément pour `getCarte()` : sur les 3 appelants, **seul `app/offres/page.tsx` transmet l'objet complet**. `app/recommandation/page.tsx` et `app/bilan-gratuit/selected-offer.ts` reconstruisent déjà un objet explicite (`{ title, price_annual, includes }` / `{ id, title, price, ... }`) sans jamais inclure `rationale` — ce sont déjà des exemples corrects du motif recommandé en M6.2b, pas des fuites supplémentaires.

Aucune occurrence trouvée pour `publication-decisions.owner.json` ni `campaigns/pre-rentree-2026.json` : ces fichiers ne sont référencés par aucun composant public (le premier n'est lu par aucun code, confirmé section 2 d'un tour précédent ; le second passe par `lib/campaigns/pre-rentree-2026/public-surface.ts`, qui reconstruit déjà un DTO explicite, `getPreRentreePublicSurfaceDTO()`, avant transmission).

**M5.2 — `--rendered` sur les 37 pages, recherche de champs jamais affichés.** Grep systématique de motifs `\"<champ>\":` sur les 37 pages capturées (`notes`, `comment`, `internal`, `todo`, `owner`, `decision`, `rationale`, et en suivant le fil, `justification`/`reference`/`approved_by_role` du même registre) :

| Motif | Pages touchées | Verdict |
|---|---|---|
| `notes` | `stages.html` (1) | Déjà qualifié en M1-M4 |
| `rationale` | `offres.html`, `maths-1ere.html`, `programme__maths-1ere.html` | Voir ci-dessous — 2 causes, pas 3 |
| `owner` | 36 des 37 pages | **Faux positif de méthode**, pas une fuite — voir ci-dessous |
| `comment`, `internal`, `todo`, `decision`, `justification`, `reference`, `approved_by_role` | 0 page | Rien trouvé |

- **`owner` sur 36 pages** : contexte vérifié (`"owner\":\"$2a\"` dans une trace `env":"Server","stack":[...]`) — c'est une annotation de **debug interne de React**, générée uniquement en mode développement (`next dev`), absente d'un build de production. Ce n'est pas un champ de nos données : c'est le même type de bruit que celui déjà diagnostiqué pour `--artifacts` (motif générique qui matche de l'outillage, pas du contenu applicatif). **Limite de méthode à noter explicitement** : tester contre `next dev` plutôt qu'un vrai build de production introduit ce genre de faux positif, et peut aussi partager des chunks/données entre routes d'une façon qu'un build de production ne ferait pas forcément (voir point suivant).
- **`rationale` sur `maths-1ere.html`/`programme__maths-1ere.html`** : `/maths-1ere` est un simple redirect (`redirect('/programme/maths-1ere')`) suivi par le script de capture — ces deux fichiers sont donc la **même page**, pas deux occurrences indépendantes (2 pages captées, 1 seule réelle). Sur `/programme/maths-1ere` elle-même (une page de révision interactive, `app/programme/maths-1ere/page.tsx`), **aucun appel à `getCarte()`/`CarteNexusCard` trouvé dans son propre code source** — contrairement à `/offres`, ce n'est pas une occurrence tracée à la source. Non confirmé comme fuite réelle en production : à re-tester contre un build de production avant de le compter comme un troisième site touché ; possible artefact de partage de chunk du mode développement.

**M5.3 — classement des fuites confirmées** :
- `stages_calendar.pack_product_ids` (bénin — voir M2 : ne révèle aucune information au-delà des prix déjà publics) ;
- `carte_nexus.rationale` (**plus sensible que `notes`** : révèle un raisonnement stratégique commercial — « Loss-leader assumé par décision Shark » — nommant un processus de décision interne et justifiant pourquoi un tarif reste inchangé malgré un coût de revient plus élevé ; c'est le genre d'information qu'un concurrent ou un client négociateur pourrait exploiter).

## M6 — le correctif dépend de l'usage du champ

**M6.1** — `rationale` : grep exhaustif (`\.rationale\b` sur `app/`, `lib/`, `components/`, `scripts/`) → **aucun usage nulle part**, y compris dans `CarteNexusCard.tsx` lui-même. Purement documentaire. `notes` en revanche est un cas différent et plus subtil, découvert en vérifiant l'usage réel avant d'agir : `Stages2026Page.tsx:106-108` l'affiche bel et bien (`{stage.notes && <p>...{stage.notes}</p>}`), et ce n'est pas un JSX mort — confirmé sur le HTML rendu, « Horaires aménagés Ramadan : matinées ou post-iftar » (entrée `fevrier-2027`) apparaît en clair dans la page `/stages`. Une première version de ce correctif supprimait `notes` entièrement, ce qui aurait retiré cette information réelle pour toutes les entrées — **erreur détectée et corrigée avant application**, pas après.

**M6.2 — correctifs retenus, un par champ, selon son usage réel** :
- `pack_product_ids` : retiré à la source (jamais affiché nulle part, jamais typé) ;
- `rationale` : retiré à la source (jamais affiché nulle part) ;
- `notes` : **conservé intégralement** — c'est un champ réellement utilisé pour au moins 2 entrées (Ramadan, printemps 1-semaine). Seule la valeur spécifique de l'entrée `pre-rentree-2026` a un ton qui ne correspond pas à un texte client (question de contenu, pas de code — remontée, non corrigée).

Réponse structurelle (option b de M6.2, motif « une seule source, une seule sortie ») : `lib/pricing.ts` expose désormais `getPublicCarte()` et `getPublicStageCalendar()`, qui reconstruisent l'objet champ par champ plutôt que de le filtrer après coup — et les types de props des composants clients (`CarteNexusCardProps`, `Stages2026PageProps`) sont maintenant alignés sur ces vues publiques : transmettre l'objet brut redevient une erreur de type, pas seulement une convention à retenir.

**M6.3 — branche dédiée, préparée, non fusionnée** : `fix/pricing-public-view-strip-internal-fields`, poussée. Preuve : test dédié (`__tests__/lib/pricing-public-api.test.ts`, 2 nouveaux cas) + vérification manuelle contre un serveur local — `pack_product_ids`/`pre2026-pack-` et `rationale`/« décision Shark » absents du HTML rendu après correctif ; note Ramadan et prix Carte Nexus (290 TND) toujours affichés. 9/9 tests pricing-public-api, 96/96 sur les suites pricing/stages/offres, 338/338 sur les suites campagne, `tsc` propre. `check-work-delivered.sh` : PUSHED BUT NOT MERGED, 0 jour, sous seuil.

## M7 — ce que cette fuite prouve

`--rendered` a trouvé, dans les deux passes, des choses qu'une lecture des sources n'aurait pas vues : un objet de données interne entier sur `/stages`, et une note de stratégie tarifaire sur `/offres` — ni l'une ni l'autre n'existe comme littéral de code, les deux n'existent qu'une fois assemblées au rendu. Argument pour la section O : ce n'est pas un auditeur de confort, c'est le seul des trois qui aurait trouvé ces deux fuites.
