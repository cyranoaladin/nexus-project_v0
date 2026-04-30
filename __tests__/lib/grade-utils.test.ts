import { GradeLevel, AcademicTrack } from '@prisma/client';
import { normalizeGradeLevel, getDefaultTrackForLevel, normalizeStudentLevelAndTrack } from '../../lib/utils/grade-utils';

describe('normalizeGradeLevel', () => {
  test('should normalize Premiere variations', () => {
    expect(normalizeGradeLevel('Première')).toBe(GradeLevel.PREMIERE);
    expect(normalizeGradeLevel('premiere')).toBe(GradeLevel.PREMIERE);
    expect(normalizeGradeLevel('PREMIERE')).toBe(GradeLevel.PREMIERE);
    expect(normalizeGradeLevel('1ère')).toBe(GradeLevel.PREMIERE);
    expect(normalizeGradeLevel('1ere')).toBe(GradeLevel.PREMIERE);
    expect(normalizeGradeLevel('1re')).toBe(GradeLevel.PREMIERE);
    expect(normalizeGradeLevel('First')).toBe(GradeLevel.PREMIERE);
  });

  test('should normalize Terminale variations', () => {
    expect(normalizeGradeLevel('Terminale')).toBe(GradeLevel.TERMINALE);
    expect(normalizeGradeLevel('terminale')).toBe(GradeLevel.TERMINALE);
    expect(normalizeGradeLevel('TERMINALE')).toBe(GradeLevel.TERMINALE);
    expect(normalizeGradeLevel('Term')).toBe(GradeLevel.TERMINALE);
    expect(normalizeGradeLevel('Tle')).toBe(GradeLevel.TERMINALE);
  });

  test('should normalize Troisieme variations', () => {
    expect(normalizeGradeLevel('Troisième')).toBe(GradeLevel.TROISIEME);
    expect(normalizeGradeLevel('troisieme')).toBe(GradeLevel.TROISIEME);
    expect(normalizeGradeLevel('3ème')).toBe(GradeLevel.TROISIEME);
    expect(normalizeGradeLevel('3eme')).toBe(GradeLevel.TROISIEME);
    expect(normalizeGradeLevel('Collège')).toBe(GradeLevel.TROISIEME);
  });

  test('should normalize Seconde variations', () => {
    expect(normalizeGradeLevel('Seconde')).toBe(GradeLevel.SECONDE);
    expect(normalizeGradeLevel('seconde')).toBe(GradeLevel.SECONDE);
    expect(normalizeGradeLevel('2nd')).toBe(GradeLevel.SECONDE);
  });

  test('should handle null/undefined/empty', () => {
    expect(normalizeGradeLevel(null)).toBe(null);
    expect(normalizeGradeLevel(undefined)).toBe(null);
    expect(normalizeGradeLevel('')).toBe(null);
    expect(normalizeGradeLevel('   ')).toBe(null);
  });

  test('should handle unknown values', () => {
    expect(normalizeGradeLevel('unknown')).toBe(null);
    expect(normalizeGradeLevel('primaire')).toBe(null);
  });

  test('should handle filieres by returning the base level', () => {
    expect(normalizeGradeLevel('Première STMG')).toBe(GradeLevel.PREMIERE);
    expect(normalizeGradeLevel('Terminale STMG')).toBe(GradeLevel.TERMINALE);
  });
});

describe('normalizeStudentLevelAndTrack', () => {
  test('should extract level and track correctly', () => {
    expect(normalizeStudentLevelAndTrack('Première STMG')).toEqual({
      level: GradeLevel.PREMIERE,
      track: AcademicTrack.STMG
    });
    expect(normalizeStudentLevelAndTrack('Terminale STMG')).toEqual({
      level: GradeLevel.TERMINALE,
      track: AcademicTrack.STMG
    });
    expect(normalizeStudentLevelAndTrack('3ème')).toEqual({
      level: GradeLevel.TROISIEME,
      track: AcademicTrack.COLLEGE
    });
    expect(normalizeStudentLevelAndTrack('Seconde')).toEqual({
      level: GradeLevel.SECONDE,
      track: AcademicTrack.EDS_GENERALE
    });
  });

  test('should return null for invalid inputs', () => {
    expect(normalizeStudentLevelAndTrack('')).toBe(null);
    expect(normalizeStudentLevelAndTrack('unknown')).toBe(null);
    expect(normalizeStudentLevelAndTrack(undefined)).toBe(null);
  });
});

describe('getDefaultTrackForLevel', () => {
  test('should return COLLEGE for TROISIEME', () => {
    expect(getDefaultTrackForLevel(GradeLevel.TROISIEME)).toBe(AcademicTrack.COLLEGE);
  });

  test('should return EDS_GENERALE for others', () => {
    expect(getDefaultTrackForLevel(GradeLevel.PREMIERE)).toBe(AcademicTrack.EDS_GENERALE);
    expect(getDefaultTrackForLevel(GradeLevel.TERMINALE)).toBe(AcademicTrack.EDS_GENERALE);
    expect(getDefaultTrackForLevel(GradeLevel.SECONDE)).toBe(AcademicTrack.EDS_GENERALE);
  });
});
