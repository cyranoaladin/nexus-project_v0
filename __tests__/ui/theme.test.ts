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
});
