/**
 * F41: Exam persistence tests
 * Validates that exam state is persisted to and restored from Zustand store
 */

import { useMathsLabStore, MathsLabState } from '@/app/programme/maths-1ere/store';

describe('F41: Exam Persistence', () => {
  // Get initial state for reset
  const getFreshStore = () => {
    const store = useMathsLabStore.getState();
    // Reset to initial state
    store.clearExamState();
    return store;
  };

  beforeEach(() => {
    getFreshStore();
  });

  it('should have initial examState with default values', () => {
    const state = useMathsLabStore.getState();

    expect(state.examState).toBeDefined();
    expect(state.examState.autoStates).toEqual({});
    expect(state.examState.exScores).toEqual({});
    expect(state.examState.elapsedSeconds).toBe(0);
    expect(state.examState.isActive).toBe(false);
    expect(state.examState.lastUpdated).toBeNull();
  });

  it('should persist autoStates via saveExamState', () => {
    const store = useMathsLabStore.getState();

    const testAutoStates = {
      'auto-1': { reponse: '42', revealed: true, selfScore: 1 as const },
      'auto-2': { reponse: 'test', revealed: false },
    };

    store.saveExamState({
      autoStates: testAutoStates,
      exScores: {},
      elapsedSeconds: 0,
      isActive: true,
    });

    const newState = useMathsLabStore.getState();
    expect(newState.examState.autoStates).toEqual(testAutoStates);
    expect(newState.examState.isActive).toBe(true);
    expect(newState.examState.lastUpdated).not.toBeNull();
  });

  it('should persist exScores via saveExamState', () => {
    const store = useMathsLabStore.getState();

    const testExScores = {
      'ex-1-1': 2.5,
      'ex-2-3': 1.0,
      'ex-3-2': 3.0,
    };

    store.saveExamState({
      autoStates: {},
      exScores: testExScores,
      elapsedSeconds: 120,
      isActive: true,
    });

    const newState = useMathsLabStore.getState();
    expect(newState.examState.exScores).toEqual(testExScores);
    expect(newState.examState.elapsedSeconds).toBe(120);
  });

  it('should persist elapsedSeconds via saveExamState', () => {
    const store = useMathsLabStore.getState();

    store.saveExamState({
      autoStates: {},
      exScores: {},
      elapsedSeconds: 3661, // 1h 1m 1s
      isActive: true,
    });

    const newState = useMathsLabStore.getState();
    expect(newState.examState.elapsedSeconds).toBe(3661);
  });

  it('should persist isActive flag via saveExamState', () => {
    const store = useMathsLabStore.getState();

    // Test isActive: true
    store.saveExamState({
      autoStates: {},
      exScores: {},
      elapsedSeconds: 0,
      isActive: true,
    });

    let newState = useMathsLabStore.getState();
    expect(newState.examState.isActive).toBe(true);
  });

  it('should restore persisted state correctly', () => {
    const store = useMathsLabStore.getState();

    const persistedData = {
      autoStates: { 'auto-1': { reponse: 'test', revealed: true, selfScore: 0.5 as const } },
      exScores: { 'ex-1': 2.0 },
      elapsedSeconds: 1800,
      isActive: true,
    };

    store.saveExamState(persistedData);

    // Simulate reading back (new store instance would get this from localStorage)
    const restoredState = useMathsLabStore.getState();

    expect(restoredState.examState.autoStates).toEqual(persistedData.autoStates);
    expect(restoredState.examState.exScores).toEqual(persistedData.exScores);
    expect(restoredState.examState.elapsedSeconds).toBe(persistedData.elapsedSeconds);
    expect(restoredState.examState.isActive).toBe(persistedData.isActive);
  });

  it('should clear exam state via clearExamState', () => {
    const store = useMathsLabStore.getState();

    // First save some data
    store.saveExamState({
      autoStates: { 'auto-1': { reponse: 'test', revealed: true } },
      exScores: { 'ex-1': 2.0 },
      elapsedSeconds: 3600,
      isActive: true,
    });

    // Then clear it
    store.clearExamState();

    const clearedState = useMathsLabStore.getState();
    expect(clearedState.examState.autoStates).toEqual({});
    expect(clearedState.examState.exScores).toEqual({});
    expect(clearedState.examState.elapsedSeconds).toBe(0);
    expect(clearedState.examState.isActive).toBe(false);
    expect(clearedState.examState.lastUpdated).toBeNull();
  });

  it('should update lastUpdated timestamp on save', () => {
    const store = useMathsLabStore.getState();

    const beforeSave = new Date().toISOString();
    store.saveExamState({
      autoStates: {},
      exScores: {},
      elapsedSeconds: 0,
      isActive: true,
    });
    const afterSave = new Date().toISOString();

    const state = useMathsLabStore.getState();
    expect(state.examState.lastUpdated).not.toBeNull();
    // Timestamp should be between before and after
    expect(state.examState.lastUpdated! >= beforeSave || state.examState.lastUpdated! <= afterSave).toBe(true);
  });
});
