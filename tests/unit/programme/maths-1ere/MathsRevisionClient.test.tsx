import React from 'react';
import { render, screen } from '@testing-library/react';
import MathsRevisionClient from '@/app/programme/maths-1ere/components/MathsRevisionClient';

// Mock next/dynamic
jest.mock('next/dynamic', () => () => {
    const DynamicComponent = () => <div>Dynamic Component</div>;
    DynamicComponent.displayName = 'LoadableComponent';
    return DynamicComponent;
});

// Mock MathJaxProvider
jest.mock('@/app/programme/maths-1ere/components/MathJaxProvider', () => ({
    useMathJax: jest.fn(),
    MathJaxProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock store
jest.mock('@/app/programme/maths-1ere/store', () => {
    const mockStoreState = {
        getNiveau: () => ({ badge: '🌱', nom: 'Novice' }),
        getXPProgress: () => ({ percent: 0, current: 0, nextThreshold: 100 }),
        getNextNiveau: () => ({ badge: '🚀', nom: 'Initié' }),
        recordActivity: jest.fn(),
        evaluateBadges: jest.fn(),
        completedChapters: [],
        badges: [],
        comboCount: 0,
        store: {
            totalXP: 0,
            streak: 0,
            streakFreezes: 0,
            dailyChallenge: { completedToday: false },
        },
        totalXP: 0,
        streak: 0,
        streakFreezes: 0,
        dailyChallenge: { completedToday: false },
        getDueReviews: () => [],
        getComboMultiplier: () => 1,
        buyStreakFreeze: jest.fn(),
        completeDailyChallenge: jest.fn(),
        toggleChapterComplete: jest.fn(),
        recordExerciseResult: jest.fn(),
    };

    const mockUseMathsLabStore = () => mockStoreState;
    mockUseMathsLabStore.subscribe = jest.fn(() => jest.fn());
    mockUseMathsLabStore.getState = () => mockStoreState;

    return {
        useMathsLabStore: mockUseMathsLabStore,
    };
});

// Mock data
jest.mock('@/app/programme/maths-1ere/data', () => ({
    programmeData: {
        analyse: {
            id: 'analyse',
            titre: 'Analyse',
            couleur: 'cyan',
            icon: '📈',
            chapitres: [
                { id: 'suites', titre: 'Suites Numériques', difficulte: 1, pointsXP: 0, contenu: {} }
            ]
        }
    },
    quizData: [],
    dailyChallenges: [
        { id: 'dc1', question: 'Question?', reponse: 'Réponse', xp: 10 }
    ],
    badgeDefinitions: [],
}));

describe('MathsRevisionClient', () => {
    it('renders the navbar and header', () => {
        render(<MathsRevisionClient />);
        expect(screen.getByText(/NEXUS MATHS LAB/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Novice/i).length).toBeGreaterThan(0);
    });

    it('renders the dashboard by default', () => {
        render(<MathsRevisionClient />);
        expect(screen.getByText(/Progression Globale/i)).toBeInTheDocument();
        expect(screen.getByText(/Défi du jour/i)).toBeInTheDocument();
    });
});
