# Design System - Nexus Réussite

## 📐 Vue d'ensemble

Le design system de Nexus Réussite est construit sur :
- **Framework UI** : Radix UI (accessibilité native)
- **Styling** : Tailwind CSS v4
- **Animations** : GSAP (GreenSock Animation Platform)
- **Motion** : Framer Motion (interactions)
- **3D** : Three.js (effets visuels)

---

## 🎨 Tokens de Design

### Couleurs

```css
/* Brand Colors */
--primary: hsl(222, 47%, 11%)     /* Bleu marine profond */
--secondary: hsl(210, 40%, 96%)   /* Gris clair */
--accent: hsl(142, 76%, 36%)      /* Vert Nexus */
--muted: hsl(210, 40%, 96%)

/* Semantic Colors */
--success: hsl(142, 76%, 36%)
--warning: hsl(38, 92%, 50%)
--error: hsl(0, 84%, 60%)
--info: hsl(217, 91%, 60%)
```

### Typographie

```css
/* Font Family */
--font-sans: 'Inter', system-ui, sans-serif

/* Font Sizes */
--text-xs: 0.75rem    /* 12px */
--text-sm: 0.875rem   /* 14px */
--text-base: 1rem     /* 16px */
--text-lg: 1.125rem   /* 18px */
--text-xl: 1.25rem    /* 20px */
--text-2xl: 1.5rem    /* 24px */
--text-3xl: 1.875rem  /* 30px */
--text-4xl: 2.25rem   /* 36px */

/* Font Weights */
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
```

### Espacements

```css
/* Spacing Scale (Tailwind compatible) */
--spacing-1: 0.25rem   /* 4px */
--spacing-2: 0.5rem    /* 8px */
--spacing-4: 1rem      /* 16px */
--spacing-6: 1.5rem    /* 24px */
--spacing-8: 2rem      /* 32px */
--spacing-12: 3rem     /* 48px */
--spacing-16: 4rem     /* 64px */
```

### Border Radius

```css
--radius-sm: 0.25rem   /* 4px - inputs, badges */
--radius-md: 0.5rem    /* 8px - buttons, cards */
--radius-lg: 0.75rem   /* 12px - modals */
--radius-xl: 1rem      /* 16px - sections */
--radius-full: 9999px  /* full - avatars, pills */
```

---

## 🧩 Composants de Base (Radix UI)

### 1. Button

**Fichier** : `components/ui/button.tsx`

**Variantes** :
- `default` : Bleu marine, texte blanc
- `secondary` : Gris clair, texte sombre
- `outline` : Bordure, fond transparent
- `ghost` : Texte seul, hover subtle
- `link` : Style lien hypertexte

**Tailles** : `sm`, `default`, `lg`, `icon`

**Usage** :
```tsx
import { Button } from '@/components/ui/button'

<Button variant="default" size="lg">S'inscrire</Button>
<Button variant="outline">En savoir plus</Button>
```

---

### 2. Input / Textarea

**Fichiers** : `components/ui/input.tsx`, `components/ui/textarea.tsx`

**États** :
- `:focus` - Anneau bleu, bordure accentuée
- `:disabled` - Opacité réduite, curseur not-allowed
- `:error` - Bordure rouge

**Usage** :
```tsx
<Input type="email" placeholder="email@example.com" />
<Textarea placeholder="Votre message..." rows={4} />
```

---

### 3. Card

**Fichier** : `components/ui/card.tsx`

**Anatomie** :
- `Card` : Conteneur principal
- `CardHeader` : En-tête avec titre
- `CardTitle` : Titre principal
- `CardDescription` : Description secondaire
- `CardContent` : Contenu principal
- `CardFooter` : Actions / CTA

**Usage** :
```tsx
<Card>
  <CardHeader>
    <CardTitle>Formation NSI</CardTitle>
    <CardDescription>Prépa Polytechnique</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>
    <Button>Réserver</Button>
  </CardFooter>
</Card>
```

---

### 4. Dialog / Modal

**Fichier** : `components/ui/dialog.tsx`

**Anatomie** :
- `Dialog` : Root component
- `DialogTrigger` : Bouton d'ouverture
- `DialogContent` : Contenu du modal
- `DialogHeader` : En-tête
- `DialogTitle` : Titre (requis pour a11y)
- `DialogDescription` : Description
- `DialogFooter` : Actions

**Accessibilité** :
- Focus trap automatique
- Escape pour fermer
- Overlay cliquable

---

### 5. Select / Dropdown

**Fichiers** : `components/ui/select.tsx`, `components/ui/popover.tsx`

**Usage** :
```tsx
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Choisir une matière" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="maths">Mathématiques</SelectItem>
    <SelectItem value="nsi">NSI</SelectItem>
  </SelectContent>
</Select>
```

---

## 🎭 Composants Métier

### 1. ARIA Chat

**Fichier** : `components/ui/aria-chat.tsx`

**Fonctionnalités** :
- Interface chat temps réel avec IA
- Historique des conversations
- Feedback thumbs up/down
- Support markdown dans les réponses

---

### 2. Session Booking

**Fichier** : `components/ui/session-booking.tsx`

**Fonctionnalités** :
- Sélection coach
- Calendrier disponibilités
- Choix matière et type (online/présentiel)
- Validation crédits

---

### 3. Credits System

**Fichier** : `components/ui/credits-system.tsx`

**Affichage** :
- Crédits disponibles
- Historique transactions
- Prochaine recharge mensuelle
- Achats de packs

---

### 4. Diagnostic Form

**Fichier** : `components/ui/diagnostic-form.tsx`

**Étapes** :
1. Sélection profil (Élève/Parent/Coach/École)
2. Informations scolaires
3. Objectifs
4. Disponibilités
5. Confirmation

---

## 🚀 Sections GSAP (Landing Page)

Les sections suivantes utilisent GSAP pour des animations scroll-triggered :

### 1. Hero Section GSAP

**Fichier** : `components/sections/hero-section-gsap.tsx`

**Animations** :
- Fade-in du titre avec stagger
- Parallax background
- CTA avec scale-in

---

### 2. Paths Section GSAP

**Fichier** : `components/sections/paths-section-gsap.tsx`

**Animations** :
- Cards personas avec reveal horizontal
- Pin section pendant scroll
- Transition entre profils

---

### 3. Offer Section GSAP

**Fichier** : `components/sections/offer-section-gsap.tsx`

**Animations** :
- Tabs avec morphing transition
- Pricing cards flip effect
- Pin tabs pendant scroll

---

### 4. Proof Section GSAP

**Fichier** : `components/sections/proof-section-gsap.tsx`

**Animations** :
- Stats counter animé
- Testimonials carousel
- Badge reveal stagger

---

### 5. Contact Section GSAP

**Fichier** : `components/sections/contact-section-gsap.tsx`

**Animations** :
- Form reveal from bottom
- Input focus beam effect
- Submit button ripple

---

## 🎬 Principes d'Animation

### Performance

**DO** :
- Utiliser `transform` et `opacity` (GPU-accelerated)
- Réduire animations sur `prefers-reduced-motion`
- Lazy load GSAP sur scroll

**DON'T** :
- Animer `width`, `height`, `top`, `left` (reflow)
- Animations lourdes sur mobile

### Timing

```js
// Durées standards
const TIMING = {
  instant: 0.1,    // Micro-interactions
  fast: 0.2,       // Buttons, toggles
  normal: 0.3,     // Modals, cards
  slow: 0.5,       // Page transitions
  crawl: 1.0       // Scroll reveals
}

// Easing
const EASE = {
  smooth: 'power2.out',
  bounce: 'back.out(1.7)',
  elastic: 'elastic.out(1, 0.3)'
}
```

---

## ♿ Accessibilité

### Standards

- **WCAG 2.1 Level AA** compliance
- **ARIA** roles et labels (via Radix UI)
- **Keyboard navigation** complète
- **Focus visible** sur tous les éléments interactifs
- **Color contrast** minimum 4.5:1

### Tests

```bash
# Lighthouse audit
npm run build
npx serve@latest out
# Ouvrir DevTools > Lighthouse > Accessibility

# Playwright a11y tests
npx playwright test --grep @a11y
```

---

## 📱 Responsive Design

### Breakpoints

```css
/* Tailwind breakpoints */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Ultra-wide */
```

### Mobile-First

Toujours coder mobile-first :

```tsx
<div className="text-base md:text-lg lg:text-xl">
  Responsive text
</div>
```

---

## 🔧 Conventions de Code

### Nommage des Composants

```
- PascalCase pour les composants : `SessionBooking`
- kebab-case pour les fichiers : `session-booking.tsx`
- Suffixe `-gsap` pour animations GSAP : `hero-section-gsap.tsx`
```

### Structure de Fichier

```tsx
// 1. Imports
import { useState } from 'react'
import { Button } from '@/components/ui/button'

// 2. Types
interface Props {
  title: string
}

// 3. Component
export function MyComponent({ title }: Props) {
  // 4. Hooks
  const [state, setState] = useState(false)

  // 5. Handlers
  const handleClick = () => {}

  // 6. Render
  return <div>{title}</div>
}
```

---

## 📦 Exports

Tous les composants UI sont exportés depuis `components/ui/` :

```tsx
// ✅ Bon
import { Button, Card, Input } from '@/components/ui/button'

// ❌ Éviter
import Button from '@/components/ui/button/Button'
```

---

## 🔄 Mise à Jour du Design System

Pour ajouter un nouveau composant :

1. Créer `components/ui/my-component.tsx`
2. Documenter ici dans ce fichier
3. Ajouter tests dans `__tests__/components/my-component.test.tsx`
4. Ajouter story Storybook (si configuré)
5. Mettre à jour `components/ui/index.ts` (si présent)

---

## 📚 Ressources

- [Radix UI Docs](https://www.radix-ui.com/)
- [Tailwind CSS Docs](https://tailwindcss.com/)
- [GSAP Docs](https://greensock.com/docs/)
- [Framer Motion Docs](https://www.framer.com/motion/)

---

**Dernière mise à jour** : 2026-02-01
**Maintainers** : Équipe Nexus Réussite
