/**
 * F51: Bilan Migration Script (Read-Only / Dry-Run Safe)
 * Migrates data from Diagnostic, Assessment, StageBilan to canonical Bilan model
 *
 * Usage:
 *   npx tsx scripts/migrate-bilans.ts --dry-run    # Preview only
 *   npx tsx scripts/migrate-bilans.ts --execute   # Execute migration
 *   npx tsx scripts/migrate-bilans.ts --source=Diagnostic  # Migrate only one source
 */

import { PrismaClient } from '@prisma/client';
import type {
  BilanType,
  BilanStatus,
  DomainScore,
  DiagnosticSourceData,
  AssessmentSourceData,
  StageBilanSourceData,
  MigrationReport,
  MigrationResult,
} from '../lib/bilan/types';

const prisma = new PrismaClient();

interface MigrationOptions {
  dryRun: boolean;
  source?: 'Diagnostic' | 'Assessment' | 'StageBilan';
  batchSize: number;
}

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run') || (!args.includes('--execute')),
    source: args.find(a => a.startsWith('--source='))?.split('=')[1] as MigrationOptions['source'],
    batchSize: parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '100'),
  };
}

// ============================================================================
// Diagnostic Migration
// ============================================================================

async function migrateDiagnostic(diagnostic: any, dryRun: boolean): Promise<MigrationResult> {
  try {
    // Map Diagnostic status to BilanStatus
    const statusMap: Record<string, BilanStatus> = {
      'RECEIVED': 'PENDING' as BilanStatus,
      'VALIDATED': 'PENDING' as BilanStatus,
      'SCORED': 'SCORING' as BilanStatus,
      'GENERATING': 'GENERATING' as BilanStatus,
      'ANALYZED': 'COMPLETED' as BilanStatus,
      'FAILED': 'FAILED' as BilanStatus,
    };

    // Extract domain scores from scoring data if available
    const domainScores: DomainScore[] = [];
    if (diagnostic.data && typeof diagnostic.data === 'object') {
      const data = diagnostic.data as any;
      if (data.scoring?.domainScores) {
        data.scoring.domainScores.forEach((d: any) => {
          domainScores.push({ domain: d.domain, score: d.score });
        });
      }
    }

    // Build source data
    const sourceData: DiagnosticSourceData = {
      version: diagnostic.data?.version || 'v1.0',
      submittedAt: diagnostic.createdAt.toISOString(),
      identity: {
        firstName: diagnostic.studentFirstName,
        lastName: diagnostic.studentLastName,
        email: diagnostic.studentEmail,
      },
      schoolContext: {
        establishment: diagnostic.establishment || undefined,
        mathTrack: diagnostic.data?.schoolContext?.mathTrack,
      },
      performance: {
        mathAverage: diagnostic.mathAverage || undefined,
        generalAverage: diagnostic.specialtyAverage || undefined,
        classRanking: diagnostic.classRanking || undefined,
      },
      competencies: diagnostic.data?.competencies || {},
      examPrep: diagnostic.data?.examPrep || {},
      miniTest: diagnostic.data?.examPrep?.miniTest,
    };

    const bilanData = {
      publicShareId: diagnostic.publicShareId,
      type: 'DIAGNOSTIC_PRE_STAGE' as BilanType,
      subject: 'MATHS', // Diagnostic is maths-specific
      legacyDiagnosticId: diagnostic.id,
      sourceData: sourceData as any,
      studentEmail: diagnostic.studentEmail,
      studentName: `${diagnostic.studentFirstName} ${diagnostic.studentLastName}`,
      studentPhone: diagnostic.studentPhone,
      globalScore: diagnostic.data?.scoring?.readinessScore,
      confidenceIndex: undefined, // Not in legacy Diagnostic
      domainScores: domainScores as any,
      studentMarkdown: diagnostic.studentMarkdown,
      parentsMarkdown: diagnostic.parentsMarkdown,
      nexusMarkdown: diagnostic.nexusMarkdown,
      analysisJson: diagnostic.analysisJson,
      status: statusMap[diagnostic.status] || 'PENDING' as BilanStatus,
      progress: diagnostic.status === 'ANALYZED' ? 100 : diagnostic.status === 'SCORED' ? 50 : 25,
      isPublished: true, // Legacy diagnostics are considered published
      publishedAt: diagnostic.createdAt,
      errorCode: diagnostic.errorCode,
      errorDetails: diagnostic.errorDetails,
      retryCount: diagnostic.retryCount,
      sourceVersion: diagnostic.definitionVersion || 'v1.0',
      engineVersion: diagnostic.modelUsed || 'legacy',
      ragUsed: diagnostic.ragUsed,
      ragCollections: diagnostic.ragCollections,
      createdAt: diagnostic.createdAt,
      updatedAt: diagnostic.updatedAt,
    };

    if (dryRun) {
      return {
        source: 'Diagnostic',
        sourceId: diagnostic.id,
        bilanId: '[DRY-RUN]',
        success: true,
      };
    }

    // Check if already migrated
    const existing = await prisma.bilan.findUnique({
      where: { legacyDiagnosticId: diagnostic.id },
    });

    if (existing) {
      return {
        source: 'Diagnostic',
        sourceId: diagnostic.id,
        bilanId: existing.id,
        success: true,
      };
    }

    const bilan = await prisma.bilan.create({
      data: bilanData,
    });

    return {
      source: 'Diagnostic',
      sourceId: diagnostic.id,
      bilanId: bilan.id,
      success: true,
    };
  } catch (error) {
    return {
      source: 'Diagnostic',
      sourceId: diagnostic.id,
      bilanId: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Assessment Migration
// ============================================================================

async function migrateAssessment(assessment: any, dryRun: boolean): Promise<MigrationResult> {
  try {
    const statusMap: Record<string, BilanStatus> = {
      'PENDING': 'PENDING' as BilanStatus,
      'SCORING': 'SCORING' as BilanStatus,
      'GENERATING': 'GENERATING' as BilanStatus,
      'COMPLETED': 'COMPLETED' as BilanStatus,
      'FAILED': 'FAILED' as BilanStatus,
    };

    // Extract domain scores from relation
    const domainScores: DomainScore[] = [];
    if (assessment.domainScores && Array.isArray(assessment.domainScores)) {
      assessment.domainScores.forEach((d: any) => {
        domainScores.push({ domain: d.domain, score: d.score });
      });
    }

    // Build source data
    const sourceData: AssessmentSourceData = {
      answers: assessment.answers as Record<string, string>,
      duration: assessment.duration || undefined,
      startedAt: assessment.startedAt?.toISOString(),
      completedAt: assessment.completedAt?.toISOString(),
      questionBankId: assessment.assessmentVersion || 'general_v1',
    };

    const bilanData = {
      publicShareId: assessment.publicShareId,
      type: 'ASSESSMENT_QCM' as BilanType,
      subject: assessment.subject,
      legacyAssessmentId: assessment.id,
      studentId: assessment.studentId,
      sourceData: sourceData as any,
      studentEmail: assessment.studentEmail,
      studentName: assessment.studentName,
      studentPhone: assessment.studentPhone,
      globalScore: assessment.globalScore || undefined,
      confidenceIndex: assessment.confidenceIndex || undefined,
      ssn: assessment.ssn || undefined,
      uai: assessment.uai || undefined,
      domainScores: domainScores as any,
      studentMarkdown: assessment.studentMarkdown,
      parentsMarkdown: assessment.parentsMarkdown,
      nexusMarkdown: assessment.nexusMarkdown,
      analysisJson: assessment.analysisJson,
      status: statusMap[assessment.status] || 'PENDING' as BilanStatus,
      progress: assessment.progress,
      isPublished: assessment.status === 'COMPLETED',
      publishedAt: assessment.status === 'COMPLETED' ? assessment.updatedAt : null,
      errorCode: assessment.errorCode,
      errorDetails: assessment.errorDetails,
      retryCount: assessment.retryCount,
      sourceVersion: assessment.assessmentVersion || 'v1.0',
      engineVersion: assessment.engineVersion || 'legacy',
      ragUsed: false, // Assessment doesn't use RAG currently
      ragCollections: [],
      createdAt: assessment.createdAt,
      updatedAt: assessment.updatedAt,
    };

    if (dryRun) {
      return {
        source: 'Assessment',
        sourceId: assessment.id,
        bilanId: '[DRY-RUN]',
        success: true,
      };
    }

    // Check if already migrated
    const existing = await prisma.bilan.findUnique({
      where: { legacyAssessmentId: assessment.id },
    });

    if (existing) {
      return {
        source: 'Assessment',
        sourceId: assessment.id,
        bilanId: existing.id,
        success: true,
      };
    }

    const bilan = await prisma.bilan.create({
      data: bilanData,
    });

    return {
      source: 'Assessment',
      sourceId: assessment.id,
      bilanId: bilan.id,
      success: true,
    };
  } catch (error) {
    return {
      source: 'Assessment',
      sourceId: assessment.id,
      bilanId: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// StageBilan Migration
// ============================================================================

async function migrateStageBilan(stageBilan: any, dryRun: boolean): Promise<MigrationResult> {
  try {
    // StageBilan doesn't have status enum, consider it COMPLETED if published
    const status: BilanStatus = stageBilan.isPublished ? ('COMPLETED' as BilanStatus) : ('PENDING' as BilanStatus);
    const progress = stageBilan.isPublished ? 100 : 75;

    // Extract domain scores
    const domainScores: DomainScore[] = [];
    if (stageBilan.domainScores && typeof stageBilan.domainScores === 'object') {
      Object.entries(stageBilan.domainScores).forEach(([domain, score]) => {
        domainScores.push({ domain, score: score as number });
      });
    }

    // Build source data
    const sourceData: StageBilanSourceData = {
      scoreGlobal: stageBilan.scoreGlobal || 0,
      domainScores: stageBilan.domainScores as Record<string, number> || {},
      strengths: stageBilan.strengths || [],
      areasForGrowth: stageBilan.areasForGrowth || [],
      nextSteps: stageBilan.nextSteps || undefined,
    };

    // Get student info from relation
    const student = stageBilan.student;
    const studentName = student?.user 
      ? `${student.user.firstName || ''} ${student.user.lastName || ''}`.trim()
      : 'Unknown';

    const bilanData = {
      publicShareId: `stage-${stageBilan.id}`, // Generate new shareId for StageBilan
      type: 'STAGE_POST' as BilanType,
      subject: 'MATHS', // Stage bilans are maths-specific
      legacyStageBilanId: stageBilan.id,
      studentId: stageBilan.studentId,
      sourceData: sourceData as any,
      studentEmail: student?.user?.email || 'unknown@nexus.fr',
      studentName: studentName || 'Unknown Student',
      stageId: stageBilan.stageId,
      coachId: stageBilan.coachId,
      globalScore: stageBilan.scoreGlobal ? stageBilan.scoreGlobal * 5 : undefined, // Convert 0-20 to 0-100
      domainScores: domainScores as any,
      // StageBilan has contentEleve/Parent/Interne, map to markdown
      studentMarkdown: stageBilan.contentEleve,
      parentsMarkdown: stageBilan.contentParent,
      nexusMarkdown: stageBilan.contentInterne || stageBilan.contentParent,
      status,
      progress,
      isPublished: stageBilan.isPublished,
      publishedAt: stageBilan.publishedAt,
      sourceVersion: 'v1.0',
      engineVersion: 'manual_coach',
      ragUsed: false,
      ragCollections: [],
      createdAt: stageBilan.createdAt,
      updatedAt: stageBilan.updatedAt,
    };

    if (dryRun) {
      return {
        source: 'StageBilan',
        sourceId: stageBilan.id,
        bilanId: '[DRY-RUN]',
        success: true,
      };
    }

    // Check if already migrated
    const existing = await prisma.bilan.findUnique({
      where: { legacyStageBilanId: stageBilan.id },
    });

    if (existing) {
      return {
        source: 'StageBilan',
        sourceId: stageBilan.id,
        bilanId: existing.id,
        success: true,
      };
    }

    const bilan = await prisma.bilan.create({
      data: bilanData,
    });

    return {
      source: 'StageBilan',
      sourceId: stageBilan.id,
      bilanId: bilan.id,
      success: true,
    };
  } catch (error) {
    return {
      source: 'StageBilan',
      sourceId: stageBilan.id,
      bilanId: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Main Migration Logic
// ============================================================================

async function runMigration(options: MigrationOptions): Promise<MigrationReport> {
  const report: MigrationReport = {
    total: 0,
    succeeded: 0,
    failed: 0,
    results: [],
    dryRun: options.dryRun,
  };

  console.log(`Starting migration (dryRun: ${options.dryRun})...`);
  console.log(`Batch size: ${options.batchSize}`);
  if (options.source) {
    console.log(`Source filter: ${options.source}`);
  }

  // Migrate Diagnostics
  if (!options.source || options.source === 'Diagnostic') {
    console.log('\n--- Migrating Diagnostics ---');
    const diagnostics = await prisma.diagnostic.findMany({
      take: options.batchSize,
    });
    console.log(`Found ${diagnostics.length} Diagnostics`);

    for (const diagnostic of diagnostics) {
      const result = await migrateDiagnostic(diagnostic, options.dryRun);
      report.results.push(result);
      report.total++;
      if (result.success) report.succeeded++;
      else report.failed++;
    }
  }

  // Migrate Assessments
  if (!options.source || options.source === 'Assessment') {
    console.log('\n--- Migrating Assessments ---');
    const assessments = await prisma.assessment.findMany({
      take: options.batchSize,
      include: { domainScores: true },
    });
    console.log(`Found ${assessments.length} Assessments`);

    for (const assessment of assessments) {
      const result = await migrateAssessment(assessment, options.dryRun);
      report.results.push(result);
      report.total++;
      if (result.success) report.succeeded++;
      else report.failed++;
    }
  }

  // Migrate StageBilans
  if (!options.source || options.source === 'StageBilan') {
    console.log('\n--- Migrating StageBilans ---');
    const stageBilans = await prisma.stageBilan.findMany({
      take: options.batchSize,
      include: {
        student: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
        },
      },
    });
    console.log(`Found ${stageBilans.length} StageBilans`);

    for (const stageBilan of stageBilans) {
      const result = await migrateStageBilan(stageBilan, options.dryRun);
      report.results.push(result);
      report.total++;
      if (result.success) report.succeeded++;
      else report.failed++;
    }
  }

  return report;
}

// ============================================================================
// Entry Point
// ============================================================================

async function main() {
  const options = parseArgs();

  try {
    const report = await runMigration(options);

    console.log('\n========================================');
    console.log('MIGRATION REPORT');
    console.log('========================================');
    console.log(`Mode: ${report.dryRun ? 'DRY-RUN (preview only)' : 'EXECUTE'}`);
    console.log(`Total processed: ${report.total}`);
    console.log(`Succeeded: ${report.succeeded}`);
    console.log(`Failed: ${report.failed}`);

    if (report.failed > 0) {
      console.log('\n--- Failed Migrations ---');
      report.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  ${r.source} ${r.sourceId}: ${r.error}`);
        });
    }

    console.log('\nMigration completed.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
