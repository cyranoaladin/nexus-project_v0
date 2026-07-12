# Contrat SEO — Stages de pre-rentree 2026

> Version : 1.0.0
> Statut : DRAFT
> Derniere mise a jour : 2026-07-12

---

## 1. Metadonnees principales

| Champ | Valeur |
|-------|--------|
| Title | Stages de pre-rentree 2026 a Tunis \| Nexus Reussite |
| Description | Stages du 17 au 28 aout 2026 a Mutuelleville pour les eleves entrant en Seconde, Premiere ou Terminale : Mathematiques, Physique-Chimie, NSI et Francais, en groupes reduits. |
| Canonical | `/stages/pre-rentree-2026` |
| Langue | `fr` |
| Robots | `index, follow` |

---

## 2. URL et redirections

| Source | Destination | Code |
|--------|-------------|------|
| `/pre-rentree` | `/stages/pre-rentree-2026` | 301 (permanent) |

Implementation dans `next.config.mjs` :

```javascript
{
  source: '/pre-rentree',
  destination: '/stages/pre-rentree-2026',
  permanent: true,
}
```

---

## 3. Open Graph

```html
<meta property="og:type" content="website" />
<meta property="og:title" content="Stages de pre-rentree 2026 a Tunis | Nexus Reussite" />
<meta property="og:description" content="Stages du 17 au 28 aout 2026 a Mutuelleville pour les eleves entrant en Seconde, Premiere ou Terminale : Mathematiques, Physique-Chimie, NSI et Francais, en groupes reduits." />
<meta property="og:url" content="https://nexusreussite.academy/stages/pre-rentree-2026" />
<meta property="og:image" content="https://nexusreussite.academy/images/og/pre-rentree-2026.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Stages de pre-rentree 2026 — Nexus Reussite" />
<meta property="og:locale" content="fr_FR" />
<meta property="og:site_name" content="Nexus Reussite" />
```

---

## 4. Twitter Card

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Stages de pre-rentree 2026 a Tunis | Nexus Reussite" />
<meta name="twitter:description" content="Stages du 17 au 28 aout 2026 a Mutuelleville pour les eleves entrant en Seconde, Premiere ou Terminale : Mathematiques, Physique-Chimie, NSI et Francais, en groupes reduits." />
<meta name="twitter:image" content="https://nexusreussite.academy/images/og/pre-rentree-2026.jpg" />
<meta name="twitter:image:alt" content="Stages de pre-rentree 2026 — Nexus Reussite" />
```

---

## 5. Implementation Next.js (App Router)

```typescript
// app/stages/pre-rentree-2026/page.tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stages de pre-rentree 2026 a Tunis | Nexus Reussite',
  description:
    'Stages du 17 au 28 aout 2026 a Mutuelleville pour les eleves entrant en Seconde, Premiere ou Terminale : Mathematiques, Physique-Chimie, NSI et Francais, en groupes reduits.',
  alternates: {
    canonical: '/stages/pre-rentree-2026',
  },
  openGraph: {
    type: 'website',
    title: 'Stages de pre-rentree 2026 a Tunis | Nexus Reussite',
    description:
      'Stages du 17 au 28 aout 2026 a Mutuelleville pour les eleves entrant en Seconde, Premiere ou Terminale : Mathematiques, Physique-Chimie, NSI et Francais, en groupes reduits.',
    url: 'https://nexusreussite.academy/stages/pre-rentree-2026',
    images: [
      {
        url: '/images/og/pre-rentree-2026.jpg',
        width: 1200,
        height: 630,
        alt: 'Stages de pre-rentree 2026 — Nexus Reussite',
      },
    ],
    locale: 'fr_FR',
    siteName: 'Nexus Reussite',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stages de pre-rentree 2026 a Tunis | Nexus Reussite',
    description:
      'Stages du 17 au 28 aout 2026 a Mutuelleville pour les eleves entrant en Seconde, Premiere ou Terminale : Mathematiques, Physique-Chimie, NSI et Francais, en groupes reduits.',
    images: ['/images/og/pre-rentree-2026.jpg'],
  },
};
```

---

## 6. Donnees structurees (JSON-LD) — FAQ

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Mon enfant peut-il suivre plusieurs matieres ?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Oui, de 1 a 4 matieres. Chaque matiere correspond a un creneau different, donc il n'y a pas de chevauchement."
      }
    },
    {
      "@type": "Question",
      "name": "Le stage dure-t-il une ou deux semaines ?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Le stage s'etend sur deux semaines (17-28 aout). Chaque matiere est dispensee sur une seule semaine (5 seances de 2 h). Selon les matieres choisies, l'eleve peut etre present une semaine ou les deux."
      }
    },
    {
      "@type": "Question",
      "name": "A partir de combien d'eleves un groupe ouvre-t-il ?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Un groupe ouvre a 3 eleves minimum et accueille 5 eleves maximum. Si le seuil de 3 n'est pas atteint au 10 aout, le groupe n'ouvre pas et l'acompte est integralement rembourse."
      }
    },
    {
      "@type": "Question",
      "name": "Quel est le montant de l'acompte ?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "L'acompte represente 30 % du prix du pack choisi : 140 TND (1 matiere), 270 TND (2 matieres), 410 TND (3 matieres), 540 TND (4 matieres)."
      }
    },
    {
      "@type": "Question",
      "name": "Que se passe-t-il si le groupe n'ouvre pas ?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "L'acompte est integralement rembourse sous 7 jours ouvrables. Il n'y a pas de conversion automatique en cours particulier."
      }
    }
  ]
}
```

> Note : seul un sous-ensemble representatif de la FAQ est inclus dans le JSON-LD. L'ensemble complet des 16 questions est rendu en HTML sur la page.

---

## 7. Contraintes

1. **Pas de prix dans le JSON-LD** : les prix ne sont pas exposes en donnees structurees tant qu'il n'y a pas de source canonique validee (schema Product/Offer).
2. **Pas de disponibilite dans le JSON-LD** : le statut du groupe (places restantes) n'est pas expose en donnees structurees.
3. **Image OG** : format JPEG, 1200x630 px, < 300 Ko. A creer avant mise en production.
4. **Canonical unique** : toute URL alternative (avec query params, trailing slash) doit pointer vers le canonical `/stages/pre-rentree-2026`.
