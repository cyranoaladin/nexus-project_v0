# Contrat DTO — Landing Pré-rentrée 2026

> Version : 1.1.0
>
> Statut : `VERIFIED_IN_TEST`
>
> Dernière mise à jour : 2026-07-12

## Invariant de niveau

`SECONDE`, `PREMIERE` et `TERMINALE` restent les identifiants techniques stables. Dans tout le périmètre Pré-rentrée 2026, `level` est un **code de classe d'entrée 2026-2027**, jamais la classe actuelle :

| Classe actuelle | `level` | Libellé public |
|---|---|---|
| Troisième | `SECONDE` | Entrée en Seconde |
| Seconde | `PREMIERE` | Entrée en Première |
| Première | `TERMINALE` | Entrée en Terminale |

Le DTO ne crée pas de second identifiant concurrent. `entryLevelSemantics.kind = "ENTRY_LEVEL"` rend la sémantique explicite, et `entry_level` est réservé au contrat analytics.

## Sources de vérité

| Nature | Source |
|---|---|
| campagne, niveaux, profils, planning, rôles, salles, contenus publics | `data/campaigns/pre-rentree-2026.json` validé par `schema.ts` |
| programmes des 12 modules et 60 séances | `content/pre-rentree-2026/modules.json` validé par `schema.ts` |
| prix, acompte, solde et règles commerciales tarifaires | getters de `lib/pricing.ts` |
| coordonnées et adresse pédagogique | `lib/legal.ts` et helper WhatsApp central |
| composition serveur du DTO | `lib/campaigns/pre-rentree-2026/getters.ts` |

Les composants client ne lisent ni le JSON de pricing ni le manifeste brut.

## Forme publique utile

```ts
type EntryLevelCode = 'SECONDE' | 'PREMIERE' | 'TERMINALE';

interface EntryLevelSemantics {
  kind: 'ENTRY_LEVEL';
  schoolYear: '2026-2027';
  currentToEntry: {
    TROISIEME: 'SECONDE';
    SECONDE: 'PREMIERE';
    PREMIERE: 'TERMINALE';
  };
}

interface LandingLevel {
  /** Code stable de classe d'entrée 2026-2027. */
  id: EntryLevelCode;
  label: 'Entrée en Seconde' | 'Entrée en Première' | 'Entrée en Terminale';
}

interface SelectionSummary {
  /** Code stable de classe d'entrée 2026-2027. */
  level: EntryLevelCode;
  levelLabel: string;
  profile: AcademicProfileSelection;
  profileLabel: string;
  subjectIds: string[];
  subjectLabels: string[];
  pack: LandingPack | null;
  totalHours: number;
  sessionCount: number;
  dates: string[];
  scheduleLines: ScheduleSummaryLine[];
  requiresValidation: boolean;
}
```

Le DTO complet expose également : campagne, dates, lieu, capacité 3–5, profils, quatre packs, planning développé, modules, contenus, SEO, CTA, flags et références légales.

## Ressources contractuelles

Le manifeste accepte exactement :

- `MATHS_NSI_SNT_TEACHER` pour Mathématiques, NSI et l'initiation informatique/algorithmique/SNT ;
- `FRENCH_TEACHER` pour les trois modules de Français/Expression ;
- `PHYSICS_CHEMISTRY_TEACHER` pour les trois modules de Physique-Chimie ;
- `salle-1` pour Mathématiques/NSI/SNT ;
- `salle-2` pour Français en semaine 1 puis Physique-Chimie en semaine 2.

Aucun nom personnel n'est stocké dans le manifeste. Le planning développé produit 60 séances et ne dépasse jamais deux salles simultanées.

## Packs

`getPreRentreePackOptions()` résout les quatre produits depuis `lib/pricing.ts` :

| Pack | Matières | Volume | Prix | Acompte | Solde |
|---|---:|---:|---:|---:|---:|
| 1 | 1 | 10 h | 480 TND | 140 TND | 340 TND |
| 2 | 2 | 20 h | 900 TND | 270 TND | 630 TND |
| 3 | 3 | 30 h | 1 350 TND | 410 TND | 940 TND |
| 4 | 4 | 40 h | 1 800 TND | 540 TND | 1 260 TND |

Ces montants documentent la sortie approuvée ; ils ne sont pas codés dans les composants.

## Bilan prérempli

L'URL utilise les paramètres normalisés existants :

- `programme=pre-rentree-2026` ;
- `pack` ;
- `niveau` contenant le code interne de **classe d'entrée** ;
- `matieres` ;
- les champs de profil autorisés selon le niveau.

`PreRentreeCampaignContextSchema` conserve `level` pour compatibilité et le documente explicitement comme classe d'entrée. Le parent voit « Classe de rentrée », peut modifier les données et l'API existante reçoit un contexte normalisé.

Le parseur refuse les prix, acomptes, soldes, PII libre, valeurs inconnues, doublons de matières, pack incohérent et profil incompatible. Aucune API Pré-rentrée V2 n'est créée.

## WhatsApp

`buildWhatsAppMessage()` reçoit uniquement un `SelectionSummary`, puis `buildWhatsAppUrl()` centralise le numéro. Le message affiche le libellé public de classe d'entrée, le profil, les matières, le volume, les dates/horaire, le pack lisible, le prix et l'acompte. Il n'affiche ni code pack technique, ni PII, ni numéro codé dans le composant.

## Validation

Les schémas Zod imposent notamment :

- exactement trois niveaux et leurs libellés publics ;
- `entryLevelSemantics` strict ;
- exactement trois rôles enseignants non nominatifs ;
- exactement deux rôles de salle ;
- quatre matières, quatre packs, deux semaines ;
- 12 modules et cinq séances par module ;
- dates, capacité, flags et SEO contractuels.

Les tests de finalisation vérifient les 45 configurations, la correspondance pack/prix, le préremplissage, WhatsApp, les transitions pédagogiques et les ressources.
