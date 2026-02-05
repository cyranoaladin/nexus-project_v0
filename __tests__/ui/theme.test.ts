import fs from 'fs';
import path from 'path';
import { designTokens, getColor } from '@/lib/theme/tokens';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
    const normalized = val / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getRelativeLuminance(hexToRgb(color1));
  const lum2 = getRelativeLuminance(hexToRgb(color2));
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Theme Configuration', () => {
  describe('Settings File', () => {
    const settingsPath = path.join(process.cwd(), '.zenflow', 'settings.json');
    let settings: any;

    beforeAll(() => {
      const rawSettings = fs.readFileSync(settingsPath, 'utf-8');
      settings = JSON.parse(rawSettings);
    });

    it('should exist and be valid JSON', () => {
      expect(fs.existsSync(settingsPath)).toBe(true);
      expect(settings).toBeDefined();
      expect(typeof settings).toBe('object');
    });

    it('should have all required theme sections', () => {
      expect(settings.theme).toBeDefined();
      expect(settings.theme.colors).toBeDefined();
      expect(settings.theme.typography).toBeDefined();
      expect(settings.theme.spacing).toBeDefined();
      expect(settings.theme.radius).toBeDefined();
    });

    it('should have all required color subsections', () => {
      expect(settings.theme.colors.brand).toBeDefined();
      expect(settings.theme.colors.semantic).toBeDefined();
      expect(settings.theme.colors.neutral).toBeDefined();
      expect(settings.theme.colors.surface).toBeDefined();
    });

    it('should have valid hex color values', () => {
      const hexColorRegex = /^#[0-9A-F]{6}$/i;

      Object.values(settings.theme.colors.brand).forEach((color) => {
        expect(hexColorRegex.test(color as string)).toBe(true);
      });

      Object.values(settings.theme.colors.semantic).forEach((color) => {
        expect(hexColorRegex.test(color as string)).toBe(true);
      });

      Object.values(settings.theme.colors.neutral).forEach((color) => {
        expect(hexColorRegex.test(color as string)).toBe(true);
      });

      Object.values(settings.theme.colors.surface).forEach((color) => {
        expect(hexColorRegex.test(color as string)).toBe(true);
      });
    });

    it('should have accessibility section with wcag and contrastRatios', () => {
      expect(settings.accessibility).toBeDefined();
      expect(settings.accessibility.wcag).toBeDefined();
      expect(settings.accessibility.wcag).toBe('AA');
      expect(settings.accessibility.contrastRatios).toBeDefined();
      expect(settings.accessibility.contrastRatios.normal).toBeDefined();
      expect(settings.accessibility.contrastRatios.large).toBeDefined();
    });

    it('should match designTokens color values', () => {
      expect(settings.theme.colors.brand.primary).toBe(designTokens.colors.brand.primary);
      expect(settings.theme.colors.brand.secondary).toBe(designTokens.colors.brand.secondary);
      expect(settings.theme.colors.brand.accent).toBe(designTokens.colors.brand.accent);
      expect(settings.theme.colors.brand['accent-dark']).toBe(designTokens.colors.brand['accent-dark']);
    });

    it('should have complete neutral scale (50-950)', () => {
      const expectedKeys = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
      const actualKeys = Object.keys(settings.theme.colors.neutral);
      
      expectedKeys.forEach((key) => {
        expect(actualKeys).toContain(key);
      });
    });

    it('should have all surface color variants', () => {
      const expectedSurfaceKeys = ['dark', 'darker', 'card', 'elevated', 'hover'];
      const actualKeys = Object.keys(settings.theme.colors.surface);
      
      expectedSurfaceKeys.forEach((key) => {
        expect(actualKeys).toContain(key);
      });
    });

    it('should have all semantic colors', () => {
      const expectedSemanticKeys = ['success', 'warning', 'error', 'info'];
      const actualKeys = Object.keys(settings.theme.colors.semantic);
      
      expectedSemanticKeys.forEach((key) => {
        expect(actualKeys).toContain(key);
      });
    });

    it('should have typography fontFamily configuration', () => {
      expect(settings.theme.typography.fontFamily).toBeDefined();
      expect(settings.theme.typography.fontFamily.sans).toBeDefined();
      expect(settings.theme.typography.fontFamily.display).toBeDefined();
      expect(settings.theme.typography.fontFamily.mono).toBeDefined();
    });

    it('should have spacing configuration', () => {
      expect(settings.theme.spacing.base).toBeDefined();
      expect(settings.theme.spacing.scale).toBeDefined();
      expect(Array.isArray(settings.theme.spacing.scale)).toBe(true);
      expect(settings.theme.spacing.scale.length).toBeGreaterThan(0);
    });

    it('should have radius configuration', () => {
      const expectedRadiusKeys = ['micro', 'card-sm', 'card', 'full'];
      const actualKeys = Object.keys(settings.theme.radius);
      
      expectedRadiusKeys.forEach((key) => {
        expect(actualKeys).toContain(key);
      });
    });
  });

  describe('CSS Variables Injection', () => {
    const globalsPath = path.join(process.cwd(), 'app', 'globals.css');
    let cssContent: string;

    beforeAll(() => {
      cssContent = fs.readFileSync(globalsPath, 'utf-8');
    });

    it('should inject brand color variables in RGB format', () => {
      expect(cssContent).toContain('--color-brand-primary: 37 99 235');
      expect(cssContent).toContain('--color-brand-secondary: 239 68 68');
      expect(cssContent).toContain('--color-brand-accent: 46 233 246');
      expect(cssContent).toContain('--color-brand-accent-dark: 27 206 212');
    });

    it('should inject semantic color variables in RGB format', () => {
      expect(cssContent).toContain('--color-semantic-success: 16 185 129');
      expect(cssContent).toContain('--color-semantic-warning: 245 158 11');
      expect(cssContent).toContain('--color-semantic-error: 239 68 68');
      expect(cssContent).toContain('--color-semantic-info: 59 130 246');
    });

    it('should inject all neutral scale variables (50-950) in RGB format', () => {
      const neutralColors = {
        '50': '249 250 251',
        '100': '243 244 246',
        '200': '229 231 235',
        '300': '209 213 219',
        '400': '156 163 175',
        '500': '107 114 128',
        '600': '75 85 99',
        '700': '55 65 81',
        '800': '31 41 55',
        '900': '17 24 39',
        '950': '11 12 16'
      };

      Object.entries(neutralColors).forEach(([key, rgb]) => {
        expect(cssContent).toContain(`--color-neutral-${key}: ${rgb}`);
      });
    });

    it('should inject surface color variables in RGB format', () => {
      const surfaceColors = {
        'dark': '11 12 16',
        'darker': '5 6 8',
        'card': '17 19 24',
        'elevated': '26 29 35',
        'hover': '31 35 41'
      };

      Object.entries(surfaceColors).forEach(([key, rgb]) => {
        expect(cssContent).toContain(`--color-surface-${key}: ${rgb}`);
      });
    });

    it('should inject spacing scale variables', () => {
      const spacingValues = [
        ['0', '0px'],
        ['0-5', '0.125rem'],
        ['1', '0.25rem'],
        ['1-5', '0.375rem'],
        ['2', '0.5rem'],
        ['2-5', '0.625rem'],
        ['3', '0.75rem'],
        ['3-5', '0.875rem'],
        ['4', '1rem'],
        ['5', '1.25rem'],
        ['6', '1.5rem'],
        ['7', '1.75rem'],
        ['8', '2rem'],
        ['9', '2.25rem'],
        ['10', '2.5rem'],
        ['11', '2.75rem'],
        ['12', '3rem'],
        ['14', '3.5rem'],
        ['16', '4rem'],
        ['20', '5rem'],
        ['24', '6rem'],
        ['28', '7rem'],
        ['32', '8rem'],
        ['36', '9rem'],
        ['40', '10rem'],
        ['44', '11rem'],
        ['48', '12rem'],
        ['52', '13rem'],
        ['56', '14rem'],
        ['60', '15rem'],
        ['64', '16rem'],
        ['72', '18rem'],
        ['80', '20rem'],
        ['96', '24rem']
      ];

      spacingValues.forEach(([key, value]) => {
        expect(cssContent).toContain(`--spacing-${key}: ${value}`);
      });
    });

    it('should inject radius variables', () => {
      expect(cssContent).toContain('--radius-micro: 10px');
      expect(cssContent).toContain('--radius-card-sm: 14px');
      expect(cssContent).toContain('--radius-card: 18px');
      expect(cssContent).toContain('--radius-full: 9999px');
    });

    it('should inject font family variables in @theme block', () => {
      const themeBlock = cssContent.match(/@theme inline\s*{[^}]+}/);
      expect(themeBlock).toBeTruthy();
      
      const themeContent = themeBlock?.[0] || '';
      expect(themeContent).toContain('--font-sans: var(--font-inter), Inter, system-ui, sans-serif');
      expect(themeContent).toContain('--font-display: var(--font-space), "Space Grotesk", sans-serif');
      expect(themeContent).toContain('--font-mono: var(--font-mono), "IBM Plex Mono", monospace');
    });

    it('should use RGB format with space-separated values', () => {
      const rgbPattern = /--color-[a-z0-9-]+:\s+\d+\s+\d+\s+\d+/g;
      const matches = cssContent.match(rgbPattern);
      
      expect(matches).toBeTruthy();
      expect(matches!.length).toBeGreaterThan(20);
      
      matches?.forEach((match) => {
        expect(match).toMatch(/\d+\s+\d+\s+\d+/);
      });
    });

    it('should map colors to Tailwind utilities in @theme block', () => {
      const themeBlock = cssContent.match(/@theme inline\s*{[^}]+}/);
      expect(themeBlock).toBeTruthy();
      
      const themeContent = themeBlock?.[0] || '';
      expect(themeContent).toContain('--color-brand-primary: rgb(var(--color-brand-primary))');
      expect(themeContent).toContain('--color-brand-secondary: rgb(var(--color-brand-secondary))');
      expect(themeContent).toContain('--color-brand-accent: rgb(var(--color-brand-accent))');
      expect(themeContent).toContain('--color-semantic-success: rgb(var(--color-semantic-success))');
      expect(themeContent).toContain('--color-neutral-50: rgb(var(--color-neutral-50))');
      expect(themeContent).toContain('--color-surface-dark: rgb(var(--color-surface-dark))');
    });
  });

  describe('WCAG Accessibility Compliance', () => {
    const settingsPath = path.join(process.cwd(), '.zenflow', 'settings.json');
    let settings: any;
    const WHITE = '#FFFFFF';
    const WCAG_AA_NORMAL = 4.5;
    const WCAG_AA_LARGE = 3.0;

    beforeAll(() => {
      const rawSettings = fs.readFileSync(settingsPath, 'utf-8');
      settings = JSON.parse(rawSettings);
    });

    it('should meet contrast ratio for white text on surface-dark (≥4.5:1)', () => {
      const surfaceDark = settings.theme.colors.surface.dark;
      const ratio = getContrastRatio(WHITE, surfaceDark);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet contrast ratio for neutral-200 on surface-card (≥4.5:1)', () => {
      const neutral200 = settings.theme.colors.neutral['200'];
      const surfaceCard = settings.theme.colors.surface.card;
      const ratio = getContrastRatio(neutral200, surfaceCard);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet contrast ratio for brand-accent on surface-dark (≥4.5:1)', () => {
      const brandAccent = settings.theme.colors.brand.accent;
      const surfaceDark = settings.theme.colors.surface.dark;
      const ratio = getContrastRatio(brandAccent, surfaceDark);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet contrast ratio for brand-primary on white background (≥4.5:1)', () => {
      const brandPrimary = settings.theme.colors.brand.primary;
      const ratio = getContrastRatio(brandPrimary, WHITE);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet contrast ratio for semantic success on surface-dark (≥4.5:1)', () => {
      const success = settings.theme.colors.semantic.success;
      const surfaceDark = settings.theme.colors.surface.dark;
      const ratio = getContrastRatio(success, surfaceDark);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet contrast ratio for semantic warning on surface-dark (≥4.5:1)', () => {
      const warning = settings.theme.colors.semantic.warning;
      const surfaceDark = settings.theme.colors.surface.dark;
      const ratio = getContrastRatio(warning, surfaceDark);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet contrast ratio for semantic error on surface-dark (≥4.5:1)', () => {
      const error = settings.theme.colors.semantic.error;
      const surfaceDark = settings.theme.colors.surface.dark;
      const ratio = getContrastRatio(error, surfaceDark);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet contrast ratio for semantic info on surface-dark (≥4.5:1)', () => {
      const info = settings.theme.colors.semantic.info;
      const surfaceDark = settings.theme.colors.surface.dark;
      const ratio = getContrastRatio(info, surfaceDark);
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('should meet contrast ratio for large text combinations (≥3:1)', () => {
      const testCases = [
        { fg: settings.theme.colors.brand.primary, bg: settings.theme.colors.surface.dark },
        { fg: settings.theme.colors.brand.secondary, bg: settings.theme.colors.surface.dark },
        { fg: settings.theme.colors.neutral['400'], bg: settings.theme.colors.surface.dark },
      ];

      testCases.forEach(({ fg, bg }) => {
        const ratio = getContrastRatio(fg, bg);
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
      });
    });
  });

  describe('Backward Compatibility', () => {
    const globalsPath = path.join(process.cwd(), 'app', 'globals.css');
    let cssContent: string;

    beforeAll(() => {
      cssContent = fs.readFileSync(globalsPath, 'utf-8');
    });

    it('should preserve legacy Nexus CSS variables', () => {
      const nexusVariables = [
        '--nexus-dark',
        '--nexus-charcoal',
        '--nexus-cyan',
        '--nexus-white',
        '--nexus-gray',
      ];

      nexusVariables.forEach((variable) => {
        expect(cssContent).toContain(variable);
      });
    });

    it('should preserve deep-midnight color variable', () => {
      expect(cssContent).toContain('--deep-midnight');
      expect(cssContent).toContain('--deep-midnight: #0F172A');
    });

    it('should preserve shadcn UI HSL variables in :root', () => {
      const shadcnVariables = [
        '--border',
        '--input',
        '--ring',
        '--radius',
        '--card',
        '--card-foreground',
        '--primary',
        '--primary-foreground',
        '--secondary',
        '--secondary-foreground',
        '--muted',
        '--muted-foreground',
        '--accent',
        '--accent-foreground',
      ];

      shadcnVariables.forEach((variable) => {
        expect(cssContent).toContain(variable);
      });
    });

    it('should preserve legacy color aliases in @theme block', () => {
      const themeBlock = cssContent.match(/@theme inline\s*{[^}]+}/);
      expect(themeBlock).toBeTruthy();
      
      const themeContent = themeBlock?.[0] || '';
      const legacyColorAliases = [
        '--color-background',
        '--color-foreground',
        '--color-bleu-nuit',
        '--color-bleu-primaire',
        '--color-bleu-secondaire',
        '--color-blanc-pur',
        '--color-rouge-corail',
        '--color-ligne-bordure',
      ];

      legacyColorAliases.forEach((variable) => {
        expect(themeContent).toContain(variable);
      });
    });

    it('should have Nexus variables with correct color values', () => {
      expect(cssContent).toContain('--nexus-dark: #0B0C10');
      expect(cssContent).toContain('--nexus-charcoal: #111318');
      expect(cssContent).toContain('--nexus-cyan: #2EE9F6');
      expect(cssContent).toContain('--nexus-white: #F4F6FA');
      expect(cssContent).toContain('--nexus-gray: #A6A9B4');
    });

    it('should verify GSAP sections can access required variables', () => {
      const gsapRequiredVariables = [
        '--nexus-dark',
        '--nexus-charcoal',
        '--nexus-cyan',
        '--color-brand-accent',
        '--color-surface-card',
      ];

      gsapRequiredVariables.forEach((variable) => {
        expect(cssContent).toContain(variable);
      });
    });
  });

  describe('getColor Helper', () => {
    it('should return color value for valid path', () => {
      expect(getColor('brand.primary')).toBe('#2563EB');
      expect(getColor('brand.secondary')).toBe('#EF4444');
      expect(getColor('brand.accent')).toBe('#2EE9F6');
    });

    it('should return color value for nested path', () => {
      expect(getColor('semantic.success')).toBe('#10B981');
      expect(getColor('semantic.warning')).toBe('#F59E0B');
      expect(getColor('semantic.error')).toBe('#EF4444');
      expect(getColor('semantic.info')).toBe('#3B82F6');
    });

    it('should return color value for neutral scale', () => {
      expect(getColor('neutral.50')).toBe('#F9FAFB');
      expect(getColor('neutral.500')).toBe('#6B7280');
      expect(getColor('neutral.950')).toBe('#0B0C10');
    });

    it('should return color value for surface colors', () => {
      expect(getColor('surface.dark')).toBe('#0B0C10');
      expect(getColor('surface.card')).toBe('#111318');
    });

    it('should return fallback color for invalid path', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = getColor('invalid.path');
      
      expect(result).toBe('#000000');
      expect(consoleSpy).toHaveBeenCalledWith('Color token not found: invalid.path');
      
      consoleSpy.mockRestore();
    });

    it('should return fallback color for partially invalid path', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = getColor('brand.nonexistent');
      
      expect(result).toBe('#000000');
      expect(consoleSpy).toHaveBeenCalledWith('Color token not found: brand.nonexistent');
      
      consoleSpy.mockRestore();
    });
  });
});
