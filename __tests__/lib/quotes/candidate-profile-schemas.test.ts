import {
  jsonValueSchema,
  dispenseDeclareeSchema,
  noteConserveeSchema,
  reconductionAuditSchema,
  p3EligibiliteAuditEntrySchema,
  createProfilCandidatSchema,
  reviseProfilCandidatSchema,
} from '@/lib/quotes/candidate-profile-schemas';
import { toPrismaJson } from '@/lib/quotes/candidate-profile-persistence.server';
import { Prisma } from '@prisma/client';

describe('Candidate Profile Schemas & Option 2+ Invariants', () => {
  describe('jsonValueSchema (strict recursive JSON)', () => {
    test('accepts valid primitives and structured JSON values', () => {
      expect(jsonValueSchema.safeParse('hello').success).toBe(true);
      expect(jsonValueSchema.safeParse(42).success).toBe(true);
      expect(jsonValueSchema.safeParse(3.14).success).toBe(true);
      expect(jsonValueSchema.safeParse(true).success).toBe(true);
      expect(jsonValueSchema.safeParse(false).success).toBe(true);
      expect(jsonValueSchema.safeParse(null).success).toBe(true);
      expect(jsonValueSchema.safeParse([1, 'two', { three: 4 }]).success).toBe(true);
      expect(jsonValueSchema.safeParse({ a: 1, b: [true, null] }).success).toBe(true);
    });

    test('rejects non-finite numbers (NaN, Infinity, -Infinity)', () => {
      expect(jsonValueSchema.safeParse(NaN).success).toBe(false);
      expect(jsonValueSchema.safeParse(Infinity).success).toBe(false);
      expect(jsonValueSchema.safeParse(-Infinity).success).toBe(false);
    });

    test('rejects functions, undefined, BigInt, and Symbols', () => {
      expect(jsonValueSchema.safeParse(() => {}).success).toBe(false);
      expect(jsonValueSchema.safeParse(undefined).success).toBe(false);
      expect(jsonValueSchema.safeParse(BigInt(123)).success).toBe(false);
      expect(jsonValueSchema.safeParse(Symbol('sym')).success).toBe(false);
    });
  });

  describe('Strict Regulatory Domain Schemas', () => {
    test('dispenseDeclareeSchema validates exact contract and rejects unknown fields', () => {
      const valid = {
        epreuveId: 'PHILOSOPHIE',
        statut: 'DECLAREE' as const,
        justificatifRef: 'REF-2026-001',
      };
      expect(dispenseDeclareeSchema.safeParse(valid).success).toBe(true);

      const invalidForged = {
        ...valid,
        forgedExtraField: 'malicious',
      };
      expect(dispenseDeclareeSchema.safeParse(invalidForged).success).toBe(false);
    });

    test('noteConserveeSchema enforces valid grades (0-20) and year invariants', () => {
      const valid = {
        epreuveId: 'FRANCAIS_ECRIT',
        note: 14.5,
        sessionObtention: 2026,
        mecanisme: 'CONSERVATION_DEMANDEE' as const,
      };
      expect(noteConserveeSchema.safeParse(valid).success).toBe(true);

      expect(noteConserveeSchema.safeParse({ ...valid, note: -1 }).success).toBe(false);
      expect(noteConserveeSchema.safeParse({ ...valid, note: 20.5 }).success).toBe(false);
      expect(noteConserveeSchema.safeParse({ ...valid, sessionObtention: 2014 }).success).toBe(false);
      expect(noteConserveeSchema.safeParse({ ...valid, sessionObtention: 2036 }).success).toBe(false);
    });

    test('reconductionAuditSchema validates audit contract and rejects extra properties', () => {
      const valid = {
        mecanismeDeclare: 'RECONDUCTION_AUTOMATIQUE_DECLAREE' as const,
        statutVerification: 'VERIFIEE' as const,
        sourceReglementaire: 'Article D. 334-7-1',
        sessionOrigine: 2026,
        sessionCible: 2027,
      };
      expect(reconductionAuditSchema.safeParse(valid).success).toBe(true);
      expect(reconductionAuditSchema.safeParse({ ...valid, extra: 123 }).success).toBe(false);
    });

    test('p3EligibiliteAuditEntrySchema validates motif, decision, and date', () => {
      const valid = {
        motif: 'SPORTIF_HAUT_NIVEAU',
        faitsDeclares: true,
        justificatifRequis: true,
        justificatifValide: true,
        decision: 'CONFIRMEE' as const,
        sourceReglementaire: 'Article 3 Arrêté 2018',
      };
      expect(p3EligibiliteAuditEntrySchema.safeParse(valid).success).toBe(true);
      expect(p3EligibiliteAuditEntrySchema.safeParse({ motif: 'SPORTIF_HAUT_NIVEAU' }).success).toBe(false);
    });
  });

  describe('Route Schemas (createProfilCandidatSchema & reviseProfilCandidatSchema)', () => {
    test('createProfilCandidatSchema requires contactLeadId or studentId and rejects duplicates', () => {
      const base = {
        level: 'TERMINALE' as const,
        examSession: 2027,
        modalite: 'A' as const,
        specialite1: 'MATHEMATIQUES' as const,
        specialite2: 'NSI' as const,
      };

      // Missing anchor lead/student
      expect(createProfilCandidatSchema.safeParse(base).success).toBe(false);

      // Valid with contactLeadId
      const valid = { ...base, contactLeadId: 'lead-1' };
      expect(createProfilCandidatSchema.safeParse(valid).success).toBe(true);

      // Rejects identical specialite1 and specialite2
      const invalidSpecs = { ...valid, specialite2: 'MATHEMATIQUES' as const };
      expect(createProfilCandidatSchema.safeParse(invalidSpecs).success).toBe(false);

      // Rejects forged properties
      const forged = { ...valid, ariaAccess: true };
      expect(createProfilCandidatSchema.safeParse(forged).success).toBe(false);
    });

    test('reviseProfilCandidatSchema allows clearing fields with explicit null and rejects forged fields', () => {
      const validPartial = {
        specialite2: 'PHYSIQUE_CHIMIE' as const,
        dispensesDeclarees: null,
        p3EligibiliteAudit: null,
      };
      expect(reviseProfilCandidatSchema.safeParse(validPartial).success).toBe(true);

      const forged = {
        specialite2: 'PHYSIQUE_CHIMIE' as const,
        role: 'ADMIN',
      };
      expect(reviseProfilCandidatSchema.safeParse(forged).success).toBe(false);
    });
  });

  describe('toPrismaJson Canonical Adapter', () => {
    test('returns undefined when input is undefined', () => {
      expect(toPrismaJson(undefined)).toBeUndefined();
    });

    test('returns Prisma.JsonNull when input is null', () => {
      expect(toPrismaJson(null)).toBe(Prisma.JsonNull);
    });

    test('returns validated JSON structure when input is valid', () => {
      const data = [
        {
          matiere: 'PHILOSOPHIE',
          epreuve: 'ECRIT',
          motif: 'DISPENSE',
          dateDecision: '2026-09-01',
        },
      ];
      expect(toPrismaJson(data)).toEqual(data);
    });

    test('throws error if input is not valid serializable JSON', () => {
      const invalid = {
        unsupported: () => 'function',
      };
      expect(() => toPrismaJson(invalid as any)).toThrow(/Invalid JSON value for Prisma persistence/);
    });
  });
});
