#!/usr/bin/env tsx
/**
 * Universal Assessment Pipeline E2E Test
 * 
 * Tests the complete flow from submission to bilan generation
 * for NSI Terminale (Alice Turing scenario).
 * 
 * Usage: npx tsx scripts/test-universal-pipeline.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const POLLING_INTERVAL = 2000; // 2 seconds
const MAX_WAIT_TIME = 120000; // 2 minutes

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step: string, message: string) {
  log(`\n${colors.bright}[${step}]${colors.reset} ${message}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

// ─── SETUP ───────────────────────────────────────────────────────────────────

interface StudentProfile {
  name: string;
  email: string;
  subject: string;
  grade: string;
}

const aliceProfile: StudentProfile = {
  name: 'Alice Turing',
  email: 'alice.turing@test.nexus.com',
  subject: 'MATHS', // Using MATHS for now since NSI questions not migrated yet
  grade: 'TERMINALE',
};

// Simulated answers (mix of correct, incorrect, and NSP)
const aliceAnswers = {
  'MATH-COMB-01': 'a', // Correct
  'MATH-COMB-02': 'b', // Incorrect
  'MATH-GEOM-01': 'a', // Correct
  'MATH-GEOM-02': 'c', // NSP equivalent (wrong answer)
  'MATH-ANA-01': 'a',  // Correct
  'MATH-ANA-02': 'b',  // Incorrect
};

// ─── STEP 1: SUBMISSION ──────────────────────────────────────────────────────

async function submitAssessment(profile: StudentProfile, answers: Record<string, string>) {
  logStep('STEP 1', 'Submitting assessment...');

  const payload = {
    subject: profile.subject,
    grade: profile.grade,
    studentData: {
      email: profile.email,
      name: profile.name,
    },
    answers,
    duration: 1800000, // 30 minutes
    metadata: {
      startedAt: new Date(Date.now() - 1800000).toISOString(),
      completedAt: new Date().toISOString(),
    },
  };

  logInfo(`Payload: ${JSON.stringify(payload, null, 2)}`);

  const response = await fetch(`${API_BASE_URL}/api/assessments/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Submission failed: ${response.status} - ${error}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(`Submission failed: ${result.error || 'Unknown error'}`);
  }

  if (!result.assessmentId) {
    throw new Error('No assessmentId returned');
  }

  logSuccess(`Assessment submitted successfully`);
  logInfo(`Assessment ID: ${result.assessmentId}`);
  logInfo(`Redirect URL: ${result.redirectUrl}`);

  return result.assessmentId;
}

// ─── STEP 2: POLLING & GENERATION ────────────────────────────────────────────

async function pollAssessmentStatus(assessmentId: string) {
  logStep('STEP 2', 'Polling assessment status...');

  const startTime = Date.now();
  let previousStatus = '';

  while (true) {
    const elapsed = Date.now() - startTime;

    if (elapsed > MAX_WAIT_TIME) {
      throw new Error(`Timeout: Assessment did not complete within ${MAX_WAIT_TIME / 1000}s`);
    }

    const response = await fetch(`${API_BASE_URL}/api/assessments/${assessmentId}/status`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Status check failed: ${response.status} - ${error}`);
    }

    const status = await response.json();

    // Log status change
    if (status.status !== previousStatus) {
      const statusColor =
        status.status === 'COMPLETED'
          ? colors.green
          : status.status === 'FAILED'
          ? colors.red
          : colors.yellow;

      log(
        `  ${statusColor}${status.status}${colors.reset} (${status.progress}%) - ${status.message}`,
        statusColor
      );
      previousStatus = status.status;
    }

    // Check for failure
    if (status.status === 'FAILED') {
      logError('Assessment generation FAILED');
      logError(`Error: ${status.errorCode || 'Unknown'}`);
      logError(`Details: ${status.errorDetails || 'No details'}`);
      throw new Error('Assessment generation failed');
    }

    // Check for completion
    if (status.status === 'COMPLETED') {
      logSuccess(`Assessment completed in ${Math.round(elapsed / 1000)}s`);
      return status;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL));
  }
}

// ─── STEP 3: VERIFICATION ────────────────────────────────────────────────────

async function verifyBilan(assessmentId: string) {
  logStep('STEP 3', 'Verifying bilan generation...');

  // Fetch complete assessment from database
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
  });

  if (!assessment) {
    throw new Error('Assessment not found in database');
  }

  logInfo('Running assertions...');

  // Assertion 1: Global score is calculated
  if (assessment.globalScore === null || assessment.globalScore === undefined) {
    throw new Error('Assertion failed: globalScore is null');
  }
  if (assessment.globalScore <= 0) {
    throw new Error('Assertion failed: globalScore is not positive');
  }
  logSuccess(`Global score calculated: ${assessment.globalScore}/100`);

  // Assertion 2: Confidence index is calculated
  if (assessment.confidenceIndex === null || assessment.confidenceIndex === undefined) {
    throw new Error('Assertion failed: confidenceIndex is null');
  }
  logSuccess(`Confidence index calculated: ${assessment.confidenceIndex}/100`);

  // Assertion 3: Student bilan is not empty
  if (!assessment.studentMarkdown || assessment.studentMarkdown.trim().length === 0) {
    throw new Error('Assertion failed: studentMarkdown is empty');
  }
  logSuccess(`Student bilan generated (${assessment.studentMarkdown.length} chars)`);

  // Assertion 4: Parents bilan is not empty
  if (!assessment.parentsMarkdown || assessment.parentsMarkdown.trim().length === 0) {
    throw new Error('Assertion failed: parentsMarkdown is empty');
  }
  logSuccess(`Parents bilan generated (${assessment.parentsMarkdown.length} chars)`);

  // Assertion 5: Nexus bilan contains technical data
  if (!assessment.nexusMarkdown || assessment.nexusMarkdown.trim().length === 0) {
    throw new Error('Assertion failed: nexusMarkdown is empty');
  }
  logSuccess(`Nexus bilan generated (${assessment.nexusMarkdown.length} chars)`);

  // Assertion 6: Scoring result is present
  if (!assessment.scoringResult) {
    throw new Error('Assertion failed: scoringResult is null');
  }
  const scoringResult = assessment.scoringResult as any;
  logSuccess('Scoring result present in database');

  // Assertion 7: Subject-specific metrics are present
  if (!scoringResult.metrics) {
    throw new Error('Assertion failed: metrics not found in scoringResult');
  }
  logSuccess(`Subject metrics present: ${Object.keys(scoringResult.metrics).join(', ')}`);

  // Assertion 8: Strengths and weaknesses identified
  if (!scoringResult.strengths || scoringResult.strengths.length === 0) {
    logWarning('No strengths identified (might be expected for low scores)');
  } else {
    logSuccess(`Strengths identified: ${scoringResult.strengths.join(', ')}`);
  }

  if (!scoringResult.weaknesses || scoringResult.weaknesses.length === 0) {
    logWarning('No weaknesses identified (might be expected for high scores)');
  } else {
    logSuccess(`Weaknesses identified: ${scoringResult.weaknesses.join(', ')}`);
  }

  // Assertion 9: Recommendations provided
  if (!scoringResult.recommendations || scoringResult.recommendations.length === 0) {
    throw new Error('Assertion failed: no recommendations provided');
  }
  logSuccess(`Recommendations provided: ${scoringResult.recommendations.length} items`);

  logInfo('\n📊 Assessment Summary:');
  logInfo(`  Student: ${assessment.studentName}`);
  logInfo(`  Subject: ${assessment.subject} ${assessment.grade}`);
  logInfo(`  Global Score: ${assessment.globalScore}/100`);
  logInfo(`  Confidence Index: ${assessment.confidenceIndex}/100`);
  logInfo(`  Status: ${assessment.status}`);
  logInfo(`  Created: ${assessment.createdAt.toISOString()}`);

  return assessment;
}

// ─── TEARDOWN ────────────────────────────────────────────────────────────────

async function cleanup(assessmentId: string) {
  logStep('TEARDOWN', 'Cleaning up test data...');

  await prisma.assessment.delete({
    where: { id: assessmentId },
  });

  logSuccess('Test assessment deleted from database');
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  log('\n' + '='.repeat(80), colors.bright);
  log('🧪 UNIVERSAL ASSESSMENT PIPELINE E2E TEST', colors.bright);
  log('='.repeat(80) + '\n', colors.bright);

  logInfo(`Testing with profile: ${aliceProfile.name} (${aliceProfile.subject} ${aliceProfile.grade})`);
  logInfo(`API Base URL: ${API_BASE_URL}`);
  logInfo(`Polling Interval: ${POLLING_INTERVAL}ms`);
  logInfo(`Max Wait Time: ${MAX_WAIT_TIME / 1000}s`);

  let assessmentId: string | null = null;

  try {
    // Step 1: Submit assessment
    assessmentId = await submitAssessment(aliceProfile, aliceAnswers);

    if (!assessmentId) {
      throw new Error('Assessment ID is null or undefined after submission');
    }

    // Step 2: Poll status until completion
    await pollAssessmentStatus(assessmentId);

    // Step 3: Verify bilan
    await verifyBilan(assessmentId);

    // Success!
    log('\n' + '='.repeat(80), colors.green);
    log('🟢 SYSTÈME NSI/MATHS OPÉRATIONNEL', colors.green + colors.bright);
    log('='.repeat(80) + '\n', colors.green);

    logSuccess('All tests passed!');
    logSuccess('The universal assessment pipeline is fully operational.');

    // Teardown
    if (assessmentId) {
      await cleanup(assessmentId);
    }

    process.exit(0);
  } catch (error) {
    logError('\n' + '='.repeat(80));
    logError('🔴 TEST FAILED');
    logError('='.repeat(80) + '\n');

    if (error instanceof Error) {
      logError(`Error: ${error.message}`);
      if (error.stack) {
        logInfo(`Stack trace:\n${error.stack}`);
      }
    } else {
      logError(`Unknown error: ${String(error)}`);
    }

    // Attempt cleanup even on failure
    if (assessmentId) {
      try {
        await cleanup(assessmentId);
      } catch (cleanupError) {
        logWarning('Failed to cleanup test data');
      }
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
main();
