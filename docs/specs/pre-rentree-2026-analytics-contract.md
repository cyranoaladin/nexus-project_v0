# Contrat analytics — Pré-rentrée 2026

> Version : 1.1.0
>
> Statut : `VERIFIED_IN_TEST`
>
> Dernière mise à jour : 2026-07-12

## Sémantique canonique

Les codes internes `SECONDE`, `PREMIERE` et `TERMINALE` désignent la classe d'entrée à la rentrée 2026-2027. Ils sont normalisés pour les analytics en :

| Code interne | `entry_level` | Transition scolaire |
|---|---|---|
| `SECONDE` | `seconde` | Troisième → Seconde |
| `PREMIERE` | `premiere` | Seconde → Première |
| `TERMINALE` | `terminale` | Première → Terminale |

`entry_level` est la seule propriété publique de niveau. Les événements ne transmettent jamais la classe actuelle.

## Propriétés autorisées

L'allowlist de la campagne est fermée :

- `entry_level` ;
- `normalized_track` ;
- `subject_code` ;
- `subject_count` ;
- `pack_code` ;
- `cta_location` ;
- `schedule_view_type`.

Aucun nom de propriété historique (`level`, `track`, `subject`, `count`, `pack_id`, `module_id`, `view`) ne doit être émis par un événement Pré-rentrée.

## Événements

| Événement | Déclenchement | Propriétés |
|---|---|---|
| `pre_rentree_page_view` | premier montage de la page canonique | aucune |
| `pre_rentree_level_selected` | choix de la classe de rentrée | `entry_level` |
| `pre_rentree_track_selected` | choix d'un profil/voie normalisé | `entry_level`, `normalized_track` |
| `pre_rentree_subject_selected` | ajout ou retrait d'une matière | `entry_level`, `subject_code`, `subject_count` |
| `pre_rentree_schedule_viewed` | consultation du planning | `schedule_view_type` (`by_level` ou `by_week`) |
| `pre_rentree_program_viewed` | ouverture d'un programme | `entry_level`, `subject_code` |
| `pre_rentree_price_summary_viewed` | affichage du résumé pack | `pack_code` |
| `pre_rentree_bilan_clicked` | clic vers le bilan | `cta_location`, `pack_code` optionnel |
| `pre_rentree_whatsapp_clicked` | clic WhatsApp | `cta_location`, `pack_code` optionnel |
| `pre_rentree_preregistration_started` | ouverture du bilan prérempli | `pack_code`, `entry_level`, `subject_count` |

Le `pre_rentree_page_view` est protégé contre le double montage React Strict Mode et ne doit être envoyé qu'une fois par chargement de page.

## Données interdites

Les événements ne contiennent jamais :

- nom ou prénom ;
- email ;
- téléphone ;
- établissement ;
- identifiant familial, parent ou élève ;
- classe actuelle ;
- texte libre ;
- paramètres d'URL non normalisés.

## Contrat TypeScript

La source exécutable est `lib/analytics.ts`. Le normaliseur `toPreRentreeEntryLevel()` accepte uniquement les trois codes internes stables et lève une erreur sur toute autre valeur.

```ts
type PreRentreeEntryLevel = 'seconde' | 'premiere' | 'terminale';

type PreRentreeEvent =
  | { name: 'pre_rentree_page_view'; params: Record<string, never> }
  | { name: 'pre_rentree_level_selected'; params: { entry_level: PreRentreeEntryLevel } }
  | {
      name: 'pre_rentree_track_selected';
      params: { entry_level: PreRentreeEntryLevel; normalized_track: string };
    }
  | {
      name: 'pre_rentree_subject_selected';
      params: {
        entry_level: PreRentreeEntryLevel;
        subject_code: string;
        subject_count: number;
      };
    };
```

## Preuves

- `__tests__/campaigns/pre-rentree-2026-analytics.test.ts` verrouille les noms, valeurs, propriétés et l'absence de PII.
- `__tests__/components/pre-rentree-2026-page.test.tsx` verrouille l'émission unique du page view sous Strict Mode.
- La qualification finale du 12 juillet 2026 compte 92 tests ciblés SEO/analytics/sécurité verts et 6 643 tests globaux verts.

L'observation dans le debugger de l'outil analytics réel reste une vérification de preview, car aucun environnement externe n'a été modifié pendant cette release candidate.
