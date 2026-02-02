# Migration Guide - Design System v2.0

> **Guide de migration** pour passer au nouveau design system centralisé de Nexus Réussite

---

## 📋 Vue d'ensemble

Ce guide documente comment migrer les composants existants vers le nouveau design system basé sur :
- Design tokens centralisés (`lib/theme/tokens.ts`)
- Composants shadcn/ui (CVA + Radix UI)
- Accessibilité WCAG 2.1 AA
- Tailwind CSS v4

---

## 🎯 Objectifs de la Migration

### Avant Migration
```tsx
// ❌ Problèmes :
// - Couleurs hardcodées (#0B0C10)
// - CSS classes custom (.btn-primary)
// - Couleurs deprecated (nexus-cyan, deep-midnight)
// - Pas d'ARIA labels
// - Inconsistances entre pages

<button className="btn-primary bg-[#0B0C10] text-nexus-cyan">
  <Icon />
  Cliquer
</button>
```

### Après Migration
```tsx
// ✅ Bénéfices :
// - Design tokens centralisés
// - Composants réutilisables
// - Accessibilité native
// - Maintenabilité

<Button variant="default" aria-label="Action principale">
  <Icon aria-hidden="true" />
  Cliquer
</Button>
```

---

## 🚀 Migration Rapide (Quick Start)

### Étape 1: Couleurs

| Avant | Après | Usage |
|-------|-------|-------|
| `bg-[#0B0C10]` | `bg-surface-dark` | Backgrounds sombres |
| `bg-[#050608]` | `bg-surface-darker` | Backgrounds très sombres |
| `bg-[#111318]` | `bg-surface-card` | Cards sur fond sombre |
| `text-gray-500` | `text-neutral-500` | Texte secondaire |
| `border-gray-200` | `border-neutral-200` | Bordures |
| `text-blue-600` | `text-brand-primary` | Actions principales |
| `bg-blue-600` | `bg-brand-primary` | Backgrounds primaires |
| `text-red-600` | `text-error` | Erreurs |
| `bg-red-50` | `bg-error/10` | Backgrounds d'erreur |
| `bg-deep-midnight` | `bg-surface-darker` | Deprecated |
| `text-nexus-cyan` | `text-brand-accent` | Deprecated |

### Étape 2: Composants

| CSS Class (Deprecated) | Composant | Variant |
|------------------------|-----------|---------|
| `.btn-primary` | `<Button>` | `variant="default"` |
| `.btn-secondary` | `<Button>` | `variant="outline"` |
| `.card-dark` | `<Card>` | `variant="elevated"` |
| `.card-enhanced` | `<Card>` | `variant="default"` |
| `.badge-popular` | `<Badge>` | `variant="secondary"` |

### Étape 3: Accessibilité

```tsx
// ❌ Avant
<button onClick={handleClick}>
  <X />
</button>

// ✅ Après
<Button onClick={handleClick} aria-label="Fermer">
  <X aria-hidden="true" />
</Button>
```

---

## 📝 Guide Détaillé par Type

### 1. Migration des Couleurs

#### Pattern de Base

```bash
# Rechercher toutes les couleurs à migrer
grep -r "bg-gray-\|text-gray-\|border-gray-" app/my-page.tsx

# Remplacer par neutral scale
sed -i 's/gray-/neutral-/g' app/my-page.tsx
```

#### Couleurs Hardcodées

```tsx
// ❌ Avant
className="bg-[#0B0C10]"
className="bg-[#050608]"
className="bg-[#111318]"

// ✅ Après
className="bg-surface-dark"
className="bg-surface-darker"
className="bg-surface-card"
```

#### Couleurs Deprecated

```tsx
// ❌ Avant (Tailwind classes deprecated)
className="bg-deep-midnight"
className="text-nexus-cyan"
className="bg-nexus-dark"

// ✅ Après
className="bg-surface-darker"
className="text-brand-accent"
className="bg-surface-dark"
```

#### Couleurs Sémantiques

```tsx
// ❌ Avant
className="text-blue-600"    // Ambiguë
className="bg-red-50"        // Pas sémantique
className="text-green-600"   // Inconsistant

// ✅ Après
className="text-brand-primary"  // Claire
className="bg-error/10"          // Sémantique
className="text-success"         // Consistant
```

### 2. Migration des Composants UI

#### Boutons

```tsx
// ❌ Avant: CSS class
<button className="btn-primary">
  S'inscrire
</button>

// ✅ Après: Button component
import { Button } from '@/components/ui/button'

<Button variant="default">
  S'inscrire
</Button>

// Variants disponibles
<Button variant="default">Primaire (cyan)</Button>
<Button variant="secondary">Secondaire (neutral)</Button>
<Button variant="accent">Accent (blue)</Button>
<Button variant="outline">Bordure</Button>
<Button variant="ghost">Transparent</Button>
<Button variant="link">Lien</Button>
<Button variant="destructive">Danger</Button>

// Sizes
<Button size="sm">Petit</Button>
<Button size="default">Normal</Button>
<Button size="lg">Grand</Button>
<Button size="icon"><Icon /></Button>
```

#### Cards

```tsx
// ❌ Avant
<div className="card-dark p-6 rounded-lg">
  <h3>Titre</h3>
  <p>Contenu</p>
</div>

// ✅ Après
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

<Card variant="elevated">
  <CardHeader>
    <CardTitle>Titre</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Contenu</p>
  </CardContent>
</Card>

// Variants disponibles
<Card variant="default">Standard</Card>
<Card variant="elevated">Surélevée (shadow)</Card>
<Card variant="outlined">Bordure seulement</Card>
<Card variant="ghost">Sans background</Card>

// Padding options
<Card padding="none">Sans padding</Card>
<Card padding="sm">Réduit</Card>
<Card padding="default">Normal</Card>
<Card padding="lg">Large</Card>
```

#### Badges

```tsx
// ❌ Avant
<span className="badge-popular">
  Populaire
</span>

// ✅ Après
import { Badge } from '@/components/ui/badge'

<Badge variant="secondary">
  Populaire
</Badge>

// Variants disponibles
<Badge variant="default">Par défaut</Badge>
<Badge variant="secondary">Secondaire</Badge>
<Badge variant="success">Succès</Badge>
<Badge variant="warning">Attention</Badge>
<Badge variant="error">Erreur</Badge>
<Badge variant="outline">Bordure</Badge>
```

#### Tabs (Nouveau composant)

```tsx
// ❌ Avant: Custom tabs
<div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
  <button
    onClick={() => setTab('dashboard')}
    className={tab === 'dashboard' ? 'bg-white text-blue-600' : 'text-gray-600'}
  >
    Dashboard
  </button>
  <button
    onClick={() => setTab('settings')}
    className={tab === 'settings' ? 'bg-white text-blue-600' : 'text-gray-600'}
  >
    Settings
  </button>
</div>

// ✅ Après: Tabs component
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

<Tabs value={tab} onValueChange={(value) => setTab(value as 'dashboard' | 'settings')}>
  <TabsList>
    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
</Tabs>
```

### 3. Migration de l'Accessibilité

#### Icon Buttons

```tsx
// ❌ Avant: Pas de label
<button onClick={closeModal}>
  <X className="w-5 h-5" />
</button>

// ✅ Après: aria-label + aria-hidden
<Button
  onClick={closeModal}
  variant="ghost"
  size="icon"
  aria-label="Fermer le modal"
>
  <X className="w-5 h-5" aria-hidden="true" />
</Button>
```

#### Loading States

```tsx
// ❌ Avant
{isLoading && (
  <div>
    <Loader2 className="animate-spin" />
    Chargement...
  </div>
)}

// ✅ Après
{isLoading && (
  <div role="status" aria-busy="true">
    <Loader2 className="animate-spin" aria-label="Chargement" />
    <span>Chargement...</span>
  </div>
)}
```

#### Error Messages

```tsx
// ❌ Avant
{error && <p className="text-red-500">{error}</p>}

// ✅ Après
{error && (
  <p role="alert" aria-live="polite" className="text-error">
    {error}
  </p>
)}
```

#### Form Fields

```tsx
// ❌ Avant
<label>Email</label>
<input type="email" />
{error && <span>{error}</span>}

// ✅ Après
<Label htmlFor="email">Email *</Label>
<Input
  id="email"
  type="email"
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby={hasError ? "email-error" : undefined}
/>
{hasError && (
  <span id="email-error" className="text-error text-sm">
    {error}
  </span>
)}
```

### 4. Migration des Sections GSAP

#### Pattern de Base

```tsx
// ❌ Avant
export default function Section() {
  useEffect(() => {
    gsap.from('.element', { /* animations */ })
  }, [])

  return (
    <section className="bg-[#0a0b0f]">
      <div className="text-gray-400">...</div>
    </section>
  )
}

// ✅ Après
export default function Section() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia()

      // Animations normales
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from('.element', { /* animations */ })
      })

      // Fallback sans animation
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set('.element', { opacity: 1, y: 0 })
      })
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="bg-surface-darker">
      <div className="text-neutral-400">...</div>
    </section>
  )
}
```

### 5. Migration des Pages

#### Checklist par Page

1. **Lire la page entière**
   ```bash
   cat app/my-page/page.tsx
   ```

2. **Identifier les migrations**
   ```bash
   # Couleurs hardcodées
   grep -n "bg-\[#\|text-\[#" app/my-page/page.tsx

   # Couleurs deprecated
   grep -n "gray-\|blue-6\|red-6\|deep-midnight\|nexus-" app/my-page/page.tsx

   # CSS classes deprecated
   grep -n "btn-\|card-\|badge-" app/my-page/page.tsx
   ```

3. **Migrer systématiquement**
   ```tsx
   // État loading
   - <Loader2 className="text-blue-600" />
   + <Loader2 className="text-brand-primary" aria-label="Chargement" />

   // État error
   - <div className="bg-red-50 text-red-600">
   + <div className="bg-error/10 text-error" role="alert">

   // Textes
   - <p className="text-gray-600">
   + <p className="text-neutral-600">

   // Boutons
   - <button className="btn-primary">
   + <Button variant="default">
   ```

4. **Ajouter ARIA labels**
   ```tsx
   // Icons décoratifs
   + aria-hidden="true"

   // Icon buttons
   + aria-label="Description de l'action"

   // Loading states
   + role="status" aria-busy="true"

   // Error messages
   + role="alert" aria-live="polite"
   ```

5. **Tester**
   ```bash
   # Build
   npm run build

   # Vérifier visuellement
   npm run dev

   # Lighthouse accessibility
   npx @axe-core/cli http://localhost:3000/my-page
   ```

---

## 🔍 Exemples Complets

### Exemple 1: Page Dashboard

<details>
<summary>Voir la migration complète</summary>

```tsx
// ❌ AVANT
export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-600">Chargement...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <button className="text-gray-600">
          <LogOut />
          Déconnexion
        </button>
      </header>

      <main>
        <div className="card-dark">
          <h2 className="text-gray-900">Statistiques</h2>
          <p className="text-gray-600">Vos données</p>
        </div>

        <button className="btn-primary">
          Nouvelle action
        </button>
      </main>
    </div>
  )
}

// ✅ APRÈS
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Loader2, LogOut } from 'lucide-react'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2
            className="w-8 h-8 animate-spin text-brand-primary mx-auto mb-4"
            aria-label="Chargement"
          />
          <p className="text-neutral-600">Chargement...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div role="alert" aria-live="polite" className="text-error">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="text-neutral-600"
          aria-label="Se déconnecter"
        >
          <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
          Déconnexion
        </Button>
      </header>

      <main>
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Statistiques</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-neutral-600">Vos données</p>
          </CardContent>
        </Card>

        <Button variant="default">
          Nouvelle action
        </Button>
      </main>
    </div>
  )
}
```

</details>

### Exemple 2: Formulaire

<details>
<summary>Voir la migration complète</summary>

```tsx
// ❌ AVANT
<form onSubmit={handleSubmit}>
  <div>
    <label>Email</label>
    <input
      type="email"
      className={errors.email ? 'border-red-500' : ''}
    />
    {errors.email && <span className="text-red-500">{errors.email}</span>}
  </div>

  <button type="submit" className="btn-primary">
    {isSubmitting ? <Loader2 className="animate-spin" /> : 'Envoyer'}
  </button>
</form>

// ✅ APRÈS
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

<form onSubmit={handleSubmit}>
  <div>
    <Label htmlFor="email">Email *</Label>
    <Input
      id="email"
      type="email"
      className={errors.email ? 'border-error' : ''}
      aria-required="true"
      aria-invalid={!!errors.email}
      aria-describedby={errors.email ? "email-error" : undefined}
    />
    {errors.email && (
      <span id="email-error" className="text-error text-sm" role="alert">
        {errors.email}
      </span>
    )}
  </div>

  <Button type="submit" disabled={isSubmitting}>
    {isSubmitting ? (
      <>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-label="Envoi en cours" />
        Envoi...
      </>
    ) : (
      'Envoyer'
    )}
  </Button>
</form>
```

</details>

---

## 📊 Checklist de Migration

### Par Fichier

- [ ] **Lire le fichier entièrement**
- [ ] **Identifier toutes les couleurs à migrer**
  - [ ] Hardcoded colors (#xxx)
  - [ ] gray-* → neutral-*
  - [ ] blue-600 → brand-primary
  - [ ] red-600 → error
  - [ ] deep-midnight → surface-darker
  - [ ] nexus-* → brand-*
- [ ] **Remplacer les CSS classes par des composants**
  - [ ] .btn-* → Button
  - [ ] .card-* → Card
  - [ ] .badge-* → Badge
  - [ ] Custom tabs → Tabs component
- [ ] **Ajouter les ARIA attributes**
  - [ ] aria-label sur icon buttons
  - [ ] aria-hidden sur icons décoratifs
  - [ ] role="alert" sur messages d'erreur
  - [ ] role="status" sur loading states
- [ ] **Tester**
  - [ ] npm run build (pas d'erreurs TypeScript)
  - [ ] Test visuel (responsive)
  - [ ] Test accessibilité (tab navigation)
  - [ ] Lighthouse score > 95

### Par Projet

- [ ] **Week 1: Foundation** ✅
  - [x] Design tokens créés
  - [x] Tailwind config updated
  - [x] Font duplication removed

- [ ] **Week 2: Components** ✅
  - [x] Toast
  - [x] Tooltip
  - [x] Table
  - [x] Skeleton
  - [x] Tabs

- [ ] **Week 3: High-Priority Pages** ✅
  - [x] Landing page
  - [x] Parent dashboard
  - [x] Student dashboard
  - [x] Pricing
  - [x] Auth signin

- [ ] **Week 4: Medium-Priority Pages** ✅
  - [x] Admin dashboard
  - [x] Coach dashboard
  - [x] Bilan gratuit
  - [x] CorporateNavbar
  - [x] Trinity services section

- [ ] **Week 5: Cleanup** ✅ (en cours)
  - [x] CSS class deprecation warnings
  - [x] Color deprecation documentation
  - [x] lib/constants.ts cleanup
  - [x] DESIGN_SYSTEM.md documentation
  - [x] MIGRATION_GUIDE.md (ce fichier)
  - [ ] Final audit
  - [ ] Metrics report

---

## 🚨 Pièges Courants

### Piège 1: Oublier aria-hidden sur les icônes décoratives

```tsx
// ❌ Mauvais: Screen reader lit "X button"
<Button>
  <X /> Fermer
</Button>

// ✅ Bon: Screen reader lit "Fermer button"
<Button>
  <X aria-hidden="true" /> Fermer
</Button>
```

### Piège 2: Oublier aria-label sur les icon-only buttons

```tsx
// ❌ Mauvais: Pas de label accessible
<Button size="icon">
  <X />
</Button>

// ✅ Bon: Label accessible
<Button size="icon" aria-label="Fermer">
  <X aria-hidden="true" />
</Button>
```

### Piège 3: Utiliser les mauvaises couleurs sémantiques

```tsx
// ❌ Mauvais: blue-600 ambigu
<Badge className="text-blue-600">Actif</Badge>

// ✅ Bon: success sémantique
<Badge variant="success">Actif</Badge>
```

### Piège 4: Oublier les messages d'erreur accessibles

```tsx
// ❌ Mauvais: Pas de role alert
{error && <div className="text-error">{error}</div>}

// ✅ Bon: Role alert pour screen readers
{error && (
  <div role="alert" aria-live="polite" className="text-error">
    {error}
  </div>
)}
```

### Piège 5: Utiliser className au lieu de variant

```tsx
// ❌ Mauvais: Override avec className
<Button className="bg-blue-600 text-white">Action</Button>

// ✅ Bon: Utiliser les variants
<Button variant="accent">Action</Button>
```

---

## 🛠️ Outils de Migration

### Script de Recherche

```bash
#!/bin/bash
# find-deprecated.sh - Trouve les usages deprecated dans le projet

echo "=== Couleurs Hardcodées ==="
grep -rn "bg-\[#\|text-\[#\|border-\[#" app/ components/ --include="*.tsx" | wc -l

echo "=== Couleurs Gray (devrait être Neutral) ==="
grep -rn "gray-" app/ components/ --include="*.tsx" | wc -l

echo "=== CSS Classes Deprecated ==="
grep -rn "btn-primary\|btn-secondary\|card-enhanced\|badge-popular" app/ components/ --include="*.tsx" | wc -l

echo "=== Couleurs Deprecated ==="
grep -rn "deep-midnight\|nexus-cyan\|nexus-dark" app/ components/ --include="*.tsx" | wc -l
```

### Script de Remplacement Automatique

```bash
#!/bin/bash
# migrate-colors.sh - Remplace automatiquement les couleurs

# Backup
cp app/my-page/page.tsx app/my-page/page.tsx.backup

# Remplacements
sed -i 's/gray-/neutral-/g' app/my-page/page.tsx
sed -i 's/text-blue-600/text-brand-primary/g' app/my-page/page.tsx
sed -i 's/bg-blue-600/bg-brand-primary/g' app/my-page/page.tsx
sed -i 's/text-red-600/text-error/g' app/my-page/page.tsx
sed -i 's/bg-red-50/bg-error\/10/g' app/my-page/page.tsx
sed -i 's/bg-deep-midnight/bg-surface-darker/g' app/my-page/page.tsx
sed -i 's/text-nexus-cyan/text-brand-accent/g' app/my-page/page.tsx

echo "Migration complete! Review changes before committing."
```

---

## 📚 Resources

- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) - Documentation complète du design system
- [lib/theme/tokens.ts](../lib/theme/tokens.ts) - Source de vérité des tokens
- [components/ui/](../components/ui/) - Composants UI disponibles
- [Radix UI Docs](https://www.radix-ui.com/) - Documentation des primitives
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/) - Standards d'accessibilité

---

## 🎯 Next Steps

Après avoir migré votre page/composant :

1. **Commit atomique**
   ```bash
   git add app/my-page/page.tsx
   git commit -m "feat(my-page): migrate to design token system

   - Updated gray-* → neutral-* colors
   - Changed blue-600 → brand-primary
   - Replaced .btn-primary with Button component
   - Added ARIA labels to all interactive elements"
   ```

2. **Test d'accessibilité**
   ```bash
   npm run build
   npx @axe-core/cli http://localhost:3000/my-page
   ```

3. **Update documentation**
   - Marquer la page comme migrée dans DESIGN_SYSTEM.md
   - Noter tout problème ou edge case découvert

---

**Version**: 1.0
**Last Updated**: 2026-02-01
**Maintainers**: Équipe Nexus Réussite
