import { designTokens } from './lib/theme/tokens.js';

const config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ===== DESIGN SYSTEM COLORS =====
        // Brand colors - Use these for brand identity
        brand: designTokens.colors.brand,

        // Semantic colors - Use these for functional states
        success: designTokens.colors.semantic.success,
        warning: designTokens.colors.semantic.warning,
        error: designTokens.colors.semantic.error,
        info: designTokens.colors.semantic.info,

        // Neutral scale - Use for text and subtle backgrounds
        neutral: designTokens.colors.neutral,

        // Surface colors - Use for backgrounds and cards
        surface: designTokens.colors.surface,

        // Gold scale - Keep for premium features
        gold: {
          400: '#FACC15',
          500: '#EAB308',
          600: '#CA8A04',
        },

        // ===== SHADCN UI COLORS (Keep for compatibility) =====
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },

        // ===== DEPRECATED COLORS (Migrate to new design system) =====
        // ⚠️ WARNING: These colors are still in use and cannot be removed yet
        // See migration status below for each color group

        /**
         * @deprecated Use neutral scale or surface colors instead
         * midnight-blue → neutral.700, neutral.800, neutral.900
         *
         * STATUS: Still in use in legacy sections (components/sections/)
         * 18 usages in: problem-solution-section.tsx, home-hero.tsx, etc.
         * Cannot be removed until legacy sections are migrated
         */
        'midnight-blue': {
          DEFAULT: '#1e293b',
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d7fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#1e1b4b',
          950: '#0f172a',
        },

        /**
         * @deprecated Use surface.darker instead
         * deep-midnight → surface.darker
         *
         * STATUS: Still in use (mostly in app/globals.css body styling)
         * Cannot be removed until body background is migrated
         */
        'deep-midnight': '#020617',

        /**
         * @deprecated Use brand colors instead
         * nexus.blue → brand.primary
         * nexus.red → brand.secondary
         * nexus.cyan → brand.accent
         * nexus.dark → surface.dark
         * nexus.charcoal → surface.card
         *
         * STATUS: Still in use in legacy sections (12 files in components/sections/)
         * - home-hero.tsx, cta-section.tsx, problem-solution-section.tsx, etc.
         * Cannot be removed until legacy sections are migrated
         * NOTE: CSS variable aliases maintained in globals.css for GSAP compatibility
         */
        nexus: {
          blue: '#2563EB',
          red: '#EF4444',
          dark: '#0B0C10',
          charcoal: '#111318',
          cyan: '#2EE9F6',
          white: '#F4F6FA',
          gray: '#A6A9B4',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
        serif: ['Didot', 'Bodoni MT', 'Noto Serif Display', 'URW Palladio L', 'P052', 'serif'],
        display: ['var(--font-space)', 'Space Grotesk', 'sans-serif'],
        body: ['var(--font-inter)', 'Inter', 'sans-serif'],
        mono: ['var(--font-mono)', 'IBM Plex Mono', 'monospace'],
      },
      fontSize: {
        'hero': 'clamp(2.75rem, 5vw, 4.75rem)',
        'h2': 'clamp(2.125rem, 3.6vw, 3.5rem)',
        'h3': 'clamp(1.5rem, 2.4vw, 2.25rem)',
        'body': 'clamp(0.875rem, 1.1vw, 1rem)',
      },
      borderRadius: {
        'card': '18px',
        'card-sm': '14px',
        'micro': '10px',
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'strong': '0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 2px 10px -2px rgba(0, 0, 0, 0.05)',
        'card': '0 24px 70px rgba(0, 0, 0, 0.45)',
        'cyan-glow': '0 0 30px rgba(46, 233, 246, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'bounce-gentle': 'bounceGentle 2s infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'slide-in-left': 'slide-in-left 0.6s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.6s ease-out forwards',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-50px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(50px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
