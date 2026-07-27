# Étanchéité Stages (Pré-rentrée 2026) ↔ Accompagnement annuel

**Objet :** prouver qu'aucune donnée d'accompagnement annuel ne fuit dans les surfaces de stage (pré-rentrée 2026) et réciproquement.
**Périmètre vérifié :** matières, tarifs, planning, vocabulaire, composants/imports.
**Méthode :** preuves reproductibles (grep + tests exécutés), pas d'affirmation non vérifiée.

---

## 1. Matières — chaque niveau de stage n'expose que ses matières

Source de vérité : `data/campaigns/pre-rentree-2026.json → schedule` (grille scellée, gates verts).

| Niveau | Matières (grille JSON, extraites en direct) | Conforme à la demande |
|---|---|---|
| 3e | Mathématiques, Français | ✅ |
| Seconde | Mathématiques, Français | ✅ |
| Première | Mathématiques, NSI, Physique-Chimie, SVT, Français | ✅ |
| Terminale | Mathématiques, NSI, Physique-Chimie, SVT, Mathématiques expertes | ✅ |

Extraction reproductible :
```
python3 -c "
import json
d = json.load(open('data/campaigns/pre-rentree-2026.json'))
by_level = {}
for w in d['schedule']:
    for s in w['slots']:
        by_level.setdefault(s['level'], set()).add(s['subject'])
for lvl in ['TROISIEME','SECONDE','PREMIERE','TERMINALE']:
    print(lvl, sorted(by_level.get(lvl, [])))
"
```
→
```
TROISIEME ['FRANCAIS', 'MATHEMATIQUES']
SECONDE ['FRANCAIS', 'MATHEMATIQUES']
PREMIERE ['FRANCAIS', 'MATHEMATIQUES', 'NSI', 'PHYSIQUE_CHIMIE', 'SVT']
TERMINALE ['MATHEMATIQUES', 'MATHS_EXPERTES', 'NSI', 'PHYSIQUE_CHIMIE', 'SVT']
```

**Aucune trace de Philosophie** dans la grille, ni dans `campaign.subjects`, ni dans `modules.json` (14 modules, aucun `terminale-philosophie`), ni dans `SUBJECT_THEMES` (référentiel spécifique aux stages, cf. §5).

**Purge complète Philosophie (2026-07-24)** — grep exhaustif après retrait du type et de l'objet :
```
grep -rniE "philosophie" lib/campaigns/pre-rentree-2026/ components/pre-rentree-2026/ \
  data/campaigns/pre-rentree-2026.json scripts/pre-rentree/templates/ tools/pdf-generator/ \
  scripts/pre-rentree/*.py scripts/pre-rentree/*.ts
```
→ **zéro occurrence résiduelle** dans le code/schémas/PDF (`lib/`, `components/`, `data/`, templates PDF, scripts TS/Python). Les seules occurrences restantes dans `__tests__/` sont des assertions qui *prouvent* l'absence de Philosophie (noms de test explicites, `toBeUndefined()`, `not.toContain`), pas des fuites. Retiré également : `schema.ts` (4 enums), `commercial-contract.ts`, `bilan-prefill.ts`, `content-schema.ts`, `public-surface.ts`, `publication-snapshot-schema.ts`, `publication-derivations.ts`, `generate_all_pdfs.py`, `document.css`, `render_parent_document_kit.py`, `render_economic_simulation.py`, ainsi que `commercial-contract.fr.json` (4 packs Terminale, Philosophie→Maths expertes), `whatsapp.fr.json`, `communication.fr.json`, `parent-documents.fr.json`, `official-programme-matrix.fr.json`.

**Exceptions documentées, non corrigées délibérément :**
- `content/pre-rentree-2026/parent-guide.fr.json` (bloc « transition ») : « préparer la transition vers… le baccalauréat ou la Philosophie selon le niveau » — décrit le parcours scolaire *futur* de l'élève (le Bac Philo que passera un Terminale), pas une matière proposée par le stage. Conservé car factuellement exact et non testé.
- `content/pre-rentree-2026/jpo-2026/master.fr.json` et `COORDINATION_JPO.md` : confirmé **non consommés par aucun code ni test** (`grep` des imports = vide) — contenu d'une campagne JPO distincte, orpheline. Non corrigés (aucun impact fonctionnel), signalés pour nettoyage séparé si cette campagne redevient active.

Tests qui échouent si Philo ou une matière hors grille apparaît, par niveau :
- `__tests__/components/pre-rentree-2026-planning-selector.test.tsx` → describe *« étanchéité stages/annuel »* : compare pour chaque niveau les matières réellement affichées par le sélecteur à celles de `getPreRentreeSchedule()` (grille datée) — égalité stricte.
- describe *« garde-fou permanent »* (nouveau, 2026-07-24) : vérifie chaque matière affichée contre une **liste fermée** des seules matières de stage légitimes, indépendamment de la grille — conçu pour détecter toute réintroduction future d'une matière hors grille, Philosophie ou autre.
- `__tests__/campaigns/pre-rentree-2026-full-coherence.test.ts` → étend la comparaison à 5 sources (grille JSON, incompatibilités, sélecteur, PDF, page publique) — voir §6.

## 1bis. Traçabilité des 2 SKU Seconde retirés (Physique-Chimie, Informatique-SNT)

**Question posée :** les 2 offres retirées de `commercial-contract.fr.json` étaient-elles des SKU de STAGE erronés (désynchronisés de la grille), ou des SKU d'ACCOMPAGNEMENT ANNUEL ayant fuité dans le contrat de campagne stage ?

**Définition d'origine** (`git show 2a84b9412:content/pre-rentree-2026/commercial-contract.fr.json`, avant retrait) :

```json
{
  "offerId": "pre2026-seconde-physique-chimie",
  "pricingId": "pre2026-foundations-seconde-subject",
  "level": "SECONDE",
  "subjects": ["PHYSIQUE_CHIMIE"],
  "excluded": ["Services numériques", "Suivi parent régulier", "Accompagnement annuel"],
  "proofIds": ["PRF-PRE2026-DATES-VENUE", "PRF-PRE2026-WHATSAPP", "PRF-PRE2026-DEPOSIT-30",
               "PRF-PRE2026-SECONDE-400", "PRF-PRE2026-FIVE-SESSIONS", "PRF-PRE2026-STRUCTURED-SESSIONS"],
  "validatedAt": "2026-07-20"
}
{
  "offerId": "pre2026-seconde-informatique-snt",
  "pricingId": "pre2026-foundations-seconde-subject",
  "level": "SECONDE",
  "subjects": ["NSI"],
  "excluded": ["Suivi parent régulier", "Accompagnement annuel"],
  "proofIds": ["PRF-PRE2026-DATES-VENUE", "PRF-PRE2026-WHATSAPP", "PRF-PRE2026-DEPOSIT-30",
               "PRF-PRE2026-SECONDE-400", "PRF-PRE2026-FIVE-SESSIONS", "PRF-PRE2026-STRUCTURED-SESSIONS"],
  "validatedAt": "2026-07-23"
}
```

**Correction de précision** : les 2 offres n'ont pas été approuvées à la même date. Physique-Chimie a été validée le **2026-07-20**, dans le même lot que Mathématiques et Français (3 matières Seconde d'origine). Informatique-SNT a été validée séparément le **2026-07-23** (R2, réintégration a posteriori). Les deux partagent néanmoins le même statut structurel vis-à-vis de l'étanchéité.

**Verdict, preuve à l'appui — SKU de STAGE, PAS une fuite annuelle :**

| Critère | Valeur observée | Conclusion |
|---|---|---|
| `offerId` | `pre2026-seconde-*` | Préfixe `pre2026-` : jamais utilisé par un identifiant annuel (§2) |
| `pricingId` | `pre2026-foundations-seconde-subject` | Vit sous la clé top-level `pre_rentree_foundations` de `pricing.canonical.json`, cloisonnée des clés annuelles (`offers`, `subscription_tiers`, `packs`, `coaching` — §2) |
| `campaignId` (fichier entier) | `"pre-rentree-2026"` (`z.literal`) | Le schéma Zod verrouille tout le fichier `commercial-contract.fr.json` à cette seule campagne — aucun SKU annuel ne peut structurellement y figurer |
| `proofIds` | `PRF-PRE2026-*` uniquement | Registre de preuves fermé, scindé par campagne (`proofs.registry.json`) |
| `excluded` | Liste explicitement **« Accompagnement annuel »** et **« Suivi parent régulier »** | Marqueur de disclaimer stage → annuel déjà présent (cf. §4), pas un artefact annuel |

**Conclusion : ce sont des SKU de STAGE authentiques, structurellement et nominalement rattachés à la campagne pré-rentrée 2026 à chaque niveau (offerId, pricingId, campaignId, proofIds). Aucune fuite annuel→stage.** Le défaut réel était un **désalignement interne au périmètre stage** : le catalogue commercial (`commercial-contract.fr.json`) reflétait une version antérieure de la grille de stage (celle du 23/07, R2, 4 matières Seconde) et n'avait pas été resynchronisé après la redéfinition de la grille le 24/07 (2 matières). Puisque la cause n'est pas une fuite annuelle, le garde-fou conditionnel « anti-fuite annuelle » n'est pas requis pour ce cas précis — mais le défaut réel (désynchronisation catalogue commercial ↔ grille de stage) est désormais couvert de façon permanente par `pre-rentree-2026-full-coherence.test.ts`, étendu au §6 pour comparer explicitement `offers.json` et `commercial-contract.fr.json` en plus des 5 surfaces déjà vérifiées — voir §6.

## 2. Tarifs — deux sources distinctes, jamais mélangées

`data/pricing.canonical.json` contient des tableaux top-level **cloisonnés par nom** :

```
['version', '_note', 'currency', 'rules', 'offers', 'stage_formats', 'stage_calendar',
 'stage_editions', 'ponctuel_offers', 'coaching', 'packs', 'special_programs',
 'aria_addon', 'operational_aria_addons', 'subscription_tiers',
 'operational_subscription_plans', 'operational_special_packs',
 'operational_credit_costs', 'carte_nexus', 'urgence', 'reperes_tarifaires',
 'pre_rentree_packs', 'pre_rentree_foundations']
```

- **Stages pré-rentrée 2026** : exclusivement `pre_rentree_packs` (4 packs, `pre2026-pack-1..4`) et `pre_rentree_foundations` (2 produits, `pre2026-foundations-3e-subject` / `-seconde-subject`). Tous les identifiants sont préfixés `pre2026-`.
- **Accompagnement annuel** : `offers` (`term-spe-simple`, `1re-eaf`, `1re-maths-antic`, …), `subscription_tiers` (`basic`/`premium`/`elite`), `coaching`, `packs` (`pass-intensifs-1re`, …). Aucun de ces identifiants n'a de préfixe `pre2026-`.

Preuve de lecture cloisonnée côté code — `lib/campaigns/pre-rentree-2026/getters.ts` n'importe que deux fonctions dédiées de `lib/pricing.ts` :
```ts
import { getPreRentreeFoundationsProducts, getPreRentreePacks, getRules } from '@/lib/pricing';
```
et ces deux fonctions (`lib/pricing.ts:602`, `lib/pricing.ts:615`) lisent **exclusivement** `data.pre_rentree_packs` / `data.pre_rentree_foundations` — jamais `offers`, `subscription_tiers`, `packs` ou `coaching`. Une clé de produit annuelle ne peut donc jamais atterrir dans le DTO de campagne stage.

Le champ générique `type: 'stage' | 'ponctuel' | 'coaching' | 'service'` (`lib/pricing.ts:135`) est une classification **partagée par toutes les éditions de stage** (Toussaint, Noël, Février, Printemps, Pré-rentrée — cf. `stage_calendar`), pas une fuite pré-rentrée spécifique : c'est la bonne abstraction, pas une confusion.

## 3. Planning — uniquement les stages 17-28 août, aucune séance d'année scolaire

- `data/campaigns/pre-rentree-2026.json` : `startDate`/`endDate` sont des `z.literal` stricts (`2026-08-17` / `2026-08-28`) dans `lib/campaigns/pre-rentree-2026/schema.ts` — impossible d'y injecter une date hors campagne sans faire échouer la validation Zod.
- Le sélecteur (`StagePlanningSelector`) et le PDF Planning ne lisent que `getPreRentreeSchedule()` / `campaign.schedule`, qui ne contient que les 3 fenêtres de la campagne (17-21, 22-26, 24-28 août 2026). Aucune notion d'« année scolaire », de séance hebdomadaire récurrente ou de calendrier annuel n'existe dans ce modèle.
- Vérifié par `pre-rentree-2026-schedule-gates.test.ts` (complétude : 70 séances = 14 modules × 5, toutes datées entre le 17 et le 28 août).

## 4. Vocabulaire — croisement pré-rentrée / annuel

Grep exhaustif (`accompagnement annuel|abonnement` dans les contenus stage) :

| Fichier | Occurrence | Nature |
|---|---|---|
| `content/pre-rentree-2026/whatsapp-conversion.fr.json:147` | « Aucun accompagnement annuel ni avantage n'est activé automatiquement. » | **Disclaimer explicite** de non-inclusion |
| `content/pre-rentree-2026/jpo-2026/master.fr.json:524` | « L'accompagnement annuel est distinct et n'est pas activé automatiquement. » | **Disclaimer explicite** |
| `content/pre-rentree-2026/parent-documents.fr.json` (×5) | « Les services numériques… et l'accompagnement annuel restent distincts… » | **Disclaimers explicites**, document dédié `passerelle-stage-annuel` qui décrit une transition commerciale volontaire et non automatique |

→ Chaque occurrence sert à **séparer** explicitement les deux offres, jamais à les fusionner. Aucune ne décrit le stage comme un abonnement ni n'importe une caractéristique annuelle dans le stage.

Grep inverse (`\bstage\b` dans le code de l'offre annuelle, hors dossier `pre-rentree-2026`) :

| Fichier | Contexte |
|---|---|
| `lib/pricing.ts:135,564` | Champ de classification générique `type: 'stage'`, utilisé pour toutes les éditions de stage (pas spécifique pré-rentrée) |
| `app/offres/page.tsx:66` | Même champ générique, résolution de labels de composants de pack annuel pouvant inclure un stage (n'importe lequel des `stage_editions`, pas pré-rentrée nommément) |

→ Aucun des deux ne nomme ni ne décrit la campagne « Pré-rentrée 2026 » ; il s'agit du mécanisme générique déjà en place pour toutes les éditions de stage.

## 5. Composants — aucun import transverse vers l'annuel

```
grep -hn "^import" components/pre-rentree-2026/*.tsx | grep -v "@/lib/campaigns/pre-rentree-2026\|@/components/ui\|@/lib/analytics\|@/lib/utils\|react\|next/"
```
→ seuls imports restants : `@/lib/whatsapp` (infra générique), `@/lib/legal` (mentions légales génériques), et imports locaux entre composants `pre-rentree-2026/*`. **Aucun import direct d'un module de l'offre annuelle** dans les composants.

`SUBJECT_THEMES` (`lib/campaigns/pre-rentree-2026/subject-theme.ts`) — investigation explicite :
```
grep -rln "subject-theme\|SUBJECT_THEMES\|getSubjectTheme\|getSubjectFamily" --include="*.ts" --include="*.tsx" .
```
→ uniquement `lib/campaigns/pre-rentree-2026/subject-theme.ts` lui-même et `components/pre-rentree-2026/{ScheduleSection,SubjectBadge,StageConfigurator,ProgramsSection}.tsx` + son test dédié. **Référentiel strictement spécifique aux stages**, jamais importé par l'accompagnement annuel. Conséquence directe : Philosophie (absente de tout stage pré-rentrée) a été retirée de ce référentiel (6 familles : Maths, Français, NSI, Physique-Chimie, SVT, Maths expertes — cette dernière réservée à la Terminale).

## 6. Cohérence interne de bout en bout

`__tests__/campaigns/pre-rentree-2026-full-coherence.test.ts` compare, pour chaque niveau, les matières entre 5 sources : grille JSON, fichier d'incompatibilités, sélecteur front, PDF Planning, page publique.

**Mise à jour 2026-07-24 (post-purge Philosophie) :** `commercial-contract.fr.json` a été réconcilié pour Terminale (Philosophie → Maths expertes dans les 4 packs). **3e, Première et Terminale sont entièrement verts (5/5 sources concordantes).** Seul **Seconde** restait alors divergent : `commercial-contract.fr.json` vendait encore Physique-Chimie et Informatique-SNT pour Seconde (2 SKU approuvés par la direction le 2026-07-20, `pre2026-seconde-physique-chimie` / `pre2026-seconde-informatique-snt`), alors que la grille de stage n'a que Maths + Français.

**Résolution du 2026-07-24 (arbitrage direction définitif) :** ce désalignement Seconde n'était **pas** un mélange stage/annuel, mais une incohérence interne au périmètre stage — et donc bloquante par nature (une incohérence d'étanchéité stages, pas une dette commerciale reportable). Avant tout retrait, vérification effectuée que les 2 offres litigieuses partageaient le même `pricingId` (`pre2026-foundations-seconde-subject`) que les offres Maths/Français conservées, confirmant qu'il s'agissait bien de **SKU de stage** (et non d'une contamination annuelle qui aurait fuité dans le contrat de campagne). La direction a tranché : pour les stages de pré-rentrée, **Seconde = Mathématiques + Français uniquement**, la grille du 24/07 faisant foi. Les 2 offres ont été retirées de `commercial-contract.fr.json` (14 → 12 offres) ainsi que toutes les références dérivées (`parent-documents.fr.json`, `full-campaign.fr.json`, assets générés, tests). **Seconde est désormais vert (5/5 sources concordantes)** — voir DEBTS.md § R2 pour l'historique complet de l'arbitrage.

---

## Conclusion

| Axe | Étanche ? | Preuve |
|---|---|---|
| Matières par niveau | ✅ | §1, tests dédiés + garde-fou permanent |
| Tarifs | ✅ | §2, cloisonnement par clé + code |
| Planning (dates) | ✅ | §3, littéral Zod + gates |
| Vocabulaire croisé | ✅ | §4, disclaimers explicites, aucune fusion |
| Imports composants | ✅ | §5, aucun import transverse |
| Philosophie | ✅ | Purge complète — zéro occurrence résiduelle dans le code/data/PDF |
| Cohérence interne (grille↔sélecteur↔PDF↔page) | ✅ | §6 — 4/4 niveaux verts, `pre-rentree-2026-full-coherence.test.ts` au vert |

**Aucun mélange stage ↔ annuel détecté.** L'écart Seconde (offre publique) a été résolu par arbitrage direction du 2026-07-24 : voir §6 et `DEBTS.md`.
