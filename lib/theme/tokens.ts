/**
 * Design Tokens - Single Source of Truth
 *
 * Centralizes all design values (colors, typography, spacing, radius, shadows)
 * to ensure consistency across the application.
 *
 * Usage:
 * - Import in tailwind.config.mjs
 * - Reference in components via Tailwind classes
 * - Use for theming and customization
 */

export const designTokens = {
  /**
   * Color System
   *
   * Organized into:
   * - brand: Primary brand colors (Nexus identity)
   * - semantic: Functional colors (success, warning, error, info)
   * - neutral: Grayscale palette (50-950)
   * - surface: Background and card colors
   */
  colors: {
    // Brand Colors - Nexus Identity
    brand: {
      primary: '#2563EB',    // Refined Blue - primary actions, links
      secondary: '#F25C5C',  // Softer Red - secondary actions, alerts
      accent: '#4FD1E9',     // Soft Cyan - highlights, accents
      'accent-dark': '#38BFD6', // Darker cyan for hover states
    },

    // Semantic Colors - Functional meaning
    semantic: {
      success: '#10B981',    // Green - success states
      warning: '#F59E0B',    // Amber - warning states
      error: '#EF4444',      // Red - error states
      info: '#3B82F6',       // Blue - informational states
    },

    // Neutral Scale - Grayscale
    neutral: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
      950: '#0B0C10',  // Darkest - consolidates hardcoded #0B0C10
    },

    // Surface Colors - Backgrounds and cards
    surface: {
      dark: '#0B1018',       // Main dark background
      darker: '#070B12',     // Even darker variant
      card: '#111826',       // Card background
      elevated: '#151D2B',   // Elevated card background
      hover: '#1B2333',      // Hover state background
    },

    // Midnight Blue Scale (Legacy - for backward compatibility)
    // TODO: Migrate to neutral/surface colors
    midnight: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617',
    },
  },

  /**
   * Typography System
   *
   * Font sizes with responsive scaling using clamp()
   * Maintains readability across all device sizes
   */
  typography: {
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      xl: ['1.25rem', { lineHeight: '1.75rem' }],
      '2xl': ['1.5rem', { lineHeight: '2rem' }],
      '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      '5xl': ['3rem', { lineHeight: '1' }],
      '6xl': ['3.75rem', { lineHeight: '1' }],
      '7xl': ['4.5rem', { lineHeight: '1' }],
      '8xl': ['6rem', { lineHeight: '1' }],
      '9xl': ['8rem', { lineHeight: '1' }],

      // Responsive font sizes with clamp
      'responsive-sm': 'clamp(0.875rem, 0.8rem + 0.375vw, 1rem)',
      'responsive-base': 'clamp(1rem, 0.9rem + 0.5vw, 1.125rem)',
      'responsive-lg': 'clamp(1.125rem, 1rem + 0.625vw, 1.25rem)',
      'responsive-xl': 'clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)',
      'responsive-2xl': 'clamp(1.5rem, 1.3rem + 1vw, 1.875rem)',
      'responsive-3xl': 'clamp(1.875rem, 1.6rem + 1.375vw, 2.25rem)',
      'responsive-4xl': 'clamp(2.25rem, 1.9rem + 1.75vw, 3rem)',
    },

    fontWeight: {
      thin: '100',
      extralight: '200',
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },

    lineHeight: {
      none: '1',
      tight: '1.25',
      snug: '1.375',
      normal: '1.5',
      relaxed: '1.625',
      loose: '2',
    },

    letterSpacing: {
      tighter: '-0.05em',
      tight: '-0.025em',
      normal: '0em',
      wide: '0.025em',
      wider: '0.05em',
      widest: '0.1em',
    },
  },

  /**
   * Spacing Scale
   *
   * Consistent spacing for padding, margin, gap
   * Based on 4px base unit (0.25rem)
   */
  spacing: {
    0: '0px',
    0.5: '0.125rem',  // 2px
    1: '0.25rem',     // 4px
    1.5: '0.375rem',  // 6px
    2: '0.5rem',      // 8px
    2.5: '0.625rem',  // 10px
    3: '0.75rem',     // 12px
    3.5: '0.875rem',  // 14px
    4: '1rem',        // 16px
    5: '1.25rem',     // 20px
    6: '1.5rem',      // 24px
    7: '1.75rem',     // 28px
    8: '2rem',        // 32px
    9: '2.25rem',     // 36px
    10: '2.5rem',     // 40px
    11: '2.75rem',    // 44px
    12: '3rem',       // 48px
    14: '3.5rem',     // 56px
    16: '4rem',       // 64px
    20: '5rem',       // 80px
    24: '6rem',       // 96px
    28: '7rem',       // 112px
    32: '8rem',       // 128px
    36: '9rem',       // 144px
    40: '10rem',      // 160px
    44: '11rem',      // 176px
    48: '12rem',      // 192px
    52: '13rem',      // 208px
    56: '14rem',      // 224px
    60: '15rem',      // 240px
    64: '16rem',      // 256px
    72: '18rem',      // 288px
    80: '20rem',      // 320px
    96: '24rem',      // 384px
  },

  /**
   * Border Radius
   *
   * Consistent corner rounding for cards, buttons, inputs
   */
  radius: {
    none: '0px',
    sm: '0.125rem',      // 2px
    DEFAULT: '0.25rem',  // 4px
    md: '0.375rem',      // 6px
    lg: '0.5rem',        // 8px
    xl: '0.75rem',       // 12px
    '2xl': '1rem',       // 16px
    '3xl': '1.5rem',     // 24px

    // Custom Nexus radii
    micro: '10px',       // Small elements (badges, pills)
    'card-sm': '14px',   // Small cards
    card: '18px',        // Standard cards
    'card-lg': '1.125rem', // Large cards (18px)

    full: '9999px',      // Pills, circles
  },

  /**
   * Box Shadows
   *
   * Elevation and depth for cards, modals, dropdowns
   */
  shadows: {
    // Standard shadows
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    none: 'none',

    // Custom Nexus shadows
    soft: '0 4px 30px rgba(0, 0, 0, 0.1)',
    medium: '0 8px 40px rgba(0, 0, 0, 0.15)',
    strong: '0 15px 60px rgba(0, 0, 0, 0.25)',
    card: '0 10px 50px rgba(0, 0, 0, 0.12)',
    glow: '0 0 30px rgba(46, 233, 246, 0.3)',           // Cyan glow
    'glow-strong': '0 0 40px rgba(46, 233, 246, 0.5)',  // Stronger cyan glow
  },

  /**
   * Z-Index Scale
   *
   * Stacking order for overlays, modals, tooltips
   */
  zIndex: {
    0: '0',
    10: '10',
    20: '20',
    30: '30',
    40: '40',
    50: '50',

    // Named layers
    dropdown: '1000',
    sticky: '1020',
    fixed: '1030',
    'modal-backdrop': '1040',
    modal: '1050',
    popover: '1060',
    tooltip: '1070',
  },

  /**
   * Transitions
   *
   * Consistent animation durations and easing
   */
  transitions: {
    duration: {
      fastest: '100ms',
      fast: '150ms',
      normal: '200ms',
      slow: '300ms',
      slowest: '500ms',
    },

    easing: {
      linear: 'linear',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
} as const;

/**
 * Type-safe color palette access
 */
export type ColorToken = keyof typeof designTokens.colors;
export type BrandColor = keyof typeof designTokens.colors.brand;
export type SemanticColor = keyof typeof designTokens.colors.semantic;
export type NeutralColor = keyof typeof designTokens.colors.neutral;
export type SurfaceColor = keyof typeof designTokens.colors.surface;

/**
 * Helper function to get color value
 */
export function getColor(path: string): string {
  const parts = path.split('.');
  let value: Record<string, unknown> | string = designTokens.colors;

  for (const part of parts) {
    if (typeof value === 'object' && value !== null) {
      value = (value as Record<string, unknown>)[part] as Record<string, unknown> | string;
    }
    if (value === undefined) {
      console.warn(`Color token not found: ${path}`);
      return '#000000';
    }
  }

  return value as string;
}
