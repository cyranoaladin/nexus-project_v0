# Contrat DTO — Landing page pre-rentree 2026

> Version : 1.0.0
> Statut : DRAFT
> Derniere mise a jour : 2026-07-12

---

## 1. Interface principale

```typescript
interface PreRentreeLandingDTO {
  campaign: {
    id: string;                    // "pre-rentree-2026"
    version: string;               // "1.0.0"
    status: CampaignStatus;
    canonicalPath: string;         // "/stages/pre-rentree-2026"
    timezone: string;             // "Africa/Tunis"
    startDate: string;            // "2026-08-17" (ISO 8601 date)
    endDate: string;              // "2026-08-28"
    noClassDates: string[];       // ["2026-08-22", "2026-08-23"]
    decisionDeadline: string;     // "2026-08-10T18:00:00+01:00"
    venue: Venue;
  };

  levels: Array<{
    id: string;                   // "seconde" | "premiere" | "terminale"
    label: string;                // "Seconde" | "Premiere" | "Terminale"
    track?: string;               // "generale" | "technologique" (if applicable)
  }>;

  subjects: Array<{
    id: string;                   // "maths" | "pc" | "nsi" | "francais"
    label: string;                // "Mathematiques" | "Physique-Chimie" | "NSI" | "Francais"
    levels: string[];             // ["seconde", "premiere", "terminale"]
  }>;

  packs: Array<{
    id: string;                   // "pre2026-pack-1" through "pre2026-pack-4"
    subjects: number;             // 1 | 2 | 3 | 4
    totalHours: number;           // 10 | 20 | 30 | 40
    price: number;                // in TND: 480 | 900 | 1350 | 1800
    deposit: number;              // in TND: 140 | 270 | 410 | 540
    balance: number;              // in TND: 340 | 630 | 940 | 1260
  }>;

  schedule: {
    weeks: Array<{
      label: string;              // "Semaine 1" | "Semaine 2"
      startDate: string;          // "2026-08-17" | "2026-08-24"
      endDate: string;            // "2026-08-21" | "2026-08-28"
      slots: Array<{
        date: string;             // ISO date of each day (repeated for each day)
        level: string;            // "seconde" | "premiere" | "terminale"
        subject: string;          // subject id
        block: string;            // "A" | "B" | "C" | "D"
        startTime: string;        // "08:30" | "10:45" | "13:30" | "15:45"
        endTime: string;          // "10:30" | "12:45" | "15:30" | "17:45"
        room: string;             // "salle-1" | "salle-2"
      }>;
    }>;
  };

  modules: Array<{
    id: string;                   // e.g. "pre2026-terminale-maths"
    level: string;
    subject: string;
    title: string;                // e.g. "Mathematiques Terminale — Pre-rentree"
    sessions: Array<{
      number: number;             // 1-5
      title: string;              // e.g. "Fonctions et limites"
      objective: string;          // e.g. "Revoir les notions fondamentales de limites"
    }>;
  }>;

  content: {
    hero: {
      surtitre: string;
      h1: string;
      subtitle: string;
      keyFacts: Array<{ icon: string; text: string }>;
    };
    method: {
      positionnement: string;
      groupeReduit: string;
      entrainement: string;
      bilan: string;
    };
    practicalInfo: {
      lieu: string;
      dates: string;
      horaires: string;
      materiel: string;
      paiement: string;
      seuil: string;
      confirmation: string;
      contact: string;
    };
    faq: Array<{
      question: string;
      answer: string;
    }>;
  };

  seo: {
    title: string;                // "Stages de pre-rentree 2026 a Tunis | Nexus Reussite"
    description: string;
    canonical: string;            // "/stages/pre-rentree-2026"
    ogImage: string;              // path to OG image
  };

  cta: {
    primary: {
      label: string;              // "Composer le stage de mon enfant"
      action: string;             // "#configurateur"
    };
    whatsapp: {
      number: string;             // international format without +
      message: string;            // pre-filled message
    };
    bilanGratuit: {
      path: string;               // "/bilan-gratuit"
    };
  };

  status: CampaignStatus;
}

type CampaignStatus =
  | 'DRAFT'
  | 'PRE_REGISTRATION_OPEN'
  | 'REGISTRATION_OPEN'
  | 'FULL'
  | 'CLOSED'
  | 'ARCHIVED';

interface Venue {
  name: string;                   // "Mutuelleville"
  city: string;                   // "Tunis"
  country: string;                // "TN"
  format: 'presentiel';
}
```

---

## 2. Etats de la campagne

| Statut | Description | Comportement landing |
|--------|-------------|---------------------|
| `DRAFT` | Campagne en preparation | Page non accessible (404 ou redirect) |
| `PRE_REGISTRATION_OPEN` | Les familles peuvent se pre-inscrire | Configurateur actif, CTA "Pre-inscrire" |
| `REGISTRATION_OPEN` | Inscriptions confirmees, acomptes recus | CTA "Finaliser l'inscription" |
| `FULL` | Tous les groupes sont complets | CTA "Liste d'attente" |
| `CLOSED` | Inscriptions fermees (post-deadline) | Affichage informatif, pas de CTA d'inscription |
| `ARCHIVED` | Campagne terminee | Redirect 301 vers /stages |

---

## 3. Flux de donnees

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────────┐
│   Manifest      │     │   Pricing       │     │   PreRentreeLandingDTO  │
│   (YAML/JSON)   │────>│   Engine        │────>│   (server component)    │
│                 │     │                 │     │                         │
│ - levels        │     │ - pack rules    │     │ - Hydrated DTO          │
│ - subjects      │     │ - deposit calc  │     │ - Static content        │
│ - schedule      │     │ - exclusions    │     │ - SEO meta              │
│ - modules       │     │                 │     │ - CTA states            │
│ - venue         │     │                 │     │                         │
└─────────────────┘     └─────────────────┘     └─────────────────────────┘
        │                                                 │
        │                                                 │
        v                                                 v
┌─────────────────┐                           ┌─────────────────────────┐
│   Admin CMS     │                           │   Client components     │
│   (status mgmt) │                           │                         │
│                 │                           │ - Configurateur         │
│ - DRAFT         │                           │ - PricingTable          │
│ - OPEN          │                           │ - Schedule              │
│ - FULL          │                           │ - FAQ                   │
│ - CLOSED        │                           │                         │
└─────────────────┘                           └─────────────────────────┘
```

### 3.1 Manifest → DTO

Le manifest est la source de verite pour les donnees structurelles (niveaux, matieres, creneaux, modules). Il est lu au build time (ISR) ou au request time (SSR) selon la strategie de cache choisie.

### 3.2 Pricing Engine → DTO

Le pricing engine calcule les packs a partir des regles :
- `price = f(nb_subjects)` (lookup table)
- `deposit = ceil(price * 0.30 / 10) * 10`
- `balance = price - deposit`

### 3.3 Status → DTO

Le statut de la campagne est gere par l'admin et determine le comportement des CTA. Le DTO expose `status` en racine pour que les composants client puissent adapter leur rendu.

---

## 4. Validation

Le DTO est valide par un schema Zod au build time :

```typescript
import { z } from 'zod';

const CampaignStatusSchema = z.enum([
  'DRAFT',
  'PRE_REGISTRATION_OPEN',
  'REGISTRATION_OPEN',
  'FULL',
  'CLOSED',
  'ARCHIVED',
]);

const PreRentreeLandingDTOSchema = z.object({
  campaign: z.object({
    id: z.string(),
    version: z.string(),
    status: CampaignStatusSchema,
    canonicalPath: z.string().startsWith('/'),
    timezone: z.literal('Africa/Tunis'),
    startDate: z.string().date(),
    endDate: z.string().date(),
    noClassDates: z.array(z.string().date()),
    decisionDeadline: z.string().datetime({ offset: true }),
    venue: z.object({
      name: z.string(),
      city: z.string(),
      country: z.string().length(2),
      format: z.literal('presentiel'),
    }),
  }),
  levels: z.array(z.object({
    id: z.string(),
    label: z.string(),
    track: z.string().optional(),
  })).min(1),
  subjects: z.array(z.object({
    id: z.string(),
    label: z.string(),
    levels: z.array(z.string()).min(1),
  })).min(1),
  packs: z.array(z.object({
    id: z.string(),
    subjects: z.number().int().min(1).max(4),
    totalHours: z.number().int(),
    price: z.number().positive(),
    deposit: z.number().positive(),
    balance: z.number().positive(),
  })).length(4),
  status: CampaignStatusSchema,
  // ... remaining fields validated similarly
});
```

---

## 5. Notes d'implementation

1. Le DTO est construit cote serveur uniquement. Aucune donnee sensible (prix brut, marges) ne transite au-dela de ce qui est affiche.
2. Le champ `modules[].sessions` est optionnel en phase DRAFT (le contenu pedagogique peut etre ajoute progressivement).
3. Le champ `schedule.weeks[].slots` est expanse : chaque jour de la semaine genere ses propres entrees (5 jours x N creneaux par semaine).
4. Le `status` en racine est un alias de `campaign.status` pour faciliter l'acces cote client.
