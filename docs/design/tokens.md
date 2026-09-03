# Nexus Reussite — Luxury Theme Design Tokens

Reference for all design tokens used on the public-facing pages.
Source of truth: `globals.css` custom properties and Tailwind utilities.

---

## 1. Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-lux-ink` | `#071A3A` | Primary text, dark backgrounds, headings |
| `--color-lux-ink-700` | `#0E2547` | Hover state on ink backgrounds |
| `--color-lux-ivory` | `#F7F4ED` | Main page background |
| `--color-lux-paper` | `#FBFAF5` | Alternate section background (lighter) |
| `--color-lux-gold` | `#BFA06A` | Primary accent, filets, focus rings |
| `--color-lux-gold-deep` | `#7A6535` | Eyebrow labels, secondary headings (darkened for AA on ivory) |
| `--color-lux-gold-bright` | `#D4B978` | Hover state on gold buttons |
| `--color-lux-gold-wash` | `#EBDFC4` | Light gold backgrounds, icons on dark |
| `--color-lux-slate` | `#5A6B82` | Secondary text on light backgrounds |
| `--color-lux-evergreen` | `#1E5F4B` | WhatsApp, success, positive indicators |
| `--color-lux-line` | `rgba(11, 37, 71, 0.12)` | Borders and dividers |
| `--color-lux-white` | `#FFFFFF` | Card backgrounds, pure white surfaces |

### Category accents (2026-09-03)

Widened palette for differentiating groups of offers/sections without touching
the ink/gold/ivory anchor identity. Same shape as gold (base/deep/bright/wash):
base for icons and borders on light backgrounds, `-deep` for AA text on light
backgrounds, `-bright` for hover states, `-wash` for pale background tints
**and** as text color on `lux-ink` (dark) backgrounds — mirrors how
`lux-gold-wash` is used for eyebrows on dark sections.

| Token | Hex | Usage |
|---|---|---|
| `--color-lux-terracotta` | `#C1663D` | "Formules ponctuelles" (stages/prépa) accent — energy, short formats |
| `--color-lux-terracotta-deep` | `#7D3F22` | AA text on light bg |
| `--color-lux-terracotta-bright` | `#D98862` | Hover state |
| `--color-lux-terracotta-wash` | `#F0D6C4` | Pale tint / text on dark bg |
| `--color-lux-azure` | `#3B7185` | "Formules individuelles" (coaching/pass) accent — calm, personalized |
| `--color-lux-azure-deep` | `#1F4A57` | AA text on light bg |
| `--color-lux-azure-bright` | `#5B95A8` | Hover state |
| `--color-lux-azure-wash` | `#CFE0E5` | Pale tint / text on dark bg |
| `--color-lux-evergreen-bright` | `#3D9B7D` | `lux-evergreen` (`#1E5F4B`) is too dark to read as an icon on a dark (`lux-ink`) tinted badge — this is the "bright" companion for that one case |

Utility classes: `.lux-filet-terracotta`, `.lux-filet-azure` (same shape as
`.lux-filet-gold`).

**Rule**: on `/offres`, the accent follows the méga-parcours grouping already
in `app/offres/page.tsx` (`MEGA_ANNEE` → gold/default, `MEGA_STAGES` →
terracotta, `MEGA_SURMESURE` → azure) — it encodes real information
architecture, not decoration. Elsewhere (homepage teaser grids), accents may
rotate purely for visual rhythm.

---

## 2. Semantic Text Tokens (AA-compliant)

These tokens replace raw opacity modifiers (`/60`, `/70`, `/75`) and guarantee WCAG AA contrast.

| Token | Value | Background | Contrast Ratio | AA |
|---|---|---|---|---|
| `text-on-dark-strong` | `#F7F4ED` (lux-ivory) | lux-ink | 14.2 : 1 | Pass |
| `text-on-dark-muted` | `#C4BBA8` | lux-ink | 8.2 : 1 | Pass |
| `text-ink` | `#071A3A` | lux-ivory / paper | 14.2 : 1 | Pass |
| `text-slate` | `#5A6B82` | lux-ivory | 4.6 : 1 | Pass (normal text) |

---

## 3. Typography

### Typefaces

| Role | Family | Weights |
|---|---|---|
| Display / Headings | Fraunces | 300 - 500 |
| Body | DM Sans | 400 - 600 |

### Heading Scale

| Level | Weight | Line-height |
|---|---|---|
| h1 | 300 | 1.08 |
| h2 | 400 | 1.15 |
| h3 | 500 | 1.2 |
| h4 | 500 | 1.25 |

### Special Styles

| Style | Family | Size | Weight | Extras |
|---|---|---|---|---|
| Eyebrow | DM Sans | 11px (0.6875rem) | 600 | `letter-spacing: 0.15em`, `text-transform: uppercase` |
| Price | Fraunces | — | 400 | `font-variant-numeric: tabular-nums` |

---

## 4. Spacing

| Element | Value |
|---|---|
| Section rhythm | `py-14 md:py-20` (consistent vertical padding) |
| Container | `max-w-6xl mx-auto px-4 md:px-6` |
| Card padding | `p-5` or `p-6` |
| Gap scale | `gap-2`, `gap-3`, `gap-4`, `gap-5` (8 px multiples) |

---

## 5. Border Radius

| Element | Class | Computed |
|---|---|---|
| Card | `rounded-xl` or `rounded-2xl` | 12 px / 16 px |
| Control / Button | `rounded-lg` | 8 px |
| Badge / Chip | `rounded-full` | pill |

---

## 6. Shadows

| Class | Value |
|---|---|
| `.lux-shadow` | `0 4px 14px rgba(7, 26, 58, 0.06)` |
| `.lux-shadow-hover` | `0 8px 28px rgba(7, 26, 58, 0.10)` |

---

## 7. CTA Hierarchy

| Variant | Class | Background | Text | Border | Notes |
|---|---|---|---|---|---|
| Primary | `.lux-cta-primary` | ink | ivory | gold | Default action |
| Reserve | `.lux-cta-reserve` | gold | ink | — | **Only** for "Reserver ma place" |
| Secondary | `.lux-cta-secondary` | transparent | ink | ink | Lower-priority action |
| WhatsApp | `.lux-cta-whatsapp` | — | evergreen | none | Contact link |

All CTAs share: `min-height: 44px`, `border-radius: rounded-lg` (8 px).

---

## 8. Focus

| Class | Value |
|---|---|
| `.lux-focus` | `outline: 2px solid var(--color-lux-gold); outline-offset: 2px` |

---

## 9. Forbidden Values

The following are **not allowed** in JSX or component styles:

| Rule | Reason |
|---|---|
| Raw hex codes in JSX | Use design tokens only |
| `#D4A574` (tan) | Off-palette color |
| `#0F1F3C` (navy parasite) | Conflicts with `lux-ink` |
| `oklch` grays outside the system | Uncontrolled gray values |
| Fraunces weight > 500 | Too heavy for the luxury aesthetic |
| Text opacity modifiers (`/60`, `/70`, `/75`) | Use semantic text tokens from section 2 instead |
