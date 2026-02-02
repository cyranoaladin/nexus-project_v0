import fs from 'fs';
import path from 'path';
import { designTokens } from '@/lib/theme/tokens';

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
      const themeBlock = cssContent.match(/@theme inline\s*{[^}]+}/s);
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
      const themeBlock = cssContent.match(/@theme inline\s*{[^}]+}/s);
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
});
