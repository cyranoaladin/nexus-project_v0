import {
  normalizeTextForQuality,
  splitIntoSentences,
  collectTextLeaves,
  detectRepeatedLongTextBlocks,
  detectRepeatedSentences,
  detectOversizedArrays,
  validateReportWritingQuality,
  ReportQualityError,
} from '@/lib/reports/stage/reportQuality';

describe('reportQuality', () => {
  describe('normalizeTextForQuality', () => {
    it('lowercases text', () => {
      expect(normalizeTextForQuality('Hello World')).toBe('hello world');
    });

    it('removes extra whitespace', () => {
      expect(normalizeTextForQuality('hello   world')).toBe('hello world');
    });

    it('removes final punctuation', () => {
      expect(normalizeTextForQuality('hello world.')).toBe('hello world');
      expect(normalizeTextForQuality('hello world!')).toBe('hello world');
    });

    it('removes surrounding quotes', () => {
      expect(normalizeTextForQuality('"hello world"')).toBe('hello world');
      expect(normalizeTextForQuality('«hello world»')).toBe('hello world');
    });
  });

  describe('splitIntoSentences', () => {
    it('splits French sentences', () => {
      const text = 'Première phrase. Deuxième phrase! Troisième?';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(3);
      expect(sentences[0]).toBe('Première phrase.');
      expect(sentences[1]).toBe('Deuxième phrase!');
    });

    it('handles single sentence', () => {
      expect(splitIntoSentences('Une seule phrase.')).toEqual(['Une seule phrase.']);
    });
  });

  describe('collectTextLeaves', () => {
    it('collects string values from nested object', () => {
      const obj = {
        summary: 'Texte summary',
        details: {
          analysis: 'Texte analysis',
          items: ['item1', 'item2'],
        },
      };
      const leaves = collectTextLeaves(obj);
      expect(leaves).toContain('Texte summary');
      expect(leaves).toContain('Texte analysis');
      expect(leaves).toContain('item1');
      expect(leaves).toContain('item2');
    });

    it('ignores empty strings', () => {
      const obj = { a: 'valid', b: '', c: '   ' };
      const leaves = collectTextLeaves(obj);
      expect(leaves).toContain('valid');
      expect(leaves).not.toContain('');
    });
  });

  describe('detectRepeatedLongTextBlocks', () => {
    it('detects same paragraph >25 words in two fields', () => {
      const longText = "Melik doit apprendre à ralentir et à analyser les consignes avant de commencer son travail pour éviter les erreurs de compréhension et vérifier ses résultats.";
      const obj = {
        field1: longText,
        field2: longText,
      };
      const issues = detectRepeatedLongTextBlocks(obj, 25);
      expect(issues.length).toBeGreaterThan(0);
    });

    it('does not detect short repeated text', () => {
      const obj = {
        field1: 'satisfaisant',
        field2: 'satisfaisant',
      };
      const issues = detectRepeatedLongTextBlocks(obj, 25);
      expect(issues).toHaveLength(0);
    });

    it('detects repeated block with different punctuation', () => {
      const text1 = "Cette phrase doit être détectée comme répétition malgré la différence de ponctuation finale";
      const text2 = "Cette phrase doit être détectée comme répétition malgré la différence de ponctuation finale!";
      const obj = {
        field1: text1,
        field2: text2,
      };
      const issues = detectRepeatedLongTextBlocks(obj, 10);
      expect(issues.length).toBeGreaterThan(0);
    });
  });

  describe('detectRepeatedSentences', () => {
    it('detects same long sentence >15 words in two sections', () => {
      const sentence = "L'élève montre une progression constante et remarquable dans la maîtrise complète des concepts mathématiques abordés durant le stage.";
      const obj = {
        summary: `Début. ${sentence} Fin.`,
        analysis: `Autre texte. ${sentence} Suite.`,
      };
      const issues = detectRepeatedSentences(obj, 15);
      expect(issues.length).toBeGreaterThan(0);
    });

    it('does not detect short repeated phrases', () => {
      const obj = {
        field1: "C'est satisfaisant.",
        field2: "C'est satisfaisant.",
      };
      const issues = detectRepeatedSentences(obj, 15);
      expect(issues).toHaveLength(0);
    });

    it('does not block sentences between 12 and 14 words (threshold now 15)', () => {
      const sentence = "L'élève montre une progression constante dans la maîtrise des concepts abordés."; // 12 mots
      const obj = {
        field1: sentence,
        field2: sentence,
      };
      const issues = detectRepeatedSentences(obj, 15);
      expect(issues).toHaveLength(0); // Ne bloque plus (seuil 15)
    });
  });

  describe('detectOversizedArrays', () => {
    it('detects array with more than 8 items', () => {
      const obj = {
        items: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
      };
      const issues = detectOversizedArrays(obj, 8);
      expect(issues.length).toBeGreaterThan(0);
      // Issue message contains path but not item count (privacy)
      expect(issues[0]).toContain('Oversized array detected at path: items');
    });

    it('does not flag arrays with 8 or fewer items', () => {
      const obj = {
        items: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      };
      const issues = detectOversizedArrays(obj, 8);
      expect(issues).toHaveLength(0);
    });

    it('ignores qualityFlags paths when configured', () => {
      const obj = {
        executiveSummary: {
          keyStrengths: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], // 9 items, should be flagged
        },
        qualityFlags: {
          missingData: Array(30).fill('missing'), // 30 items, should be ignored
          uncertainties: Array(25).fill('uncertain'), // 25 items, should be ignored
        },
      };
      const issues = detectOversizedArrays(obj, 8, {
        ignoredPathPrefixes: ['qualityFlags'],
      });
      // Should only flag executiveSummary.keyStrengths, not qualityFlags
      expect(issues.length).toBe(1);
      expect(issues[0]).toContain('executiveSummary.keyStrengths');
    });

    it('flags qualityFlags paths when not configured to ignore', () => {
      const obj = {
        qualityFlags: {
          missingData: Array(30).fill('missing'),
        },
      };
      const issues = detectOversizedArrays(obj, 8);
      // Without ignoredPathPrefixes, qualityFlags is scanned
      expect(issues.length).toBeGreaterThan(0);
    });
  });

  describe('validateReportWritingQuality', () => {
    it('returns ok=true for reasonable JSON without repetition', () => {
      const obj = {
        summary: "L'élève progresse bien dans ses mathématiques.",
        analysis: "Les points forts sont visibles dans le travail régulier.",
        recommendations: ['Travailler les exercices', 'Relire le cours'],
      };
      const result = validateReportWritingQuality(obj);
      expect(result.ok).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('returns ok=false for repeated text blocks', () => {
      const longText = "Ce paragraphe très long est intentionnellement répété dans deux champs différents pour tester la détection de répétition et il doit être identifié comme tel par notre système de qualité.";
      const obj = {
        summary: longText,
        analysis: longText,
      };
      const result = validateReportWritingQuality(obj);
      expect(result.ok).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('returns ok=false for oversized arrays', () => {
      const obj = {
        strengths: Array(12).fill('Point fort'),
      };
      const result = validateReportWritingQuality(obj);
      expect(result.ok).toBe(false);
    });
  });

  describe('ReportQualityError', () => {
    it('creates error with code and issues', () => {
      const issues = ['Issue 1', 'Issue 2'];
      const error = new ReportQualityError(issues);
      expect(error.code).toBe('REPORT_QUALITY_FAILED');
      expect(error.issues).toEqual(issues);
      expect(error.message).toBe('Report quality validation failed');
    });
  });

  describe('Privacy protection', () => {
    it('does not expose sensitive content in quality issues', () => {
      const sensitiveText = "Melik ZAYANE doit apprendre à ralentir et à analyser les consignes avant de commencer son travail pour éviter les erreurs de compréhension.";
      const obj = {
        field1: sensitiveText,
        field2: sensitiveText,
      };
      const result = validateReportWritingQuality(obj);
      expect(result.ok).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);

      // Verify no sensitive content leaked in issues
      const issuesJson = JSON.stringify(result.issues);
      expect(issuesJson).not.toContain('Melik');
      expect(issuesJson).not.toContain('ZAYANE');
      expect(issuesJson).not.toContain('donnée sensible');
      expect(issuesJson).not.toContain('ralentir'); // from the paragraph
    });

    it('does not expose repeated sentence content', () => {
      const sensitiveSentence = "Melik ZAYANE montre une progression constante et remarquable dans la maîtrise complète des concepts mathématiques abordés durant le stage.";
      const obj = {
        summary: `Début. ${sensitiveSentence} Fin.`,
        analysis: `Autre texte. ${sensitiveSentence} Suite.`,
      };
      const issues = detectRepeatedSentences(obj, 15);
      expect(issues.length).toBeGreaterThan(0);

      const issuesJson = JSON.stringify(issues);
      expect(issuesJson).not.toContain('Melik');
      expect(issuesJson).not.toContain('ZAYANE');
      expect(issuesJson).not.toContain('progression constante');
    });
  });
});

describe('Schema backward compatibility', () => {
  it('accepts text up to 4000 characters (original limit)', () => {
    const { premiumPedagogicalReportSchema } = jest.requireActual('@/lib/reports/stage/schema');
    const longText = 'A'.repeat(3500);
    const validData = {
      cover: {
        title: 'Bilan',
        subtitle: 'Maths',
        studentName: 'Test',
        stageLabel: 'Stage',
        subjectLabel: 'Maths',
      },
      executiveSummary: {
        profileSummary: longText,
        keyStrengths: ['Force 1'],
        keyRisks: ['Risque 1'],
        priorityMessageForParents: 'Message',
        priorityMessageForStudent: 'Message',
      },
      competenceReview: [{
        domain: 'Test',
        level: 'SATISFAISANT',
        evidence: ['Evidence'],
        analysis: 'Analysis',
        recommendation: 'Rec',
      }],
      studentPosture: {
        confidence: 'Conf',
        autonomy: 'Auto',
        workingMethod: 'Method',
        attentionPoints: ['Point'],
      },
      actionPlan: {
        next7Days: ['Action'],
        next30Days: ['Action'],
        beforeExam: ['Action'],
      },
      parentSection: {
        reassuringSummary: 'Summary',
        concreteSupportAdvice: ['Advice'],
        warningWithoutAlarmism: 'Warning',
      },
      coachSection: {
        syntheticReading: 'Reading',
        nextSessionPriorities: ['Priority'],
      },
      qualityFlags: {
        missingData: [],
        uncertainties: [],
        shouldBeReviewedByCoach: false,
      },
    };

    const result = premiumPedagogicalReportSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('accepts arrays up to 12 elements (original limit)', () => {
    const { premiumPedagogicalReportSchema } = jest.requireActual('@/lib/reports/stage/schema');
    const validData = {
      cover: {
        title: 'Bilan',
        subtitle: 'Maths',
        studentName: 'Test',
        stageLabel: 'Stage',
        subjectLabel: 'Maths',
      },
      executiveSummary: {
        profileSummary: 'Summary',
        keyStrengths: Array(10).fill('Strength'), // 10 elements, under 12
        keyRisks: ['Risk'],
        priorityMessageForParents: 'Message',
        priorityMessageForStudent: 'Message',
      },
      competenceReview: [{
        domain: 'Test',
        level: 'SATISFAISANT',
        evidence: Array(12).fill('Evidence'), // 12 elements, at limit
        analysis: 'Analysis',
        recommendation: 'Rec',
      }],
      studentPosture: {
        confidence: 'Conf',
        autonomy: 'Auto',
        workingMethod: 'Method',
        attentionPoints: Array(12).fill('Point'), // 12 elements, at limit
      },
      actionPlan: {
        next7Days: ['Action'],
        next30Days: ['Action'],
        beforeExam: ['Action'],
      },
      parentSection: {
        reassuringSummary: 'Summary',
        concreteSupportAdvice: ['Advice'],
        warningWithoutAlarmism: 'Warning',
      },
      coachSection: {
        syntheticReading: 'Reading',
        nextSessionPriorities: ['Priority'],
      },
      qualityFlags: {
        missingData: [],
        uncertainties: [],
        shouldBeReviewedByCoach: false,
      },
    };

    const result = premiumPedagogicalReportSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('reportQuality detects arrays >8 even if schema accepts up to 12', () => {
    const obj = {
      strengths: Array(9).fill('Point fort'), // 9 > 8, detected by reportQuality
    };
    const issues = detectOversizedArrays(obj, 8);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toContain('Oversized array detected at path: strengths');
  });

  it('reportQuality ignores qualityFlags arrays even with 30 elements', () => {
    const obj = {
      qualityFlags: {
        missingData: Array(30).fill('data'),
        uncertainties: Array(30).fill('uncertainty'),
      },
    };
    const result = validateReportWritingQuality(obj);
    // qualityFlags should be ignored, so ok should be true
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('reportQuality flags executiveSummary arrays with 9 elements', () => {
    const obj = {
      executiveSummary: {
        keyStrengths: Array(9).fill('Force'), // 9 > 8, should be flagged
      },
    };
    const issues = detectOversizedArrays(obj, 8, {
      ignoredPathPrefixes: ['qualityFlags'],
    });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toContain('executiveSummary.keyStrengths');
  });
});
