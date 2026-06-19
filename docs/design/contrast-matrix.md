# Nexus Luxury Theme -- WCAG Contrast Matrix

Generated: 2026-06-18

## Token reference

| Token            | Hex       | Swatch                                  |
|------------------|-----------|-----------------------------------------|
| lux-ink          | `#071A3A` | ![](https://placehold.co/40x20/071A3A)  |
| lux-ink-700      | `#0E2547` | ![](https://placehold.co/40x20/0E2547)  |
| lux-ivory        | `#F7F4ED` | ![](https://placehold.co/40x20/F7F4ED)  |
| lux-paper        | `#FBFAF5` | ![](https://placehold.co/40x20/FBFAF5)  |
| lux-gold         | `#BFA06A` | ![](https://placehold.co/40x20/BFA06A)  |
| lux-gold-deep    | `#7A6535` | ![](https://placehold.co/40x20/8C7340)  |
| lux-gold-bright  | `#D4B978` | ![](https://placehold.co/40x20/D4B978)  |
| lux-gold-wash    | `#EBDFC4` | ![](https://placehold.co/40x20/EBDFC4)  |
| lux-slate        | `#5A6B82` | ![](https://placehold.co/40x20/5A6B82)  |
| lux-evergreen    | `#1E5F4B` | ![](https://placehold.co/40x20/1E5F4B)  |
| lux-white        | `#FFFFFF` | ![](https://placehold.co/40x20/FFFFFF)  |

## Opacity blending (pre-computed)

Blended with `blend(fg, bg, alpha) = fg * alpha + bg * (1 - alpha)` per channel.

| Label             | Foreground   | Background   | Alpha | Blended hex | Derivation (R channel example)                        |
|-------------------|-------------|-------------|-------|-------------|-------------------------------------------------------|
| lux-ivory/80      | `#F7F4ED`   | `#071A3A`   | 0.80  | `#C7C8C9`  | R: 0xF7*0.8 + 0x07*0.2 = 197.6+1.4 = 199 = 0xC7     |
| lux-ivory/60      | `#F7F4ED`   | `#071A3A`   | 0.60  | `#979DA5`  | R: 0xF7*0.6 + 0x07*0.4 = 148.2+2.8 = 151 = 0x97     |
| lux-ivory/50      | `#F7F4ED`   | `#071A3A`   | 0.50  | `#7F8794`  | R: 0xF7*0.5 + 0x07*0.5 = 123.5+3.5 = 127 = 0x7F     |
| lux-ink/80        | `#071A3A`   | `#FFFFFF`   | 0.80  | `#394861`  | R: 0x07*0.8 + 0xFF*0.2 = 5.6+51.0 = 57 = 0x39       |
| lux-evergreen/10  | `#1E5F4B`   | `#FFFFFF`   | 0.10  | `#E8EFED`  | R: 0x1E*0.1 + 0xFF*0.9 = 3.0+229.5 = 232 = 0xE8     |

## Contrast ratio formula

```
sRGB channel to linear:
  if c <= 0.03928 then c / 12.92
  else ((c + 0.055) / 1.055) ^ 2.4

Relative luminance:
  L = 0.2126 * R_lin + 0.7152 * G_lin + 0.0722 * B_lin

Contrast ratio:
  CR = (L_lighter + 0.05) / (L_darker + 0.05)
```

WCAG AA thresholds: **4.5:1** for normal text (< 18pt / < 14pt bold), **3.0:1** for large text (>= 18pt / >= 14pt bold).

## Full contrast matrix

### On dark backgrounds (lux-ink `#071A3A`)

| #  | Text color      | Hex       | Background | Hex       | Ratio  | AA normal (>=4.5) | AA large (>=3.0) | Status              |
|----|-----------------|-----------|------------|-----------|--------|--------------------|-------------------|---------------------|
| 1  | lux-ivory       | `#F7F4ED` | lux-ink    | `#071A3A` | 15.70  | Yes                | Yes               | PASS                |
| 2  | lux-gold        | `#BFA06A` | lux-ink    | `#071A3A` | 6.94   | Yes                | Yes               | PASS                |
| 3  | lux-gold-deep   | `#7A6535` | lux-ink    | `#071A3A` | 3.0    | No                 | Yes               | PASS (large only)   |
| 4  | lux-gold-wash   | `#EBDFC4` | lux-ink    | `#071A3A` | 13.04  | Yes                | Yes               | PASS                |
| 5  | lux-ivory/80    | `#C7C8C9` | lux-ink    | `#071A3A` | 10.29  | Yes                | Yes               | PASS                |
| 6  | lux-ivory/60    | `#979DA5` | lux-ink    | `#071A3A` | 6.31   | Yes                | Yes               | PASS                |
| 7  | lux-ivory/50    | `#7F8794` | lux-ink    | `#071A3A` | 4.76   | Yes                | Yes               | PASS                |
| 8  | white           | `#FFFFFF` | lux-ink    | `#071A3A` | 17.24  | Yes                | Yes               | PASS                |
| 9  | lux-evergreen   | `#1E5F4B` | lux-ink    | `#071A3A` | 2.29   | No                 | No                | **FAIL**            |

### On light backgrounds (lux-ivory, lux-paper, lux-white)

| #  | Text color      | Hex       | Background  | Hex       | Ratio  | AA normal (>=4.5) | AA large (>=3.0) | Status              |
|----|-----------------|-----------|-------------|-----------|--------|--------------------|-------------------|---------------------|
| 10 | lux-ink         | `#071A3A` | lux-ivory   | `#F7F4ED` | 15.70  | Yes                | Yes               | PASS                |
| 11 | lux-ink         | `#071A3A` | lux-paper   | `#FBFAF5` | 16.50  | Yes                | Yes               | PASS                |
| 12 | lux-ink         | `#071A3A` | lux-white   | `#FFFFFF` | 17.24  | Yes                | Yes               | PASS                |
| 13 | lux-slate       | `#5A6B82` | lux-ivory   | `#F7F4ED` | 4.95   | Yes                | Yes               | PASS                |
| 14 | lux-slate       | `#5A6B82` | lux-paper   | `#FBFAF5` | 5.21   | Yes                | Yes               | PASS                |
| 15 | lux-slate       | `#5A6B82` | lux-white   | `#FFFFFF` | 5.44   | Yes                | Yes               | PASS                |
| 16 | lux-gold-deep   | `#7A6535` | lux-ivory   | `#F7F4ED` | 4.74   | Yes                | Yes               | PASS                |
| 17 | lux-gold-deep   | `#7A6535` | lux-paper   | `#FBFAF5` | 4.98   | Yes                | Yes               | PASS                |
| 18 | lux-gold-deep   | `#7A6535` | lux-white   | `#FFFFFF` | 5.20   | Yes                | Yes               | PASS                |
| 19 | lux-evergreen   | `#1E5F4B` | lux-ivory   | `#F7F4ED` | 6.84   | Yes                | Yes               | PASS                |
| 20 | lux-evergreen   | `#1E5F4B` | lux-white   | `#FFFFFF` | 7.52   | Yes                | Yes               | PASS                |
| 21 | lux-ink/80      | `#394861` | lux-white   | `#FFFFFF` | 9.24   | Yes                | Yes               | PASS                |
| 22 | red-600         | `#DC2626` | lux-white   | `#FFFFFF` | 4.83   | Yes                | Yes               | PASS                |

### On accent backgrounds

| #  | Text color      | Hex       | Background     | Hex       | Ratio  | AA normal (>=4.5) | AA large (>=3.0) | Status              |
|----|-----------------|-----------|----------------|-----------|--------|--------------------|-------------------|---------------------|
| 23 | lux-ink         | `#071A3A` | lux-gold       | `#BFA06A` | 6.94   | Yes                | Yes               | PASS                |
| 24 | lux-evergreen   | `#1E5F4B` | evergreen/10   | `#E8EFED` | 6.44   | Yes                | Yes               | PASS                |

## Summary

| Result             | Count | Pairs                     |
|--------------------|-------|---------------------------|
| PASS (AA normal)   | 22    | 1-2, 4-8, 10-24          |
| RESERVED           | 1     | 3 (gold-deep on ink, 3.07:1) — **forbidden** for text; acceptable only for large decorative accents (≥ 24px). All eyebrows on dark bg use `gold-wash` (13.04:1) instead. |
| **FORBIDDEN**      | 1     | 9 (evergreen on ink, 2.29:1) — never use. |

## Action items

### #9 -- lux-evergreen on lux-ink (ratio 2.29) -- FAILS both AA levels

This combination (dark green `#1E5F4B` on dark navy `#071A3A`) is two dark colors and is unreadable. If this pairing exists in the codebase it must be removed. lux-evergreen should only appear on light backgrounds where it passes comfortably (6.44-7.52).

**Fix:** Do not use `lux-evergreen` as a text or icon color on `lux-ink` backgrounds. Use `lux-gold` (6.94) or `lux-ivory` (15.70) instead.

### #3 -- lux-gold-deep on lux-ink (ratio 3.81) -- Passes large text only

Acceptable only if used exclusively at >= 18pt (or >= 14pt bold). Verify that every occurrence in the codebase meets the large-text size requirement. If any normal-sized text uses this pair, switch to `lux-gold` (`#BFA06A`, ratio 6.94).

### #16, #17, #18 -- lux-gold-deep on light backgrounds -- FIXED

`lux-gold-deep` was darkened from `#8C7340` to `#7A6535`. All three pairs now pass AA for normal text (ratios 4.74, 4.98, 5.20).

## Decision

**22 of 24 pairs pass WCAG AA for all text sizes** after darkening `lux-gold-deep` to `#7A6535`.

- 1 pair (#3, gold-deep on ink) passes AA for large text only — acceptable since this combination is only used for decorative eyebrows on dark surfaces where `lux-gold` or `lux-gold-wash` should be preferred.
- 1 pair (#9, lux-evergreen on lux-ink) **fails both AA levels** — this combination must never be used. Use `lux-gold` or `lux-ivory` on dark backgrounds instead.
- All opacity-based text colors (`/60`, `/70`, `/75`, `/80`) have been replaced with semantic tokens (`lux-on-dark`, `lux-on-dark-muted`, `lux-on-dark-subtle`).
