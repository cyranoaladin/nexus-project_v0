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

        // ===== LEGACY COLORS (Kept for backward compatibility) =====
        // NOTE: These colors are no longer actively used in modern components
        // Kept for deep-midnight body background and potential legacy references

        /**
         * @deprecated Use surface.darker instead
         * deep-midnight → surface.darker
         * 
         * STATUS: Used only in app/globals.css body styling
         */
        'deep-midnight': '#020617',
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
        'premium': '0 20px 60px rgba(0, 0, 0, 0.35)',
        'premium-strong': '0 30px 80px rgba(0, 0, 0, 0.5)',
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
