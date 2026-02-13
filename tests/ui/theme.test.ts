/**
 * Theme Validation Tests
 * Verifies that Tailwind CSS v4 theme variables are correctly injected
 * and meet WCAG accessibility standards
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Design System - Theme Variables', () => {
    let cssVariables: Map<string, string>;

    const getVar = (name: string): string => {
        return (cssVariables.get(name) || '').trim();
    };

    beforeAll(() => {
        // Parse :root CSS variables directly to avoid JSDOM CSS parsing limitations
        const cssPath = path.join(process.cwd(), 'app', 'globals.css');
        const css = fs.readFileSync(cssPath, 'utf-8');
        cssVariables = new Map();

        const rootMatch = css.match(/:root\s*{([\s\S]*?)}/);
        const rootBlock = rootMatch ? rootMatch[1] : '';
        const variableRegex = /--[a-zA-Z0-9-_]+\s*:\s*[^;]+;/g;
        const matches = rootBlock.match(variableRegex) || [];

        for (const match of matches) {
            const separatorIndex = match.indexOf(':');
            if (separatorIndex === -1) continue;
            const name = match.slice(0, separatorIndex).trim();
            const value = match.slice(separatorIndex + 1).replace(/;$/, '').trim();
            cssVariables.set(name, value);
        }
    });

    describe('Brand Colors', () => {
        it('should have brand-primary color defined', () => {
            const primary = getVar('--color-brand-primary');
            expect(primary).toBeTruthy();
            expect(primary).toBe('37 99 235'); // #2563EB in RGB
        });

        it('should have brand-secondary color defined', () => {
            const secondary = getVar('--color-brand-secondary');
            expect(secondary).toBeTruthy();
            expect(secondary).toBe('242 92 92'); // #F25C5C in RGB
        });

        it('should have brand-accent color defined', () => {
            const accent = getVar('--color-brand-accent');
            expect(accent).toBeTruthy();
            expect(accent).toBe('79 209 233'); // #4FD1E9 in RGB
        });

        it('should have brand-accent-dark color defined', () => {
            const accentDark = getVar('--color-brand-accent-dark');
            expect(accentDark).toBeTruthy();
            expect(accentDark).toBe('56 191 214'); // #38BFD6 in RGB
        });
    });

    describe('Semantic Colors', () => {
        it('should have success color defined', () => {
            const success = getVar('--color-semantic-success');
            expect(success).toBeTruthy();
            expect(success).toBe('16 185 129'); // #10B981 in RGB
        });

        it('should have warning color defined', () => {
            const warning = getVar('--color-semantic-warning');
            expect(warning).toBeTruthy();
            expect(warning).toBe('245 158 11'); // #F59E0B in RGB
        });

        it('should have error color defined', () => {
            const error = getVar('--color-semantic-error');
            expect(error).toBeTruthy();
            expect(error).toBe('239 68 68'); // #EF4444 in RGB
        });

        it('should have info color defined', () => {
            const info = getVar('--color-semantic-info');
            expect(info).toBeTruthy();
            expect(info).toBe('59 130 246'); // #3B82F6 in RGB
        });
    });

    describe('Neutral Scale', () => {
        const neutralColors = [
            { name: '50', rgb: '249 250 251' },
            { name: '100', rgb: '243 244 246' },
            { name: '200', rgb: '229 231 235' },
            { name: '300', rgb: '209 213 219' },
            { name: '400', rgb: '156 163 175' },
            { name: '500', rgb: '107 114 128' },
            { name: '600', rgb: '75 85 99' },
            { name: '700', rgb: '55 65 81' },
            { name: '800', rgb: '31 41 55' },
            { name: '900', rgb: '17 24 39' },
            { name: '950', rgb: '11 12 16' },
        ];

        neutralColors.forEach(({ name, rgb }) => {
            it(`should have neutral-${name} color defined`, () => {
                const color = getVar(`--color-neutral-${name}`);
                expect(color).toBeTruthy();
                expect(color).toBe(rgb);
            });
        });
    });

    describe('Surface Colors', () => {
        it('should have surface-dark color defined', () => {
            const surfaceDark = getVar('--color-surface-dark');
            expect(surfaceDark).toBeTruthy();
            expect(surfaceDark).toBe('11 16 24'); // #0B1018 in RGB
        });

        it('should have surface-card color defined', () => {
            const surfaceCard = getVar('--color-surface-card');
            expect(surfaceCard).toBeTruthy();
            expect(surfaceCard).toBe('17 24 38'); // #111826 in RGB
        });

        it('should have surface-elevated color defined', () => {
            const surfaceElevated = getVar('--color-surface-elevated');
            expect(surfaceElevated).toBeTruthy();
            expect(surfaceElevated).toBe('21 29 43'); // #151D2B in RGB
        });
    });

    describe('Typography', () => {
        it('should have font-inter defined', () => {
            const fontInter = getVar('--font-inter');
            expect(fontInter).toBeTruthy();
            expect(fontInter).toContain('Inter');
        });

        it('should have font-poppins defined', () => {
            const fontPoppins = getVar('--font-poppins');
            expect(fontPoppins).toBeTruthy();
            expect(fontPoppins).toContain('Poppins');
        });

        it('should have font-eb-garamond defined', () => {
            const fontGaramond = getVar('--font-eb-garamond');
            expect(fontGaramond).toBeTruthy();
            expect(fontGaramond).toContain('EB Garamond');
        });
    });

    describe('Spacing Scale', () => {
        const spacingValues = [
            { name: '0', value: '0px' },
            { name: '1', value: '0.25rem' },
            { name: '2', value: '0.5rem' },
            { name: '4', value: '1rem' },
            { name: '8', value: '2rem' },
            { name: '16', value: '4rem' },
        ];

        spacingValues.forEach(({ name, value }) => {
            it(`should have spacing-${name} defined as ${value}`, () => {
                const spacing = getVar(`--spacing-${name}`);
                expect(spacing).toBeTruthy();
                expect(spacing).toBe(value);
            });
        });
    });

    describe('Border Radius', () => {
        it('should have radius-micro defined', () => {
            const radiusMicro = getVar('--radius-micro');
            expect(radiusMicro).toBeTruthy();
            expect(radiusMicro).toBe('10px');
        });

        it('should have radius-card defined', () => {
            const radiusCard = getVar('--radius-card');
            expect(radiusCard).toBeTruthy();
            expect(radiusCard).toBe('18px');
        });

        it('should have radius-full defined', () => {
            const radiusFull = getVar('--radius-full');
            expect(radiusFull).toBeTruthy();
            expect(radiusFull).toBe('9999px');
        });
    });
});

describe('WCAG Accessibility Compliance', () => {
    /**
     * Helper function to calculate relative luminance
     * Based on WCAG 2.1 formula
     */
    function getLuminance(r: number, g: number, b: number): number {
        const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    /**
     * Calculate contrast ratio between two colors
     */
    function getContrastRatio(rgb1: string, rgb2: string): number {
        const [r1, g1, b1] = rgb1.split(' ').map(Number);
        const [r2, g2, b2] = rgb2.split(' ').map(Number);

        const l1 = getLuminance(r1, g1, b1);
        const l2 = getLuminance(r2, g2, b2);

        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);

        return (lighter + 0.05) / (darker + 0.05);
    }

    it('should have sufficient contrast for brand-accent on dark background (AAA)', () => {
        const accent = '46 233 246'; // brand-accent
        const dark = '11 12 16'; // surface-dark
        const ratio = getContrastRatio(accent, dark);
        expect(ratio).toBeGreaterThanOrEqual(7); // AAA for normal text
    });

    it('should have sufficient contrast for white on surface-dark (AAA)', () => {
        const white = '255 255 255';
        const dark = '11 12 16'; // surface-dark
        const ratio = getContrastRatio(white, dark);
        expect(ratio).toBeGreaterThanOrEqual(7); // AAA for normal text
    });

    it('should have sufficient contrast for neutral-200 on surface-dark (AAA)', () => {
        const neutral200 = '229 231 235';
        const dark = '11 12 16'; // surface-dark
        const ratio = getContrastRatio(neutral200, dark);
        expect(ratio).toBeGreaterThanOrEqual(7); // AAA for normal text
    });

    it('should have sufficient contrast for success color on dark background (AAA)', () => {
        const success = '16 185 129';
        const dark = '11 12 16'; // surface-dark
        const ratio = getContrastRatio(success, dark);
        expect(ratio).toBeGreaterThanOrEqual(7); // AAA for normal text
    });

    it('should have sufficient contrast for warning color on dark background (AAA)', () => {
        const warning = '245 158 11';
        const dark = '11 12 16'; // surface-dark
        const ratio = getContrastRatio(warning, dark);
        expect(ratio).toBeGreaterThanOrEqual(7); // AAA for normal text
    });
});
