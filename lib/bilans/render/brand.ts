export const BILAN_PRINT_BRAND_VERSION = 'nexus-lux-print.v1' as const;

export const BILAN_PRINT_BRAND = Object.freeze({
  logos: Object.freeze({
    header: '/images/logo_slogan_nexus_x3.png',
    compact: '/images/logo_nexus_reussite.png',
  }),
  fonts: Object.freeze({
    display: 'Fraunces',
    body: 'DM Sans',
    displayAsset: '/__nexus-print-assets__/Fraunces-Variable.woff2',
    bodyAsset: '/__nexus-print-assets__/DMSans-Variable.woff2',
  }),
  tokens: Object.freeze({
    '--color-lux-ink': '#071A3A',
    '--color-lux-ink-700': '#0E2547',
    '--color-lux-ivory': '#F7F4ED',
    '--color-lux-paper': '#FBFAF5',
    '--color-lux-gold': '#BFA06A',
    '--color-lux-gold-deep': '#7A6535',
    '--color-lux-gold-bright': '#D4B978',
    '--color-lux-gold-wash': '#EBDFC4',
    '--color-lux-slate': '#5A6B82',
    '--color-lux-evergreen': '#1E5F4B',
    '--color-lux-line': 'rgba(11, 37, 71, 0.12)',
    '--color-lux-white': '#FFFFFF',
    '--color-lux-on-dark': '#F7F4ED',
    '--color-lux-on-dark-muted': '#C4BBA8',
  }),
});

export function bilanPrintTokenCss(): string {
  const colorTokens = Object.entries(BILAN_PRINT_BRAND.tokens)
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
  return `${colorTokens};--font-fraunces:'${BILAN_PRINT_BRAND.fonts.display}',serif;--font-dm-sans:'${BILAN_PRINT_BRAND.fonts.body}',sans-serif`;
}
