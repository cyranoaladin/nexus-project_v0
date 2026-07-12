# Contrat analytics — Stages de pre-rentree 2026

> Version : 1.0.0
> Statut : DRAFT
> Derniere mise a jour : 2026-07-12

---

## 1. Principes

- **Zero PII** : aucune donnee personnelle n'est transmise dans les evenements analytics.
- **Event-driven** : chaque interaction utilisateur significative emet un evenement nomme.
- **Prefixe** : tous les evenements de cette campagne sont prefixes `pre_rentree_`.
- **Destination** : Google Analytics 4 (ou equivalent configure dans le projet).

---

## 2. Evenements

### 2.1 pre_rentree_page_view

Declenchement : chargement de la page `/stages/pre-rentree-2026`.

| Propriete | Type | Description |
|-----------|------|-------------|
| _(aucune propriete custom)_ | — | Evenement de page view standard |

---

### 2.2 pre_rentree_level_selected

Declenchement : l'utilisateur selectionne un niveau dans le configurateur (etape 1).

| Propriete | Type | Valeurs possibles |
|-----------|------|-------------------|
| `level` | string | `seconde` \| `premiere` \| `terminale` |

---

### 2.3 pre_rentree_track_selected

Declenchement : l'utilisateur selectionne une voie dans le configurateur (etape 2).

| Propriete | Type | Valeurs possibles |
|-----------|------|-------------------|
| `track` | string | `generale` \| `technologique` |

---

### 2.4 pre_rentree_subject_selected

Declenchement : l'utilisateur coche ou decoche une matiere dans le configurateur (etape 3).

| Propriete | Type | Description |
|-----------|------|-------------|
| `subject` | string | `maths` \| `pc` \| `nsi` \| `francais` |
| `count` | number | Nombre total de matieres selectionnees (1-4) |

---

### 2.5 pre_rentree_schedule_viewed

Declenchement : l'utilisateur consulte l'emploi du temps (section horaires ou CTA "Voir les horaires").

| Propriete | Type | Valeurs possibles |
|-----------|------|-------------------|
| `view` | string | `by_level` \| `by_week` |

---

### 2.6 pre_rentree_program_viewed

Declenchement : l'utilisateur ouvre le detail d'un module pedagogique.

| Propriete | Type | Description |
|-----------|------|-------------|
| `module_id` | string | Identifiant du module (ex: `pre2026-terminale-maths`) |

---

### 2.7 pre_rentree_price_summary_viewed

Declenchement : l'utilisateur atteint l'etape resume du configurateur ou scrolle jusqu'au tableau tarifaire.

| Propriete | Type | Description |
|-----------|------|-------------|
| `pack_id` | string | Identifiant du pack affiche (ex: `pre2026-pack-2`) |

---

### 2.8 pre_rentree_bilan_clicked

Declenchement : clic sur le CTA "Demander un bilan gratuit".

| Propriete | Type | Description |
|-----------|------|-------------|
| _(aucune propriete custom)_ | — | — |

---

### 2.9 pre_rentree_whatsapp_clicked

Declenchement : clic sur le CTA WhatsApp.

| Propriete | Type | Description |
|-----------|------|-------------|
| _(aucune propriete custom)_ | — | — |

---

### 2.10 pre_rentree_preregistration_started

Declenchement : l'utilisateur clique sur "Pre-inscrire mon enfant" (debut du formulaire).

| Propriete | Type | Description |
|-----------|------|-------------|
| _(aucune propriete custom)_ | — | — |

---

### 2.11 pre_rentree_preregistration_submitted

Declenchement : soumission reussie du formulaire de pre-inscription.

| Propriete | Type | Description |
|-----------|------|-------------|
| `level` | string | `seconde` \| `premiere` \| `terminale` |
| `subject_count` | number | Nombre de matieres choisies (1-4) |

---

## 3. Donnees JAMAIS transmises

Les donnees suivantes ne doivent **en aucun cas** etre incluses dans les evenements analytics :

| Donnee | Raison |
|--------|--------|
| Nom de l'eleve ou du parent | PII |
| Adresse e-mail | PII |
| Numero de telephone | PII |
| Nom de l'etablissement scolaire | PII indirect |
| Contenu de champs texte libre | PII potentiel |
| Identifiant eleve (student ID) | PII |
| Identifiant parent (parent ID) | PII |

---

## 4. Implementation

```typescript
// lib/analytics/pre-rentree-events.ts

type PreRentreeEvent =
  | { name: 'pre_rentree_page_view' }
  | { name: 'pre_rentree_level_selected'; properties: { level: string } }
  | { name: 'pre_rentree_track_selected'; properties: { track: string } }
  | { name: 'pre_rentree_subject_selected'; properties: { subject: string; count: number } }
  | { name: 'pre_rentree_schedule_viewed'; properties: { view: 'by_level' | 'by_week' } }
  | { name: 'pre_rentree_program_viewed'; properties: { module_id: string } }
  | { name: 'pre_rentree_price_summary_viewed'; properties: { pack_id: string } }
  | { name: 'pre_rentree_bilan_clicked' }
  | { name: 'pre_rentree_whatsapp_clicked' }
  | { name: 'pre_rentree_preregistration_started' }
  | { name: 'pre_rentree_preregistration_submitted'; properties: { level: string; subject_count: number } };

export function trackPreRentreeEvent(event: PreRentreeEvent): void {
  // Implementation via gtag, posthog, or internal analytics
}
```

---

## 5. Tests de conformite

Avant mise en production, verifier :

1. Aucun evenement ne contient de champ PII (audit du dataLayer).
2. Chaque interaction listee ci-dessus emet bien un evenement.
3. Les valeurs de proprietes sont conformes aux enums definies.
4. Les evenements sont visibles dans le debugger GA4 (ou equivalent).
