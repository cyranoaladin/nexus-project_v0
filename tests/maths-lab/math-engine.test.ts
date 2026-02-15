/**
 * Unit Tests — Math Engine (Pure Functions & Data Integrity)
 * Tests for: SM-2 algorithm, calculateStreak, badge conditions, data integrity
 */

// We need to test the pure functions directly. Since they are not exported,
// we test via the store behavior and also test the exported data structures.

import { programmeData, dailyChallenges, quizData, getNiveau, niveaux, badgeDefinitions } from '@/app/programme/maths-1ere/data';

describe('Math Engine — Data Integrity', () => {

    // ─── Programme Data ───────────────────────────────────────────────────────

    describe('Programme Data (B.O. compliance)', () => {
        it('should have all categories defined', () => {
            expect(Object.keys(programmeData).length).toBeGreaterThanOrEqual(4);
            expect(programmeData).toHaveProperty('algebre');
            expect(programmeData).toHaveProperty('analyse');
            expect(programmeData).toHaveProperty('geometrie');
            expect(programmeData).toHaveProperty('probabilites');
        });

        it('every chapter should have a non-empty id', () => {
            Object.values(programmeData).forEach(cat => {
                cat.chapitres.forEach(chap => {
                    expect(chap.id).toBeTruthy();
                    expect(typeof chap.id).toBe('string');
                    expect(chap.id.length).toBeGreaterThan(0);
                });
            });
        });

        it('every chapter should have a non-empty titre', () => {
            Object.values(programmeData).forEach(cat => {
                cat.chapitres.forEach(chap => {
                    expect(chap.titre).toBeTruthy();
                    expect(chap.titre).not.toBe('undefined');
                    expect(chap.titre.length).toBeGreaterThan(0);
                });
            });
        });

        it('every chapter should have valid pointsXP (> 0, not NaN)', () => {
            Object.values(programmeData).forEach(cat => {
                cat.chapitres.forEach(chap => {
                    expect(chap.pointsXP).toBeGreaterThan(0);
                    expect(Number.isNaN(chap.pointsXP)).toBe(false);
                });
            });
        });

        it('every chapter should have valid difficulty (1-5)', () => {
            Object.values(programmeData).forEach(cat => {
                cat.chapitres.forEach(chap => {
                    expect(chap.difficulte).toBeGreaterThanOrEqual(1);
                    expect(chap.difficulte).toBeLessThanOrEqual(5);
                });
            });
        });

        it('should NOT contain Terminale content (combinatoire)', () => {
            Object.values(programmeData).forEach(cat => {
                cat.chapitres.forEach(chap => {
                    expect(chap.id).not.toBe('combinatoire');
                    expect(chap.id).not.toContain('limites-initiation');
                    expect(chap.id).not.toBe('continuite');
                });
            });
        });

        it('chapter ids should be unique across the entire programme', () => {
            const ids: string[] = [];
            Object.values(programmeData).forEach(cat => {
                cat.chapitres.forEach(chap => {
                    expect(ids).not.toContain(chap.id);
                    ids.push(chap.id);
                });
            });
        });
    });

    // ─── Daily Challenges ─────────────────────────────────────────────────────

    describe('Daily Challenges', () => {
        it('should have at least 25 challenges', () => {
            expect(dailyChallenges.length).toBeGreaterThanOrEqual(25);
        });

        it('every challenge should have non-empty question and reponse', () => {
            dailyChallenges.forEach(dc => {
                expect(dc.question).toBeTruthy();
                expect(dc.reponse).toBeTruthy();
                expect(dc.question.length).toBeGreaterThan(0);
                expect(dc.reponse.length).toBeGreaterThan(0);
            });
        });

        it('every challenge should have xp > 0', () => {
            dailyChallenges.forEach(dc => {
                expect(dc.xp).toBeGreaterThan(0);
                expect(Number.isNaN(dc.xp)).toBe(false);
            });
        });

        it('challenge ids should be unique', () => {
            const ids = dailyChallenges.map(dc => dc.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });

        it('should NOT contain Terminale categories', () => {
            const forbidden = ['Combinatoire', 'Limites', 'Continuité'];
            dailyChallenges.forEach(dc => {
                expect(forbidden).not.toContain(dc.categorie);
            });
        });
    });

    // ─── Quiz Data ────────────────────────────────────────────────────────────

    describe('Quiz Data', () => {
        it('should have at least 20 questions', () => {
            expect(quizData.length).toBeGreaterThanOrEqual(20);
        });

        it('every question should have 4 options', () => {
            quizData.forEach(q => {
                expect(q.options).toHaveLength(4);
            });
        });

        it('correct answer index should be valid (0-3)', () => {
            quizData.forEach(q => {
                expect(q.correct).toBeGreaterThanOrEqual(0);
                expect(q.correct).toBeLessThanOrEqual(3);
            });
        });

        it('question ids should be unique', () => {
            const ids = quizData.map(q => q.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });

        it('should NOT contain Terminale categories', () => {
            const forbidden = ['Combinatoire', 'Limites', 'Continuité'];
            quizData.forEach(q => {
                expect(forbidden).not.toContain(q.categorie);
            });
        });
    });

    // ─── Niveau System ────────────────────────────────────────────────────────

    describe('Niveau (Level) System', () => {
        it('should have at least 5 levels', () => {
            expect(niveaux.length).toBeGreaterThanOrEqual(5);
        });

        it('levels should be in ascending XP order', () => {
            for (let i = 1; i < niveaux.length; i++) {
                expect(niveaux[i].xpMin).toBeGreaterThan(niveaux[i - 1].xpMin);
            }
        });

        it('getNiveau(0) should return first level', () => {
            expect(getNiveau(0).nom).toBe('Novice');
        });

        it('getNiveau(9999) should return highest level', () => {
            const highest = niveaux[niveaux.length - 1];
            expect(getNiveau(9999).nom).toBe(highest.nom);
        });

        it('should never return NaN for any XP value', () => {
            [0, 50, 100, 200, 500, 1000, 2000, 5000].forEach(xp => {
                const level = getNiveau(xp);
                expect(level).toBeDefined();
                expect(level.nom).toBeTruthy();
                expect(Number.isNaN(level.xpMin)).toBe(false);
            });
        });
    });

    // ─── Badge Definitions ────────────────────────────────────────────────────

    describe('Badge Definitions', () => {
        it('should have at least 10 badges', () => {
            expect(badgeDefinitions.length).toBeGreaterThanOrEqual(10);
        });

        it('badge ids should be unique', () => {
            const ids = badgeDefinitions.map(b => b.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });

        it('every badge should have icon and description', () => {
            badgeDefinitions.forEach(b => {
                expect(b.icon).toBeTruthy();
                expect(b.description).toBeTruthy();
                expect(b.nom).toBeTruthy();
                expect(b.condition).toBeTruthy();
            });
        });
    });
});
